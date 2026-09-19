-- Read-only deployment checks. All rows should show true or false as named.
select c.relname, c.relrowsecurity as rls_enabled,
  not has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as anon_denied,
  not has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as authenticated_denied
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'jevarena_private' and c.relkind = 'r';
select p.proname,
  not has_function_privilege('anon', p.oid, 'EXECUTE') as anon_denied,
  not has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_denied,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_allowed
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'jevarena_%';
select jobname, schedule, active from cron.job
where jobname = 'jevarena-private-retention';
