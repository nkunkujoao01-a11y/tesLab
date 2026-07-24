-- Security fix: rate-limit the NUST student-number login/connect flow.
--
-- moodle-server.ts's connectMoodleAccount and loginWithNustCredentials
-- forward {studentNumber, password} straight to NUST's real Moodle
-- (elearning.nust.na/login/token.php) with no throttling — every failed
-- attempt just returns immediately, so this app's own server could be
-- scripted into unlimited password guesses against any known student
-- number, effectively laundering a credential-stuffing attack against
-- NUST's Moodle through eLearn's server IP.
--
-- Both server functions are stateless createServerFn handlers with no
-- reliable shared in-memory state across serverless invocations, so the
-- limiter is DB-backed: one row per login attempt, checked/pruned by
-- moodle-server.ts's checkAndRecordLoginAttempt helper using the same
-- service-role client already used elsewhere in that file.
--
-- This limits guessing per student number (5 attempts / 15 minutes). It
-- does not stop a distributed attacker spreading guesses across many
-- different student numbers — that would need IP-based limiting at the
-- edge/middleware layer, a larger, separate change not covered here.
--
-- No policies granted, on purpose: this table is only ever touched by the
-- service-role client (never the browser's anon-key client), the same
-- "RLS enabled, zero grants, service-role only" shape already used by
-- moodle_connections/ai_provider_keys for tables no client should ever
-- read or write directly.

create table public.moodle_login_attempts (
  id uuid primary key default gen_random_uuid(),
  student_number text not null,
  created_at timestamptz not null default now()
);

create index moodle_login_attempts_student_number_created_at_idx
  on public.moodle_login_attempts (student_number, created_at);

alter table public.moodle_login_attempts enable row level security;
