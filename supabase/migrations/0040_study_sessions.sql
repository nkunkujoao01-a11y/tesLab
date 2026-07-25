-- eLearn: device/platform breakdown + real session-duration tracking for
-- the super admin platform analytics — closes the "not yet tracked" gap
-- that dashboard has carried since it was first built. One row per app
-- session, upserted repeatedly as it grows (see use-session-tracking.ts)
-- rather than a point-in-time event like activity_events — a session has
-- an accumulating duration, the wrong shape for an append-only log.
--
-- Deliberately online-only, write-straight-to-Supabase, no local Dexie
-- table/sync.ts involvement — nobody ever reads their own session data
-- back in the UI, this exists purely for the super admin dashboard, same
-- "no local read path" reasoning as feedback/research submissions.

create table public.study_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),
  duration_seconds integer not null default 0,
  device_type text not null check (device_type in ('mobile', 'tablet', 'desktop')),
  platform text not null
);

alter table public.study_sessions enable row level security;

create policy "Users can manage their own sessions"
  on public.study_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Not is_lecturer() — this is platform-health telemetry, not per-module
-- pedagogical data a lecturer needs, same narrower-than-is_lecturer()
-- treatment already given to the research study and anonymous-suggestions
-- tables.
create policy "Super admins can view all sessions"
  on public.study_sessions for select
  to authenticated
  using (public.is_super_admin());

-- No enforce_insert_rate_limit() trigger here, unlike every other
-- insert-only table (0034/0038) — that trigger fires on
-- INSERT ... ON CONFLICT DO UPDATE (Postgres runs BEFORE INSERT triggers
-- before resolving the conflict), and this table is upserted roughly
-- every 30 seconds per active session by design; attaching it would
-- exhaust its own default rate limit within minutes of one student using
-- the app. The "Users can manage their own sessions" policy above is the
-- right protection here — worst case a student inflates only their own
-- session data, not a cross-user abuse vector.
