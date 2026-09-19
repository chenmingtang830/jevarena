-- Public permission is a review candidate, NOT public database access.
-- Additive consent version: existing private submissions retain their exact consent.
-- Apply after 005. This migration does not publish or transform any stored payload.
begin;
alter table jevarena_private.contributions
  drop constraint contributions_consent_check,
  add constraint contributions_consent_check check (
    consent = '{"version":"2026-09-19","research":true,"rights":true,"reviewed":true,"allowPublication":false}'::jsonb
    or consent = '{"version":"2026-09-19-public-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-review"}'::jsonb
  );

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
     or (p_consent is distinct from '{"version":"2026-09-19","research":true,"rights":true,"reviewed":true,"allowPublication":false}'::jsonb
         and p_consent is distinct from '{"version":"2026-09-19-public-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-review"}'::jsonb)
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

-- CREATE OR REPLACE preserves the restricted RPC privileges from 004.
-- No new table grants, RLS policies, public views, or read RPCs.
commit;

