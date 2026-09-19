-- Private, opt-in community research intake. Does not expose a public case table.
-- Run once through an authorized Supabase migration connection. No API keys here.
begin;

create schema if not exists jevarena_private;
revoke all on schema jevarena_private from public, anon, authenticated;

create table jevarena_private.contributions (
  id uuid primary key,
  payload jsonb,
  consent jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  deletion_token_hash text not null check (deletion_token_hash ~ '^[a-f0-9]{64}$'),
  evidence_status text not null default 'community-submitted'
    check (evidence_status = 'community-submitted'),
  received_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  deleted_at timestamptz,
  check (payload is null or octet_length(payload::text) <= 131072),
  check ((deleted_at is null) = (payload is not null)),
  check (consent = '{"version":"2026-09-19","research":true,"rights":true,"reviewed":true,"allowPublication":false}'::jsonb)
);
create index contributions_expiry on jevarena_private.contributions(expires_at);
create table jevarena_private.contribution_daily_limits (
  day date primary key,
  accepted integer not null check (accepted between 0 and 200)
);
create table jevarena_private.contribution_ip_limits (
  hour timestamptz not null,
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  accepted integer not null check (accepted between 0 and 5),
  primary key (hour, ip_hash)
);
alter table jevarena_private.contributions enable row level security;
alter table jevarena_private.contribution_daily_limits enable row level security;
alter table jevarena_private.contribution_ip_limits enable row level security;
revoke all on all tables in schema jevarena_private from public, anon, authenticated, service_role;
alter default privileges in schema jevarena_private revoke all on tables from public, anon, authenticated;

-- There are deliberately no RLS policies for browser roles and no public reads.
create function public.jevarena_purge_contributions() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from jevarena_private.contributions where expires_at <= now();
  delete from jevarena_private.contribution_daily_limits where day < (now() at time zone 'UTC')::date;
  delete from jevarena_private.contribution_ip_limits where hour < date_trunc('hour', now()) - interval '1 hour';
end;
$$;

create function public.jevarena_submit_contribution(
  p_id uuid, p_payload jsonb, p_consent jsonb, p_payload_hash text,
  p_deletion_token_hash text, p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  existing jevarena_private.contributions%rowtype;
  receipt jevarena_private.contributions%rowtype;
  current_day date := (now() at time zone 'UTC')::date;
  current_hour timestamptz := date_trunc('hour', now());
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
  -- A database transaction lock serializes duplicate checking, quotas, and insert
  -- across every Vercel instance. Counter failure rolls back the whole request.
  perform pg_advisory_xact_lock(19650919, 1);
  perform public.jevarena_purge_contributions();
  select * into existing from jevarena_private.contributions where id = p_id;
  if found then
    if existing.deletion_token_hash <> p_deletion_token_hash
       or existing.payload_hash <> p_payload_hash or existing.consent <> p_consent then
      return jsonb_build_object('ok', false, 'code', 'CONFLICT');
    end if;
    if existing.deleted_at is not null then
      return jsonb_build_object('ok', false, 'code', 'GONE');
    end if;
    if existing.payload <> p_payload then
      return jsonb_build_object('ok', false, 'code', 'CONFLICT');
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'receiptId', existing.id,
      'receivedAt', existing.received_at, 'expiresAt', existing.expires_at);
  end if;
  if (select count(*) from jevarena_private.contributions) >= 1000
     or coalesce((select accepted from jevarena_private.contribution_daily_limits where day = current_day), 0) >= 200
     or coalesce((select accepted from jevarena_private.contribution_ip_limits where hour = current_hour and ip_hash = p_ip_hash), 0) >= 5 then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMIT');
  end if;
  insert into jevarena_private.contribution_daily_limits(day, accepted) values(current_day, 1)
    on conflict (day) do update set accepted = jevarena_private.contribution_daily_limits.accepted + 1;
  insert into jevarena_private.contribution_ip_limits(hour, ip_hash, accepted) values(current_hour, p_ip_hash, 1)
    on conflict (hour, ip_hash) do update set accepted = jevarena_private.contribution_ip_limits.accepted + 1;
  insert into jevarena_private.contributions(id, payload, consent, payload_hash, deletion_token_hash)
    values(p_id, p_payload, p_consent, p_payload_hash, p_deletion_token_hash)
    returning * into receipt;
  return jsonb_build_object('ok', true, 'duplicate', false, 'receiptId', receipt.id,
    'receivedAt', receipt.received_at, 'expiresAt', receipt.expires_at);
end;
$$;

create function public.jevarena_delete_contribution(p_id uuid, p_deletion_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing jevarena_private.contributions%rowtype;
begin
  if p_id is null or p_deletion_token_hash is null or p_deletion_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID');
  end if;
  perform pg_advisory_xact_lock(19650919, 1);
  perform public.jevarena_purge_contributions();
  select * into existing from jevarena_private.contributions where id = p_id;
  if not found then return jsonb_build_object('ok', true, 'deleted', true); end if;
  if existing.deletion_token_hash <> p_deletion_token_hash then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  -- Keep only a bounded tombstone until original expiry so a timed-out submit
  -- retry cannot recreate a payload the contributor has already withdrawn.
  update jevarena_private.contributions set payload = null, deleted_at = coalesce(deleted_at, now()) where id = p_id;
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

-- Schedule after pg_cron has been enabled by the operator (not assumed here):
-- select cron.schedule('jevarena-private-retention', '17 * * * *',
--   'select public.jevarena_purge_contributions()');
