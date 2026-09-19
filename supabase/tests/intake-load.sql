-- LOCAL ISOLATED DATABASE ONLY. Synthetic records, no model calls or secrets.
-- Example: pgbench -n -c 20 -j 4 -t 25 -f supabase/tests/intake-load.sql <local-db>
-- Every pgbench client uses its own synthetic IP hash; 25 < 100 hourly allowance.
select public.jevarena_submit_contribution(
  gen_random_uuid(),
  jsonb_build_object('status', 'community-submitted', 'license', 'CC-BY-4.0',
    'notes', repeat('synthetic test payload. ', 445)),
  '{"version":"2026-09-19","research":true,"rights":true,"reviewed":true,"allowPublication":false}'::jsonb,
  repeat('a', 64), repeat('b', 64), repeat(md5('local-burst-' || :client_id::text), 2)
);
