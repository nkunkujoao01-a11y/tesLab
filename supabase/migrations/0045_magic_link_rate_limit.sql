-- Security fix: rate-limit magic-link sign-in email requests.
--
-- supabase.auth.signInWithOtp({ email }) is called directly from the
-- browser (same as password/Google sign-in) — nothing stops it being
-- called repeatedly against someone else's email just to flood their
-- inbox with sign-in links. The link itself is single-use and expires,
-- so this can't be used to actually sign in as them — it's a nuisance/
-- spam risk, not an account-takeover one. Supabase's own platform-level
-- per-email/IP limit already covers the worst case, but only with a
-- generic error and no app-specific messaging; this adds a tighter,
-- app-level limit with real "too many attempts" copy — same shape and
-- reasoning as moodle_login_attempts (0031_moodle_login_rate_limit.sql).
--
-- Checked+recorded server-side (checkMagicLinkRateLimit,
-- magic-link-server.ts) *before* the browser is ever allowed to call
-- signInWithOtp — not a client-side cooldown, which would be trivially
-- bypassable by calling the Supabase API directly.

create table public.magic_link_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

create index magic_link_attempts_email_created_at_idx
  on public.magic_link_attempts (email, created_at);

alter table public.magic_link_attempts enable row level security;

-- No policies granted, on purpose — same "RLS enabled, zero grants,
-- service-role only" shape as moodle_login_attempts (0031): only the
-- service-role client (magic-link-server.ts) ever touches this table.
