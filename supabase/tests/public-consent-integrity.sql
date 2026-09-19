-- LOCAL ISOLATED DATABASE ONLY. Apply migration 006 first. No persistent fixtures.
begin;
do $test$
declare
  r jsonb;
  private_id uuid := gen_random_uuid();
  public_id uuid := gen_random_uuid();
  private_consent jsonb := '{"version":"2026-09-19","research":true,"rights":true,"reviewed":true,"allowPublication":false}';
  public_consent jsonb := '{"version":"2026-09-19-public-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-review"}';
  bad jsonb;
  payload jsonb := '{"status":"community-submitted","license":"CC-BY-4.0","notes":"synthetic"}';
  initial_rows bigint;
begin
  if has_function_privilege('anon','public.jevarena_submit_contribution(uuid,jsonb,jsonb,text,text,text)','execute') then raise exception 'anon RPC allowed'; end if;
  if has_schema_privilege('authenticated','jevarena_private','usage') then raise exception 'authenticated schema allowed'; end if;
  if has_table_privilege('anon','jevarena_private.contributions','select') then raise exception 'public read allowed'; end if;
  if exists (select 1 from pg_policies where schemaname='jevarena_private' and tablename='contributions') then raise exception 'unexpected contribution RLS policy'; end if;
  perform public.jevarena_purge_contributions();
  select receipt_rows into initial_rows from jevarena_private.contribution_capacity;
  r := public.jevarena_submit_contribution(private_id,payload,private_consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'ok' is distinct from 'true' then raise exception 'private compatibility failed %',r; end if;
  r := public.jevarena_submit_contribution(public_id,payload,public_consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'ok' is distinct from 'true' then raise exception 'public candidate failed %',r; end if;
  if (r->>'expiresAt')::timestamptz - (r->>'receivedAt')::timestamptz is distinct from interval '30 days' then raise exception 'TTL changed'; end if;
  if (select consent from jevarena_private.contributions where id=private_id) is distinct from private_consent then raise exception 'private consent transformed'; end if;
  if (select evidence_status from jevarena_private.contributions where id=public_id) is distinct from 'community-submitted' then raise exception 'candidate promoted'; end if;
  r := public.jevarena_submit_contribution(public_id,payload,public_consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'duplicate' is distinct from 'true' then raise exception 'public idempotency failed'; end if;
  r := public.jevarena_submit_contribution(private_id,payload,public_consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'code' is distinct from 'CONFLICT' then raise exception 'private consent upgraded on replay'; end if;
  foreach bad in array array[
    public_consent - 'publication',
    public_consent || '{"publication":"immediate"}',
    public_consent || '{"reviewed":false}',
    public_consent || '{"rights":false}',
    public_consent || '{"research":false}',
    public_consent || '{"unexpected":true}',
    private_consent || '{"allowPublication":true}',
    public_consent || '{"version":"unknown"}',
    'null'::jsonb
  ] loop
    r := public.jevarena_submit_contribution(gen_random_uuid(),payload,bad,repeat('a',64),repeat('b',64),repeat('e',64));
    if r->>'code' is distinct from 'INVALID' then raise exception 'invalid consent accepted %',bad; end if;
  end loop;
  if (select receipt_rows from jevarena_private.contribution_capacity) is distinct from initial_rows+2 then raise exception 'replay or rejection altered quota'; end if;
  r := public.jevarena_delete_contribution(public_id,repeat('b',64));
  if r->>'deleted' is distinct from 'true' then raise exception 'public withdrawal failed'; end if;
  r := public.jevarena_submit_contribution(public_id,payload,public_consent,repeat('a',64),repeat('b',64),repeat('e',64));
  if r->>'code' is distinct from 'GONE' then raise exception 'withdrawn candidate resurrected'; end if;
end;
$test$;
rollback;
