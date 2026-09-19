-- LOCAL ISOLATED DATABASE ONLY. Never load-test a shared production database.
-- Run after migrations 001, 002, 004; every mutation below rolls back.
begin;
do $test$
declare
  r jsonb;
  receipt uuid := gen_random_uuid();
  initial_rows bigint;
  initial_bytes bigint;
  stored_bytes bigint;
  initial_day integer;
  today date := (now() at time zone 'UTC')::date;
  consent jsonb := '{"version":"2026-09-19","research":true,"rights":true,"reviewed":true,"allowPublication":false}';
  payload jsonb := '{"status":"community-submitted","license":"CC-BY-4.0","notes":"synthetic"}';
begin
  if has_function_privilege('anon','public.jevarena_submit_contribution(uuid,jsonb,jsonb,text,text,text)','execute') then raise exception 'anon RPC allowed'; end if;
  if has_schema_privilege('authenticated','jevarena_private','usage') then raise exception 'authenticated schema allowed'; end if;
  if not has_function_privilege('service_role','public.jevarena_submit_contribution(uuid,jsonb,jsonb,text,text,text)','execute') then raise exception 'service RPC denied'; end if;
  perform public.jevarena_purge_contributions();
  select receipt_rows, active_payload_bytes into initial_rows, initial_bytes from jevarena_private.contribution_capacity;
  r := public.jevarena_delete_contribution(receipt,repeat('b',64));
  if r->>'code' is distinct from 'NOT_FOUND' then raise exception 'delete-before-submit false success'; end if;
  r := public.jevarena_submit_contribution(receipt,payload,consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'ok' is distinct from 'true' then raise exception 'submit failed %',r; end if;
  if (r->>'expiresAt')::timestamptz - (r->>'receivedAt')::timestamptz is distinct from interval '30 days' then raise exception 'TTL mismatch'; end if;
  select payload_bytes into stored_bytes from jevarena_private.contributions where id=receipt;
  if (select receipt_rows from jevarena_private.contribution_capacity) is distinct from initial_rows+1 then raise exception 'row counter mismatch'; end if;
  if (select active_payload_bytes from jevarena_private.contribution_capacity) is distinct from initial_bytes+stored_bytes then raise exception 'byte counter mismatch'; end if;
  r := public.jevarena_submit_contribution(receipt,payload,consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'duplicate' is distinct from 'true' then raise exception 'idempotency failed'; end if;
  if (select receipt_rows from jevarena_private.contribution_capacity) is distinct from initial_rows+1 then raise exception 'duplicate incremented capacity'; end if;
  r := public.jevarena_delete_contribution(receipt,repeat('f',64));
  if r->>'code' is distinct from 'NOT_FOUND' then raise exception 'wrong token deleted'; end if;
  r := public.jevarena_delete_contribution(receipt,repeat('b',64));
  if r->>'deleted' is distinct from 'true' then raise exception 'delete failed'; end if;
  if (select active_payload_bytes from jevarena_private.contribution_capacity) is distinct from initial_bytes then raise exception 'delete bytes incorrect'; end if;
  r := public.jevarena_delete_contribution(receipt,repeat('b',64));
  if r->>'deleted' is distinct from 'true' then raise exception 'duplicate deletion failed'; end if;
  if (select active_payload_bytes from jevarena_private.contribution_capacity) is distinct from initial_bytes then raise exception 'double-decremented bytes'; end if;
  r := public.jevarena_submit_contribution(receipt,payload,consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'code' is distinct from 'GONE' then raise exception 'withdrawn payload resurrected'; end if;
  update jevarena_private.contributions set expires_at=now()-interval '1 hour' where id=receipt;
  perform public.jevarena_purge_contributions();
  if (select receipt_rows from jevarena_private.contribution_capacity) is distinct from initial_rows then raise exception 'expiry row counter incorrect'; end if;

  update jevarena_private.contribution_capacity set active_payload_bytes=5368709120;
  r := public.jevarena_submit_contribution(gen_random_uuid(),payload,consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'code' is distinct from 'RATE_LIMIT' then raise exception 'byte cap failed'; end if;
  update jevarena_private.contribution_capacity set active_payload_bytes=initial_bytes, receipt_rows=310000;
  r := public.jevarena_submit_contribution(gen_random_uuid(),payload,consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'code' is distinct from 'RATE_LIMIT' then raise exception 'receipt cap failed'; end if;
  update jevarena_private.contribution_capacity set receipt_rows=initial_rows, storage_checked_at=now()-interval '16 minutes';
  r := public.jevarena_submit_contribution(gen_random_uuid(),payload,consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'code' is distinct from 'RATE_LIMIT' then raise exception 'stale storage monitor failed open'; end if;
  update jevarena_private.contribution_capacity set storage_checked_at=now();
  select accepted into initial_day from jevarena_private.contribution_daily_limits where day=today;
  update jevarena_private.contribution_daily_limits set accepted=10000 where day=today;
  r := public.jevarena_submit_contribution(gen_random_uuid(),payload,consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'code' is distinct from 'RATE_LIMIT' then raise exception 'daily cap failed'; end if;
  update jevarena_private.contribution_daily_limits set accepted=initial_day where day=today;
  insert into jevarena_private.contribution_ip_limits(hour,ip_hash,accepted)
    values(date_trunc('hour',now()),repeat('f',64),100)
    on conflict (hour,ip_hash) do update set accepted=100;
  r := public.jevarena_submit_contribution(gen_random_uuid(),payload,consent,repeat('a',64),repeat('b',64),repeat('f',64));
  if r->>'code' is distinct from 'RATE_LIMIT' then raise exception 'IP quota failed'; end if;
end;
$test$;
rollback;
