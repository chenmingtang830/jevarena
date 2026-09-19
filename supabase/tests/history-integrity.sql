-- Run only in isolated local/CI database; all synthetic mutations roll back.
begin;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
do $test$ begin
  if has_table_privilege('authenticated','jevarena_private.history','select,insert,update,delete') then raise exception 'Direct history table grant'; end if;
  if has_function_privilege('anon','public.jevarena_history_save(uuid,jsonb,jsonb)','execute') then raise exception 'Anonymous save grant'; end if;
  if has_function_privilege('service_role','public.jevarena_history_read(uuid)','execute') then raise exception 'Service history read grant'; end if;
end; $test$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $test$
declare r jsonb; payload jsonb:='{"challenge":{"schemaVersion":1,"id":"task","title":"Test","language":"en","kind":"judgment","content":"2 + 2 = 4","question":"Is this correct?","options":[{"id":"yes","label":"Yes"},{"id":"no","label":"No"}]},"runs":[]}';
begin
  r:=public.jevarena_history_save('20000000-0000-4000-8000-000000000001',payload,'{"version":"2026-09-19","savePrivate":true}');
  if r->>'ok' is distinct from 'true' then raise exception 'Owner save failed %',r; end if;
  if (r->'item'->>'expiresAt')::timestamptz-(r->'item'->>'createdAt')::timestamptz is distinct from interval '30 days' then raise exception 'TTL mismatch'; end if;
  r:=public.jevarena_history_save('20000000-0000-4000-8000-000000000001',payload,'{"version":"2026-09-19","savePrivate":true}');
  if r->>'duplicate' is distinct from 'true' then raise exception 'Duplicate save failed'; end if;
  r:=public.jevarena_history_save('20000000-0000-4000-8000-000000000001',jsonb_set(payload,'{challenge,title}','"Changed"'),' {"version":"2026-09-19","savePrivate":true}');
  if r->>'code' is distinct from 'CONFLICT' then raise exception 'Changed retry overwrote history'; end if;
  r:=public.jevarena_history_save(gen_random_uuid(),payload||'{"apiKey":"secret"}','{"version":"2026-09-19","savePrivate":true}');
  if r->>'code' is distinct from 'INVALID' then raise exception 'Unknown key accepted'; end if;
  r:=public.jevarena_history_save(gen_random_uuid(),jsonb_set(payload,'{challenge,apiKey}','"secret"'),' {"version":"2026-09-19","savePrivate":true}');
  if r->>'code' is distinct from 'INVALID' then raise exception 'Nested key accepted'; end if;
  r:=public.jevarena_history_save(gen_random_uuid(),jsonb_set(payload,'{challenge,content}',to_jsonb(repeat('x',65536))),' {"version":"2026-09-19","savePrivate":true}');
  if r->>'code' is distinct from 'INVALID' then raise exception 'Oversize accepted'; end if;
  r:=public.jevarena_history_list(21,null,null);
  if jsonb_array_length(r->'items') is distinct from 1 then raise exception 'Owner list failed'; end if;
  for i in 2..100 loop
    r:=public.jevarena_history_save(gen_random_uuid(),payload,'{"version":"2026-09-19","savePrivate":true}');
    if r->>'ok' is distinct from 'true' then raise exception 'Within-cap owner save failed'; end if;
  end loop;
  r:=public.jevarena_history_save(gen_random_uuid(),payload,'{"version":"2026-09-19","savePrivate":true}');
  if r->>'code' is distinct from 'CAPACITY' then raise exception 'Per-user cap failed'; end if;
  r:=public.jevarena_history_list(22,null,null);
  if r->>'code' is distinct from 'INVALID' then raise exception 'Unbounded list allowed'; end if;
end; $test$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $test$ declare r jsonb; begin
  r:=public.jevarena_history_read('20000000-0000-4000-8000-000000000001');
  if r->>'code' is distinct from 'NOT_FOUND' then raise exception 'Cross-owner read leaked'; end if;
  r:=public.jevarena_history_delete('20000000-0000-4000-8000-000000000001');
  if r->>'code' is distinct from 'NOT_FOUND' then raise exception 'Cross-owner delete succeeded'; end if;
  r:=public.jevarena_history_list(21,null,null);
  if jsonb_array_length(r->'items') is distinct from 0 then raise exception 'Cross-owner list leaked'; end if;
end; $test$;

select set_config('request.jwt.claim.sub','',true);
do $test$ declare r jsonb; begin
  r:=public.jevarena_history_list(21,null,null);
  if r->>'code' is distinct from 'AUTH_REQUIRED' then raise exception 'Missing user authenticated'; end if;
end; $test$;
reset role;

do $test$ declare bytes bigint; rows bigint; begin
  select count(*),sum(payload_bytes) into rows,bytes from jevarena_private.history;
  if rows is distinct from 100 or rows is distinct from (select rows_count from jevarena_private.history_capacity) or bytes is distinct from (select payload_bytes from jevarena_private.history_capacity) then raise exception 'Capacity counters drifted'; end if;
end; $test$;
-- RLS is a second boundary even if a future migration accidentally grants read.
grant usage on schema jevarena_private to authenticated;
grant select on jevarena_private.history to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $test$ begin
  if (select count(*) from jevarena_private.history) is distinct from 0 then raise exception 'RLS cross-owner read failed'; end if;
end; $test$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $test$ begin
  if (select count(*) from jevarena_private.history) is distinct from 100 then raise exception 'RLS owner read failed'; end if;
end; $test$;
reset role;
revoke select on jevarena_private.history from authenticated;
revoke usage on schema jevarena_private from authenticated;
update jevarena_private.history_capacity set payload_bytes=536870912;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $test$
declare r jsonb; payload jsonb:='{"challenge":{"schemaVersion":1,"id":"task","title":"Test","language":"en","kind":"judgment","content":"2 + 2 = 4","question":"Is this correct?","options":[{"id":"yes","label":"Yes"},{"id":"no","label":"No"}]},"runs":[]}';
begin
  r:=public.jevarena_history_save(gen_random_uuid(),payload,'{"version":"2026-09-19","savePrivate":true}');
  if r->>'code' is distinct from 'CAPACITY' then raise exception 'Global byte cap failed'; end if;
end; $test$;
reset role;
update jevarena_private.history_capacity set payload_bytes=(select sum(payload_bytes) from jevarena_private.history),rows_count=100000;
set local role authenticated;
do $test$
declare r jsonb; payload jsonb:='{"challenge":{"schemaVersion":1,"id":"task","title":"Test","language":"en","kind":"judgment","content":"2 + 2 = 4","question":"Is this correct?","options":[{"id":"yes","label":"Yes"},{"id":"no","label":"No"}]},"runs":[]}';
begin
  r:=public.jevarena_history_save(gen_random_uuid(),payload,'{"version":"2026-09-19","savePrivate":true}');
  if r->>'code' is distinct from 'CAPACITY' then raise exception 'Global row cap failed'; end if;
end; $test$;
reset role;
update jevarena_private.history_capacity set rows_count=(select count(*) from jevarena_private.history);
update jevarena_private.history set expires_at=now()-interval '1 minute' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $test$ declare r jsonb; begin
  r:=public.jevarena_history_read('20000000-0000-4000-8000-000000000001');
  if r->>'code' is distinct from 'NOT_FOUND' then raise exception 'Expired read leaked'; end if;
end; $test$;
reset role;
select public.jevarena_history_purge();
do $test$ begin
  if (select rows_count from jevarena_private.history_capacity) is distinct from 99 then raise exception 'Expiry counter failed'; end if;
end; $test$;
delete from auth.users where id='10000000-0000-4000-8000-000000000001';
do $test$ begin
  if (select rows_count from jevarena_private.history_capacity) is distinct from 0 or (select payload_bytes from jevarena_private.history_capacity) is distinct from 0 then raise exception 'Account deletion did not clean payload/counters'; end if;
end; $test$;
rollback;
