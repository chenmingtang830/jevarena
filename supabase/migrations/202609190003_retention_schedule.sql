-- Applied to the JevArena Supabase project. No external HTTP service or model call.
create extension if not exists pg_cron;
select cron.schedule('jevarena-private-retention', '17 * * * *',
  'select public.jevarena_purge_contributions()');
-- Verify: select jobname, schedule, active from cron.job
-- where jobname = 'jevarena-private-retention';
