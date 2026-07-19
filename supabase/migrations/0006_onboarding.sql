-- eLearn: first-time-user onboarding (Feature 27).
--
-- A single timestamp on the existing profiles table — the natural place
-- for per-account settings/state that's already server-side truth (see
-- Feature 10) — rather than a new sync table for one flag. null means
-- "hasn't seen the tour yet"; real accounts get it exactly once, and it
-- follows them across devices for free since profiles already syncs.

alter table public.profiles
  add column onboarding_completed_at timestamptz;
