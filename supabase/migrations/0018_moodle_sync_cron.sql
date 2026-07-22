-- eLearn: enables the two Postgres extensions the automatic NUST eLearning
-- sync needs to trigger itself on a schedule — pg_cron to run on a timer,
-- pg_net to make the actual outbound HTTP call from inside Postgres.
--
-- The real cron.schedule(...) call itself is deliberately NOT in this
-- migration file — it needs the real deployed URL of
-- /api/moodle/cron-sync and the real MOODLE_CRON_SECRET value, neither of
-- which can safely live in a checked-in file. Same "external, one-time,
-- out-of-band configuration" precedent as 0016's vault.create_secret step:
-- run this once, manually, in the SQL Editor, after the app is deployed
-- and MOODLE_CRON_SECRET is set as a real environment variable:
--
--   select cron.schedule(
--     'moodle-sync-trigger',
--     '0 */6 * * *',
--     $$
--     select net.http_post(
--       url := 'https://<your-deployed-host>/api/moodle/cron-sync',
--       headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', '<MOODLE_CRON_SECRET value>'),
--       body := '{}'::jsonb
--     );
--     $$
--   );
--
-- To check it's registered: select * from cron.job;
-- To remove/replace it later: select cron.unschedule('moodle-sync-trigger');

create extension if not exists pg_cron;
create extension if not exists pg_net;
