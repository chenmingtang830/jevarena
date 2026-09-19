-- Pro-tier bounded intake. Enable only after operator-approved plan provisioning.
-- 10,000/day is an admission target, not a promise
-- that 10,000 maximum-size payloads fit the storage budget or hosting quota.
begin;
alter table jevarena_private.contributions
  add column payload_bytes bigint not null default 0 check (payload_bytes >= 0);
update jevarena_private.contributions
  set payload_bytes = coalesce(octet_length(payload::text), 0),
      expires_at = received_at + interval '30 days';
alter table jevarena_private.contributions alter column expires_at set default now() + interval '30 days';
alter table jevarena_private.contributions set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 50,
  toast.autovacuum_vacuum_scale_factor = 0.05,
  toast.autovacuum_vacuum_threshold = 50
);
alter table jevarena_private.contribution_daily_limits
  drop constraint contribution_daily_limits_accepted_check,
  add constraint contribution_daily_limits_accepted_check check (accepted between 0 and 10000);
alter table jevarena_private.contribution_ip_limits
  drop constraint contribution_ip_limits_accepted_check,
  add constraint contribution_ip_limits_accepted_check check (accepted between 0 and 100);

create table jevarena_private.contribution_capacity (
  singleton boolean primary key default true check (singleton),
  receipt_rows bigint not null check (receipt_rows between 0 and 310000),
  active_payload_bytes bigint not null check (active_payload_bytes between 0 and 5368709120),
  observed_database_bytes bigint not null check (observed_database_bytes >= 0),
  storage_paused boolean not null,
  storage_checked_at timestamptz not null default now()
);
insert into jevarena_private.contribution_capacity(singleton, receipt_rows, active_payload_bytes, observed_database_bytes, storage_paused)
  select true, count(*), coalesce(sum(payload_bytes), 0), pg_database_size(current_database()),
    pg_database_size(current_database()) >= 6442450944 from jevarena_private.contributions;
alter table jevarena_private.contribution_capacity enable row level security;
revoke all on jevarena_private.contribution_capacity from public, anon, authenticated, service_role;

-- Lock order everywhere is capacity -> receipts -> counters. The fixed row lock
-- makes quota changes atomic without any per-request count(*) table scan.
create function jevarena_private.purge_expired_contributions(p_limit integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare removed_rows bigint; removed_bytes bigint;
begin
  if p_limit < 1 or p_limit > 1000 then raise exception 'Invalid purge limit'; end if;
  perform 1 from jevarena_private.contribution_capacity where singleton = true for update;
  with due as (
    select id from jevarena_private.contributions where expires_at <= now()
    order by expires_at limit p_limit for update skip locked
  ), removed as (
    delete from jevarena_private.contributions c using due where c.id = due.id returning c.payload_bytes
  ) select count(*), coalesce(sum(payload_bytes), 0) into removed_rows, removed_bytes from removed;
  update jevarena_private.contribution_capacity
    set receipt_rows = receipt_rows - removed_rows, active_payload_bytes = active_payload_bytes - removed_bytes
    where singleton = true;
  return removed_rows;
end;
$$;
revoke all on function jevarena_private.purge_expired_contributions(integer) from public, anon, authenticated, service_role;

create or replace function public.jevarena_purge_contributions() returns void
language plpgsql security definer set search_path = '' as $$
declare database_bytes bigint;
begin
  perform jevarena_private.purge_expired_contributions(1000);
  delete from jevarena_private.contribution_daily_limits where day < (now() at time zone 'UTC')::date;
  delete from jevarena_private.contribution_ip_limits where hour < date_trunc('hour', now()) - interval '1 hour';
  database_bytes := pg_database_size(current_database());
  update jevarena_private.contribution_capacity
    set observed_database_bytes = database_bytes, storage_paused = database_bytes >= 6442450944,
        storage_checked_at = now() where singleton = true;
end;
$$;

create or replace function public.jevarena_submit_contribution(
  p_id uuid, p_payload jsonb, p_consent jsonb, p_payload_hash text,
  p_deletion_token_hash text, p_ip_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  existing jevarena_private.contributions%rowtype;
  receipt jevarena_private.contributions%rowtype;
  capacity jevarena_private.contribution_capacity%rowtype;
  current_day date := (now() at time zone 'UTC')::date;
  current_hour timestamptz := date_trunc('hour', now());
  incoming_bytes bigint;
  current_database_bytes bigint;
begin
  if p_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 131072
     or p_payload->>'status' is distinct from 'community-submitted'
     or p_payload->>'license' is distinct from 'CC-BY-4.0'
     or p_consent is distinct from '{"version":"2026-09-19","research":true,"rights":true,"reviewed":true,"allowPublication":false}'::jsonb
     or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$'
     or p_deletion_token_hash is null or p_deletion_token_hash !~ '^[a-f0-9]{64}$'
     or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID');
  end if;
  incoming_bytes := octet_length(p_payload::text);
  perform jevarena_private.purge_expired_contributions(100);
  select * into capacity from jevarena_private.contribution_capacity where singleton = true for update;
  if not found then raise exception 'Capacity state missing'; end if;
  select * into existing from jevarena_private.contributions where id = p_id;
  if found then
    if existing.deletion_token_hash <> p_deletion_token_hash
       or existing.payload_hash <> p_payload_hash or existing.consent <> p_consent then
      return jsonb_build_object('ok', false, 'code', 'CONFLICT');
    end if;
    if existing.deleted_at is not null or existing.expires_at <= now() then
      return jsonb_build_object('ok', false, 'code', 'GONE');
    end if;
    if existing.payload <> p_payload then return jsonb_build_object('ok', false, 'code', 'CONFLICT'); end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'receiptId', existing.id,
      'receivedAt', existing.received_at, 'expiresAt', existing.expires_at);
  end if;
  -- Recheck physical allocation for EVERY new submission. Logical withdrawal
  -- does not immediately reclaim physical space, so a cron-only sample would
  -- allow rapid delete/recreate churn to fill the plan before the next sample.
  current_database_bytes := pg_database_size(current_database());
  update jevarena_private.contribution_capacity
    set observed_database_bytes = current_database_bytes,
        storage_paused = current_database_bytes >= 6442450944 where singleton = true;
  -- Keep storage_checked_at as the scheduled cleanup heartbeat: per-request
  -- measurements must not hide a failed purge scheduler.
  if current_database_bytes >= 6442450944 or capacity.storage_checked_at < now() - interval '15 minutes'
     or capacity.receipt_rows >= 310000 or capacity.active_payload_bytes + incoming_bytes > 5368709120
     or coalesce((select accepted from jevarena_private.contribution_daily_limits where day = current_day), 0) >= 10000
     or coalesce((select accepted from jevarena_private.contribution_ip_limits where hour = current_hour and ip_hash = p_ip_hash), 0) >= 100 then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMIT');
  end if;
  insert into jevarena_private.contribution_daily_limits(day, accepted) values(current_day, 1)
    on conflict (day) do update set accepted = jevarena_private.contribution_daily_limits.accepted + 1;
  insert into jevarena_private.contribution_ip_limits(hour, ip_hash, accepted) values(current_hour, p_ip_hash, 1)
    on conflict (hour, ip_hash) do update set accepted = jevarena_private.contribution_ip_limits.accepted + 1;
  insert into jevarena_private.contributions(id, payload, consent, payload_hash, deletion_token_hash, payload_bytes)
    values(p_id, p_payload, p_consent, p_payload_hash, p_deletion_token_hash, incoming_bytes) returning * into receipt;
  update jevarena_private.contribution_capacity
    set receipt_rows = receipt_rows + 1, active_payload_bytes = active_payload_bytes + incoming_bytes where singleton = true;
  return jsonb_build_object('ok', true, 'duplicate', false, 'receiptId', receipt.id,
    'receivedAt', receipt.received_at, 'expiresAt', receipt.expires_at);
end;
$$;

create or replace function public.jevarena_delete_contribution(p_id uuid, p_deletion_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing jevarena_private.contributions%rowtype;
begin
  if p_id is null or p_deletion_token_hash is null or p_deletion_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID');
  end if;
  perform jevarena_private.purge_expired_contributions(100);
  select * into existing from jevarena_private.contributions where id = p_id;
  if not found or existing.deletion_token_hash <> p_deletion_token_hash then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  update jevarena_private.contributions set payload = null, payload_bytes = 0,
    deleted_at = coalesce(deleted_at, now()) where id = p_id;
  update jevarena_private.contribution_capacity set active_payload_bytes = active_payload_bytes - existing.payload_bytes where singleton = true;
  return jsonb_build_object('ok', true, 'deleted', true);
end;
$$;

revoke all on function public.jevarena_purge_contributions() from public, anon, authenticated;
revoke all on function public.jevarena_submit_contribution(uuid,jsonb,jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.jevarena_delete_contribution(uuid,text) from public, anon, authenticated;
grant execute on function public.jevarena_purge_contributions() to service_role;
grant execute on function public.jevarena_submit_contribution(uuid,jsonb,jsonb,text,text,text) to service_role;
grant execute on function public.jevarena_delete_contribution(uuid,text) to service_role;
commit;

-- 003 enables pg_cron in Supabase. Isolated local tests may omit that extension.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('jevarena-private-retention', '*/5 * * * *',
      'select public.jevarena_purge_contributions()');
  end if;
end; $$;
-- If this check stops running for 15 minutes, NEW intake fails closed.
-- Existing-receipt duplicate responses and withdrawal still remain available.
