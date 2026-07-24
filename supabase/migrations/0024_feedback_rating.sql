-- eLearn: adds an optional 1-5 satisfaction rating to the existing
-- feedback table (0009_feedback.sql) — a real user request for a way to
-- rate the app itself, not just report a specific bug. Nullable and
-- additive only (see db.ts's own Dexie-versioning discipline for the
-- same "only ever add" principle applied here to a real Postgres table):
-- a bug report with no rating attached is still a completely valid
-- submission, so this is never a required field.

alter table public.feedback
  add column rating smallint check (rating between 1 and 5);
