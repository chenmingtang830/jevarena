-- Unknown receipts must not report success: an original submit may still be
-- in flight and acquire the intake lock after this withdrawal request.
begin;
create or replace function public.jevarena_delete_contribution(p_id uuid, p_deletion_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing jevarena_private.contributions%rowtype;
begin
  if p_id is null or p_deletion_token_hash is null or p_deletion_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID');
  end if;
  perform pg_advisory_xact_lock(19650919, 1);
  perform public.jevarena_purge_contributions();
  select * into existing from jevarena_private.contributions where id = p_id;
  if not found or existing.deletion_token_hash <> p_deletion_token_hash then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  update jevarena_private.contributions set payload = null, deleted_at = coalesce(deleted_at, now()) where id = p_id;
  return jsonb_build_object('ok', true, 'deleted', true);
end;
$$;
revoke all on function public.jevarena_delete_contribution(uuid,text) from public, anon, authenticated;
grant execute on function public.jevarena_delete_contribution(uuid,text) to service_role;
commit;
