-- Optional signed-in history. User JWT RPCs only; no service-role history client.
-- Private history grants neither research consent nor publication permission.
begin;
create function jevarena_private.history_keys(value jsonb, allowed text[], required text[])
returns boolean language plpgsql immutable set search_path = '' as $$
declare item text;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  if not (value ?& required) then return false; end if;
  for item in select jsonb_object_keys(value) loop
    if not (item = any(allowed)) then return false; end if;
  end loop;
  return true;
end; $$;

-- Defend direct authenticated RPC calls as well as the application's stricter
-- TS schema/hash validator. All nested object fields are allowlisted; opaque
-- provider responses and credential/config objects have no storage field.
create function jevarena_private.history_payload_safe(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare c jsonb; r jsonb; o jsonb; v jsonb; k text;
begin
  if value is null or octet_length(value::text)>65536
    or not jevarena_private.history_keys(value,array['challenge','runs','vote'],array['challenge','runs']) then return false; end if;
  if value::text ~* '(sk-or-v1-[A-Za-z0-9_-]{16,}|sk-ant-api[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]{16,}|sk_(live|test)_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)' then return false; end if;
  c := value->'challenge';
  if c->>'kind' = 'judgment' then
    if not jevarena_private.history_keys(c,array['schemaVersion','id','title','language','expected','basis','source','kind','content','question','options'],array['schemaVersion','id','title','language','kind','content','question','options']) then return false; end if;
    if jsonb_typeof(c->'options') is distinct from 'array' or jsonb_array_length(c->'options') not between 2 and 10 then return false; end if;
    for o in select jsonb_array_elements(c->'options') loop
      if not jevarena_private.history_keys(o,array['id','label'],array['id','label']) or jsonb_typeof(o->'id') is distinct from 'string' or jsonb_typeof(o->'label') is distinct from 'string' then return false; end if;
    end loop;
    if jsonb_typeof(c->'content') is distinct from 'string' or jsonb_typeof(c->'question') is distinct from 'string' then return false; end if;
  elsif c->>'kind' = 'comparison' then
    if not jevarena_private.history_keys(c,array['schemaVersion','id','title','language','expected','basis','source','kind','prompt','answer1','answer2'],array['schemaVersion','id','title','language','kind','prompt','answer1','answer2']) then return false; end if;
    if jsonb_typeof(c->'prompt') is distinct from 'string' or jsonb_typeof(c->'answer1') is distinct from 'string' or jsonb_typeof(c->'answer2') is distinct from 'string' then return false; end if;
  else return false; end if;
  if c->'schemaVersion' is distinct from '1'::jsonb then return false; end if;
  foreach k in array array['id','title','language','expected','basis','source'] loop
    if c ? k and jsonb_typeof(c->k) is distinct from 'string' then return false; end if;
  end loop;
  if char_length(c->>'title') not between 1 and 160 or char_length(c->>'language') not between 2 and 40 then return false; end if;
  if jsonb_typeof(value->'runs') is distinct from 'array' or jsonb_array_length(value->'runs')>20 then return false; end if;
  for r in select jsonb_array_elements(value->'runs') loop
    if not jevarena_private.history_keys(r,array['schemaVersion','id','challengeId','challengeHash','provider','model','resolvedModel','promptVersion','createdAt','choice','probabilities','confidence','usage','cost','latencyMs','status','error','settings'],array['schemaVersion','id','challengeId','challengeHash','provider','model','resolvedModel','promptVersion','createdAt','choice','usage','cost','latencyMs','status']) then return false; end if;
    if not jevarena_private.history_keys(r->'usage',array['inputTokens','outputTokens'],array['inputTokens','outputTokens']) or not jevarena_private.history_keys(r->'cost',array['usd','basis'],array['usd','basis']) then return false; end if;
    if r ? 'settings' and not jevarena_private.history_keys(r->'settings',array['maxOutputTokens','transport','reasoning','temperature'],array[]::text[]) then return false; end if;
    if r ? 'probabilities' then
      if jsonb_typeof(r->'probabilities') is distinct from 'object' then return false; end if;
      for v in select x.value from jsonb_each(r->'probabilities') x loop
        if jsonb_typeof(v) is distinct from 'number' then return false; end if;
      end loop;
    end if;
    foreach k in array array['id','challengeId','challengeHash','provider','model','promptVersion','createdAt','status','error'] loop
      if r ? k and jsonb_typeof(r->k) is distinct from 'string' then return false; end if;
    end loop;
    foreach k in array array['resolvedModel','choice'] loop
      if jsonb_typeof(r->k) not in ('string','null') then return false; end if;
    end loop;
    if r->'schemaVersion' is distinct from '1'::jsonb or jsonb_typeof(r->'latencyMs') is distinct from 'number' then return false; end if;
    if r ? 'confidence' and jsonb_typeof(r->'confidence') is distinct from 'number' then return false; end if;
    for v in select x.value from jsonb_each(r->'usage') x loop
      if jsonb_typeof(v) not in ('number','null') then return false; end if;
    end loop;
    if jsonb_typeof(r->'cost'->'usd') not in ('number','null') or jsonb_typeof(r->'cost'->'basis') is distinct from 'string' then return false; end if;
    if r ? 'settings' then
      foreach k in array array['transport','reasoning'] loop
        if r->'settings' ? k and jsonb_typeof(r->'settings'->k) is distinct from 'string' then return false; end if;
      end loop;
      foreach k in array array['maxOutputTokens','temperature'] loop
        if r->'settings' ? k and jsonb_typeof(r->'settings'->k) is distinct from 'number' then return false; end if;
      end loop;
    end if;
  end loop;
  if value ? 'vote' then
    v := value->'vote';
    if not jevarena_private.history_keys(v,array['runIds','value','revealedBeforeVote'],array['runIds','value','revealedBeforeVote']) or jsonb_typeof(v->'runIds') is distinct from 'array' or jsonb_array_length(v->'runIds')<>2 or jsonb_typeof(v->'value') is distinct from 'string' or jsonb_typeof(v->'revealedBeforeVote') is distinct from 'boolean' then return false; end if;
    for o in select jsonb_array_elements(v->'runIds') loop
      if jsonb_typeof(o) is distinct from 'string' then return false; end if;
    end loop;
  end if;
  return true;
exception when others then return false;
end; $$;

create table jevarena_private.history_capacity (
  singleton boolean primary key default true check(singleton),
  rows_count bigint not null default 0 check(rows_count between 0 and 100000),
  payload_bytes bigint not null default 0 check(payload_bytes between 0 and 536870912)
);
insert into jevarena_private.history_capacity(singleton) values(true);
create table jevarena_private.history (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check(jevarena_private.history_payload_safe(payload)),
  payload_bytes bigint generated always as (octet_length(payload::text)) stored,
  consent jsonb not null check(consent='{"version":"2026-09-19","savePrivate":true}'::jsonb),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days'
);
create index history_owner_created on jevarena_private.history(user_id,created_at desc,id desc);
create index history_expiry on jevarena_private.history(expires_at);
alter table jevarena_private.history enable row level security;
alter table jevarena_private.history_capacity enable row level security;
create policy history_owner_read on jevarena_private.history for select to authenticated
  using((select auth.uid())=user_id and expires_at>now());
create policy history_owner_insert on jevarena_private.history for insert to authenticated
  with check((select auth.uid())=user_id);
create policy history_owner_delete on jevarena_private.history for delete to authenticated
  using((select auth.uid())=user_id);
revoke all on jevarena_private.history,jevarena_private.history_capacity from public,anon,authenticated,service_role;

-- Counters track FK account deletion as well as explicit withdrawal/expiry.
create function jevarena_private.history_capacity_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    update jevarena_private.history_capacity set rows_count=rows_count+1,payload_bytes=payload_bytes+new.payload_bytes where singleton=true;
    return new;
  end if;
  update jevarena_private.history_capacity set rows_count=rows_count-1,payload_bytes=payload_bytes-old.payload_bytes where singleton=true;
  return old;
end; $$;
create trigger history_capacity_insert after insert on jevarena_private.history for each row execute function jevarena_private.history_capacity_change();
create trigger history_capacity_delete after delete on jevarena_private.history for each row execute function jevarena_private.history_capacity_change();

create function public.jevarena_history_save(p_id uuid,p_history jsonb,p_consent jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); existing jevarena_private.history%rowtype; saved jevarena_private.history%rowtype; capacity jevarena_private.history_capacity%rowtype;
begin
  if owner_id is null then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  if p_id is null or p_consent is distinct from '{"version":"2026-09-19","savePrivate":true}'::jsonb or not jevarena_private.history_payload_safe(p_history) then return jsonb_build_object('ok',false,'code','INVALID'); end if;
  select * into capacity from jevarena_private.history_capacity where singleton=true for update;
  if not found then raise exception 'History capacity unavailable'; end if;
  delete from jevarena_private.history where user_id=owner_id and expires_at<=now();
  select * into existing from jevarena_private.history where id=p_id;
  if found then
    if existing.user_id<>owner_id then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
    if existing.payload<>p_history or existing.consent<>p_consent then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
    return jsonb_build_object('ok',true,'duplicate',true,'item',jsonb_build_object('id',existing.id,'history',existing.payload,'createdAt',existing.created_at,'expiresAt',existing.expires_at));
  end if;
  select * into capacity from jevarena_private.history_capacity where singleton=true;
  if capacity.rows_count>=100000 or capacity.payload_bytes+octet_length(p_history::text)>536870912 or pg_database_size(current_database())>=6442450944
     or (select count(*) from jevarena_private.history where user_id=owner_id)>=100 then return jsonb_build_object('ok',false,'code','CAPACITY'); end if;
  insert into jevarena_private.history(id,user_id,payload,consent) values(p_id,owner_id,p_history,p_consent) returning * into saved;
  return jsonb_build_object('ok',true,'duplicate',false,'item',jsonb_build_object('id',saved.id,'history',saved.payload,'createdAt',saved.created_at,'expiresAt',saved.expires_at));
end; $$;

create function public.jevarena_history_list(p_limit integer default 21,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); items jsonb;
begin
  if owner_id is null then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  if p_limit is null or p_limit<1 or p_limit>21 or ((p_before is null)<>(p_before_id is null)) then return jsonb_build_object('ok',false,'code','INVALID'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'title',h.payload->'challenge'->>'title','language',h.payload->'challenge'->>'language','kind',h.payload->'challenge'->>'kind','createdAt',h.created_at,'expiresAt',h.expires_at) order by h.created_at desc,h.id desc),'[]'::jsonb) into items
    from (select * from jevarena_private.history where user_id=owner_id and expires_at>now() and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit p_limit) h;
  return jsonb_build_object('ok',true,'items',items);
end; $$;

create function public.jevarena_history_read(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); saved jevarena_private.history%rowtype;
begin
  if owner_id is null then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  select * into saved from jevarena_private.history where id=p_id and user_id=owner_id and expires_at>now();
  if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
  return jsonb_build_object('ok',true,'item',jsonb_build_object('id',saved.id,'history',saved.payload,'createdAt',saved.created_at,'expiresAt',saved.expires_at));
end; $$;

create function public.jevarena_history_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); removed uuid;
begin
  if owner_id is null then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  perform 1 from jevarena_private.history_capacity where singleton=true for update;
  delete from jevarena_private.history where id=p_id and user_id=owner_id returning id into removed;
  if removed is null then return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
  return jsonb_build_object('ok',true,'deleted',true);
end; $$;

create function public.jevarena_history_purge() returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from jevarena_private.history_capacity where singleton=true for update;
  with due as(select id from jevarena_private.history where expires_at<=now() order by expires_at limit 1000 for update skip locked)
    delete from jevarena_private.history h using due where h.id=due.id;
end; $$;

revoke all on function jevarena_private.history_keys(jsonb,text[],text[]),jevarena_private.history_payload_safe(jsonb),jevarena_private.history_capacity_change() from public,anon,authenticated,service_role;
revoke all on function public.jevarena_history_save(uuid,jsonb,jsonb),public.jevarena_history_list(integer,timestamptz,uuid),public.jevarena_history_read(uuid),public.jevarena_history_delete(uuid) from public,anon,authenticated,service_role;
grant execute on function public.jevarena_history_save(uuid,jsonb,jsonb),public.jevarena_history_list(integer,timestamptz,uuid),public.jevarena_history_read(uuid),public.jevarena_history_delete(uuid) to authenticated;
revoke all on function public.jevarena_history_purge() from public,anon,authenticated;
grant execute on function public.jevarena_history_purge() to service_role;
commit;
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('jevarena-history-retention','*/5 * * * *','select public.jevarena_history_purge()');
  end if;
end; $$;
