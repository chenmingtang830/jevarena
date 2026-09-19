-- ISOLATED TEST DATABASE ONLY. Apply 001, 002, 004, 006 and 007 first.
begin;
do $test$
declare
  r jsonb; feed jsonb; entry jsonb; claim uuid;
  private_id uuid := gen_random_uuid(); old_public_id uuid := gen_random_uuid();
  published_id uuid := gen_random_uuid(); held_id uuid := gen_random_uuid();
  expired_id uuid := gen_random_uuid(); waiting_id uuid := gen_random_uuid();
  private_consent jsonb := '{"version":"2026-09-19","research":true,"rights":true,"reviewed":true,"allowPublication":false}';
  old_consent jsonb := '{"version":"2026-09-19-public-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-review"}';
  consent jsonb := '{"version":"2026-09-19-auto-review-v1","research":true,"rights":true,"reviewed":true,"allowPublication":true,"publication":"after-ai-review","automatedReview":true,"reviewProvider":"vercel"}';
  payload jsonb := '{"schemaVersion":1,"id":"synthetic-test","challenge":{"schemaVersion":1,"id":"synthetic-test","kind":"judgment","language":"en","title":"Synthetic test","content":"2+2?","question":"Choose","options":[{"id":"a","label":"4"},{"id":"b","label":"5"}]},"runs":[],"humanAnswer":{"optionId":"a","revealedBeforeAnswer":false,"rationale":"PRIVATE RATIONALE"},"license":"CC-BY-4.0","status":"community-submitted","notes":"PRIVATE NOTES"}';
  fn text; role_name text; test_id uuid;
begin
  foreach role_name in array array['anon','authenticated'] loop
    foreach fn in array array['public.jevarena_claim_moderation(uuid,integer)','public.jevarena_finish_moderation(uuid,uuid,boolean,text,text)','public.jevarena_public_questions()'] loop
      if has_function_privilege(role_name,fn,'execute') then raise exception '% can execute %',role_name,fn; end if;
    end loop;
    if has_table_privilege(role_name,'jevarena_private.moderation_jobs','select') then raise exception 'jobs exposed to %',role_name; end if;
    if has_table_privilege(role_name,'jevarena_private.moderation_budget','update') then raise exception 'budget exposed to %',role_name; end if;
  end loop;
  if has_table_privilege('service_role','jevarena_private.moderation_jobs','select') then raise exception 'service direct table access'; end if;
  if exists(select 1 from pg_policies where schemaname='jevarena_private' and tablename in ('moderation_jobs','moderation_budget')) then raise exception 'unexpected browser RLS policy'; end if;

  r := public.jevarena_submit_contribution(private_id,payload,private_consent,repeat('a',64),repeat('b',64),repeat('1',64));
  if r->>'ok' is distinct from 'true' then raise exception 'private setup %',r; end if;
  r := public.jevarena_submit_contribution(old_public_id,payload,old_consent,repeat('a',64),repeat('b',64),repeat('2',64));
  if r->>'ok' is distinct from 'true' then raise exception 'old-public setup %',r; end if;
  foreach test_id in array array[published_id,held_id,expired_id,waiting_id] loop
    r := public.jevarena_submit_contribution(test_id,payload,consent,repeat('a',64),repeat('b',64),repeat('3',64));
    if r->>'ok' is distinct from 'true' then raise exception 'new consent rejected %',r; end if;
  end loop;
  foreach test_id in array array[private_id,old_public_id] loop
    r := public.jevarena_claim_moderation(test_id,1);
    if r->>'ok' is distinct from 'false' then raise exception 'legacy consent claimable'; end if;
  end loop;
  if (select reserved_cents from jevarena_private.moderation_budget) <> 0 then raise exception 'rejections spent budget'; end if;
  r := public.jevarena_claim_moderation(published_id,1);
  if r->>'ok' is distinct from 'true' then raise exception 'new consent not claimable'; end if;
  claim := (r->>'claimToken')::uuid;
  r := public.jevarena_claim_moderation(published_id,50);
  if r->>'ok' is distinct from 'false' then raise exception 'duplicate claim allowed'; end if;
  r := public.jevarena_claim_moderation(held_id,1);
  if r->>'ok' is distinct from 'false' then raise exception 'lifetime one-cent cap exceeded'; end if;
  if (select reserved_cents from jevarena_private.moderation_budget) <> 1 then raise exception 'one claim must reserve one cent'; end if;
  if public.jevarena_public_questions()->'items' <> '[]'::jsonb then raise exception 'processing contribution public'; end if;
  r := public.jevarena_finish_moderation(published_id,gen_random_uuid(),true,'Safe','typesafe-ai/jev');
  if r->>'ok' is distinct from 'false' then raise exception 'wrong claim token accepted'; end if;
  r := public.jevarena_finish_moderation(published_id,claim,true,'Safe','wrong-model');
  if r->>'ok' is distinct from 'false' then raise exception 'wrong reviewer accepted'; end if;
  r := public.jevarena_finish_moderation(published_id,claim,true,'Safe','typesafe-ai/jev');
  if r->>'ok' is distinct from 'true' then raise exception 'publication failed'; end if;
  r := public.jevarena_finish_moderation(published_id,claim,false,'Changed mind','typesafe-ai/jev');
  if r->>'ok' is distinct from 'false' then raise exception 'completed claim overwritten'; end if;
  feed := public.jevarena_public_questions();
  if jsonb_array_length(feed->'items') <> 1 then raise exception 'published result missing'; end if;
  entry := feed->'items'->0;
  if entry->'challenge' <> payload->'challenge' or entry->>'id' <> published_id::text then raise exception 'wrong public challenge'; end if;
  if (select array_agg(key order by key) from jsonb_object_keys(entry) key) <> array['challenge','id','license','moderation','sourceAttributions','submittedAt'] then raise exception 'unexpected public fields'; end if;
  if feed::text like '%PRIVATE%' or entry ?| array['payload','consent','claimToken','deletion_token_hash','payload_hash','humanAnswer','runs'] then raise exception 'private metadata leaked'; end if;

  r := public.jevarena_claim_moderation(held_id,4); claim := (r->>'claimToken')::uuid;
  r := public.jevarena_finish_moderation(held_id,claim,false,'Hold','typesafe-ai/jev');
  if r->>'ok' is distinct from 'true' then raise exception 'hold failed'; end if;
  r := public.jevarena_claim_moderation(expired_id,4); claim := (r->>'claimToken')::uuid;
  r := public.jevarena_finish_moderation(expired_id,claim,true,'Safe','typesafe-ai/jev');
  update jevarena_private.contributions set expires_at=now()-interval '1 minute' where id=expired_id;
  r := public.jevarena_claim_moderation(waiting_id,4);
  if r->>'ok' is distinct from 'true' then raise exception 'waiting setup failed'; end if;
  if jsonb_array_length(public.jevarena_public_questions()->'items') <> 1 then raise exception 'held/expired/processing became public'; end if;
  r := public.jevarena_delete_contribution(published_id,repeat('b',64));
  if r->>'deleted' is distinct from 'true' then raise exception 'withdrawal failed'; end if;
  if public.jevarena_public_questions()->'items' <> '[]'::jsonb then raise exception 'withdrawal did not immediately remove public question'; end if;
  if (select reserved_cents from jevarena_private.moderation_budget) <> 4 then raise exception 'failed/withdrawn attempts refunded'; end if;
end;
$test$;
rollback;
