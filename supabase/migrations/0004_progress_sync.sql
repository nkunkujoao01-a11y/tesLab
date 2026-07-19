-- eLearn: multi-device progress sync (FR68-73, FR77)
--
-- Feature 10 deliberately kept per-user state (downloads, summaries,
-- read-tracking, activity) in IndexedDB only, deferring two-way sync as a
-- separate later decision. This is that decision: mirror the three tables
-- that represent real "my progress" facts — not downloads/cached content,
-- which stay device-local by design (each device should hold what it
-- personally needs offline, not a synced copy of every device's cache).
--
-- All three tables use "last write wins" by their own timestamp column,
-- reconciled client-side (see src/lib/sync.ts) rather than in the
-- database — there's no meaningful concurrent-write conflict to resolve
-- server-side for single-user data like this.

-- ── read_materials ──────────────────────────────────────────────────────
-- Mirrors src/lib/db.ts's ReadMaterial. Composite primary key doubles as
-- the natural upsert conflict target.
create table public.read_materials (
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id text not null,
  material_id text not null,
  first_read_at timestamptz not null,
  last_read_at timestamptz not null,
  primary key (user_id, module_id, material_id)
);

alter table public.read_materials enable row level security;

create policy "Users can manage their own read history"
  on public.read_materials for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── activity_events ─────────────────────────────────────────────────────
-- Mirrors src/lib/db.ts's ActivityEvent. Append-only log (drives the
-- streak grid) — client generates a stable uuid per event so the same
-- event pushed twice (e.g. an interrupted sync retried) upserts onto
-- itself instead of duplicating.
create table public.activity_events (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  event_at timestamptz not null
);

create index activity_events_user_id_idx on public.activity_events (user_id, event_at);

alter table public.activity_events enable row level security;

create policy "Users can manage their own activity"
  on public.activity_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── material_summaries ──────────────────────────────────────────────────
-- Mirrors src/lib/db.ts's MaterialSummary. Small (a few hundred bytes of
-- text each, per DEV_LOG.md Feature 17) — cheap to sync in full.
create table public.material_summaries (
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id text not null,
  material_id text not null,
  body text not null,
  method text,
  generated_at timestamptz not null,
  primary key (user_id, module_id, material_id)
);

alter table public.material_summaries enable row level security;

create policy "Users can manage their own summaries"
  on public.material_summaries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
