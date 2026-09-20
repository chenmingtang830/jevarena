-- A held automated screen is never an implicit approval. The queue stays in the
-- private schema; only an operator using the service credential can resolve it.
begin;

alter table jevarena_private.moderation_jobs
  drop constraint moderation_jobs_status_check,
  add constraint moderation_jobs_status_check check (status in ('processing','published','held','rejected')),
  add column human_reviewer text,
  add column human_reason text,
  add column human_reviewed_at timestamptz,
  add constraint moderation_jobs_human_review_check check (
    (human_reviewer is null and human_reason is null and human_reviewed_at is null)
    or (human_reviewer is not null and human_reason is not null and human_reviewed_at is not null)
  );

create function public.jevarena_list_held_moderation(p_limit integer default 25) returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('items',coalesce(jsonb_agg(item order by received_at asc),'[]'::jsonb)) from (
    select c.received_at, jsonb_build_object(
      'id',c.id,
      'receivedAt',c.received_at,
      'expiresAt',c.expires_at,
      'challenge',c.payload->'challenge',
      'sourceAttributions',coalesce(c.payload->'sourceAttributions','[]'::jsonb),
      'screening',j.result
    ) as item
    from jevarena_private.contributions c
    join jevarena_private.moderation_jobs j on j.contribution_id=c.id
    where p_limit between 1 and 100 and j.status='held' and c.deleted_at is null and c.expires_at>now()
    order by c.received_at asc limit p_limit
  ) held;
$$;

create function public.jevarena_resolve_held_moderation(
  p_id uuid,p_decision text,p_reviewer text,p_reason text
) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_id is null or p_decision not in ('publish','reject')
     or p_reviewer is null or p_reviewer !~ '^[A-Za-z0-9@._ -]{2,80}$'
     or p_reason is null or length(p_reason) not between 10 and 1000
     or p_reason ~ '[[:cntrl:]]' then
    return jsonb_build_object('ok',false,'code','INVALID');
  end if;

  update jevarena_private.moderation_jobs j
    set status=case when p_decision='publish' then 'published' else 'rejected' end,
      human_reviewer=p_reviewer,human_reason=p_reason,human_reviewed_at=now(),
      result=case when p_decision='publish' then jsonb_build_object(
        'decision','publish',
        'reason','Published after human review. Community submissions remain unverified.',
        'model',coalesce(j.result->>'model','typesafe-ai/jev'),
        'humanReviewed',true
      ) else j.result || jsonb_build_object('humanReviewed',true,'humanDecision','reject') end
    from jevarena_private.contributions c
    where j.contribution_id=p_id and c.id=p_id and j.status='held'
      and c.deleted_at is null and c.expires_at>now();
  return jsonb_build_object('ok',found,'decision',p_decision);
end;
$$;

revoke all on function public.jevarena_list_held_moderation(integer),public.jevarena_resolve_held_moderation(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.jevarena_list_held_moderation(integer),public.jevarena_resolve_held_moderation(uuid,text,text,text) to service_role;
commit;
