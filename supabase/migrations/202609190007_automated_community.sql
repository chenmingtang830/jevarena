-- Automated review is a NEW permission; never process legacy submissions.
begin;
alter table jevarena_private.contributions drop constraint contributions_consent_check,
  add constraint contributions_consent_check check (consent in (
    '{"version":"2026-09-19","research":true,"rights":true,"reviewed":true,"allowPublication":false}'::jsonb,
    '{"version":"2026-09-19-public-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-review"}'::jsonb,
    '{"version":"2026-09-19-auto-review-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-ai-review","automatedReview":true,"reviewProvider":"vercel"}'::jsonb
  ));
-- Preserve the existing quota/withdrawal implementation exactly, expanding only
-- its explicit consent allowlist. Abort if the expected migration-006 body drifted.
do $migration$
declare original text; changed text;
begin
  original := pg_get_functiondef('public.jevarena_submit_contribution(uuid,jsonb,jsonb,text,text,text)'::regprocedure);
  changed := replace(original,
    'and p_consent is distinct from ''{"version":"2026-09-19-public-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-review"}''::jsonb)',
    'and p_consent is distinct from ''{"version":"2026-09-19-public-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-review"}''::jsonb and p_consent is distinct from ''{"version":"2026-09-19-auto-review-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-ai-review","automatedReview":true,"reviewProvider":"vercel"}''::jsonb)');
  if changed = original then raise exception 'Consent allowlist migration precondition failed'; end if;
  execute changed;
end;
$migration$;

create table jevarena_private.moderation_budget (
  singleton boolean primary key default true check(singleton),
  reserved_cents integer not null default 0 check(reserved_cents between 0 and 5000)
);
insert into jevarena_private.moderation_budget(singleton) values(true);
create table jevarena_private.moderation_jobs (
  contribution_id uuid primary key references jevarena_private.contributions(id) on delete cascade,
  claim_token uuid not null default gen_random_uuid(),
  status text not null default 'processing' check(status in ('processing','published','held')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb
);
alter table jevarena_private.moderation_budget enable row level security;
alter table jevarena_private.moderation_jobs enable row level security;
revoke all on jevarena_private.moderation_budget,jevarena_private.moderation_jobs from public,anon,authenticated,service_role;

create function public.jevarena_claim_moderation(p_id uuid,p_total_limit_cents integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jevarena_private.contributions%rowtype; token uuid; reserved integer;
begin
  if p_total_limit_cents is null or p_total_limit_cents < 1 or p_total_limit_cents > 5000 then return jsonb_build_object('ok',false); end if;
  select reserved_cents into reserved from jevarena_private.moderation_budget where singleton for update;
  if reserved is null or reserved >= p_total_limit_cents then return jsonb_build_object('ok',false); end if;
  select * into item from jevarena_private.contributions where id=p_id and deleted_at is null and expires_at>now();
  if not found or item.consent is distinct from '{"version":"2026-09-19-auto-review-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-ai-review","automatedReview":true,"reviewProvider":"vercel"}'::jsonb then return jsonb_build_object('ok',false); end if;
  if exists(select 1 from jevarena_private.moderation_jobs where contribution_id=p_id) then return jsonb_build_object('ok',false); end if;
  insert into jevarena_private.moderation_jobs(contribution_id) values(p_id) returning claim_token into token;
  -- Reserve one cent per attempt, including failures, before any network call.
  -- Never refund unknown charges or retry automatically. Cap is lifetime, not daily.
  update jevarena_private.moderation_budget set reserved_cents=reserved_cents+1 where singleton;
  return jsonb_build_object('ok',true,'id',p_id,'claimToken',token,'payload',item.payload,'consent',item.consent);
end;
$$;
create function public.jevarena_finish_moderation(p_id uuid,p_claim_token uuid,p_publish boolean,p_reason text,p_model text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_reason is null or length(p_reason)<1 or length(p_reason)>500 or p_model is distinct from 'typesafe-ai/jev' then return jsonb_build_object('ok',false); end if;
  update jevarena_private.moderation_jobs set status=case when p_publish is true then 'published' else 'held' end,
    finished_at=now(),result=jsonb_build_object('decision',case when p_publish is true then 'publish' else 'hold' end,'reason',p_reason,'model',p_model)
    where contribution_id=p_id and claim_token=p_claim_token and status='processing';
  return jsonb_build_object('ok',found);
end;
$$;
create function public.jevarena_public_questions() returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('items',coalesce(jsonb_agg(item order by received_at desc),'[]'::jsonb)) from (
    select c.received_at,jsonb_build_object('id',c.id,'challenge',c.payload->'challenge','submittedAt',c.received_at,
      'moderation',j.result,'license',c.payload->'license','sourceAttributions',coalesce(c.payload->'sourceAttributions','[]'::jsonb)) as item
    from jevarena_private.contributions c join jevarena_private.moderation_jobs j on j.contribution_id=c.id
    where j.status='published' and c.deleted_at is null and c.expires_at>now()
      and c.consent->>'version'='2026-09-19-auto-review-v1'
    order by c.received_at desc limit 20
  ) published;
$$;
revoke all on function public.jevarena_claim_moderation(uuid,integer), public.jevarena_finish_moderation(uuid,uuid,boolean,text,text),public.jevarena_public_questions() from public,anon,authenticated;
grant execute on function public.jevarena_claim_moderation(uuid,integer), public.jevarena_finish_moderation(uuid,uuid,boolean,text,text),public.jevarena_public_questions() to service_role;
commit;
