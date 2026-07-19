-- eLearn: initial schema
-- Content catalog (modules, materials) + auth-linked profiles.
--
-- Per-user state (downloads, AI summaries, read-tracking, study activity)
-- deliberately stays in the client's IndexedDB layer, not here — see
-- DEV_LOG.md. This migration only covers what's needed to replace the
-- static mock-data.ts content with a real, shared content catalog, plus
-- the profile row every authenticated user needs.

-- ── profiles ────────────────────────────────────────────────────────────
-- One row per authenticated user, created automatically on signup.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  program text not null default '',
  university text not null default '',
  faculty text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up. Reads optional
-- metadata passed at signup (full_name, program, university, faculty);
-- falls back to sensible blanks if omitted.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, program, university, faculty)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'program', ''),
    coalesce(new.raw_user_meta_data ->> 'university', ''),
    coalesce(new.raw_user_meta_data ->> 'faculty', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── modules ─────────────────────────────────────────────────────────────
-- The content catalog. Ids are kept as short slugs (e.g. "sen-301") to
-- match the app's existing route params and minimize churn.
create table public.modules (
  id text primary key,
  code text not null,
  faculty text not null,
  title text not null,
  chapter text not null,
  lecturer text not null,
  size_mb numeric not null,
  summary text not null,
  total_lessons integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.modules enable row level security;

create policy "Modules are publicly readable"
  on public.modules for select
  using (true);

-- ── materials ───────────────────────────────────────────────────────────
-- Material ids (e.g. "m1") are only unique *within* a module, matching
-- the client's materialKey(moduleId, materialId) convention (see
-- src/lib/db.ts) — enforced here via a composite primary key rather than
-- a bare id, so the same collision bug can't reappear at the DB layer.
create table public.materials (
  id text not null,
  module_id text not null references public.modules (id) on delete cascade,
  title text not null,
  kind text not null,
  pages integer not null,
  size_mb numeric not null,
  created_at timestamptz not null default now(),
  primary key (module_id, id)
);

alter table public.materials enable row level security;

create policy "Materials are publicly readable"
  on public.materials for select
  using (true);

-- ── seed data ───────────────────────────────────────────────────────────
-- Migrated verbatim from src/lib/mock-data.ts so the cutover to real data
-- doesn't change what's on screen.

insert into public.modules (id, code, faculty, title, chapter, lecturer, size_mb, summary, total_lessons) values
  ('sen-301', 'SEN 301', 'Engineering', 'Mineral Laws & Land Rights', 'Chapter 04 — Communal Title', 'Dr. T. Mataranyika', 12.4,
    'This module examines the interaction between customary land tenure and statutory mineral rights in Namibia. Key themes: communal title, prospecting licences, benefit-sharing, and the constitutional protection of ancestral land.', 12),
  ('eco-220', 'ECO 220', 'Economics', 'Regional Trade & the SADC Corridor', 'Seminar 06 — Border Economies', 'Prof. A. Shipanga', 8.6,
    'A study of trade flows across the SADC region with a focus on the Walvis Bay corridor, tariff regimes, and the informal cross-border economy.', 10),
  ('his-140', 'HIS 140', 'Humanities', 'Namibian History II', 'Unit 03 — Independence Era', 'Dr. L. Kambonde', 6.4,
    'The making of the modern Namibian state — from the liberation struggle to the constitutional settlement of 1990 and the political economy that followed.', 14),
  ('bot-210', 'BOT 210', 'Sciences', 'Introduction to Ethnobotany', 'Chapter 02 — Arid Flora', 'Dr. E. Nangolo', 12.4,
    'Traditional plant knowledge of southern Africa. Chapter 02 explores succulents and drought-resistant flora across the Kalahari and Namib biomes.', 9),
  ('law-110', 'LAW 110', 'Law', 'Legal Systems of Namibia', 'Chapter 07 — Customary Law', 'Prof. S. Katjivena', 9.8,
    'Structure of the Namibian legal order: constitutional supremacy, statute, common law, and the operation of customary law within a mixed jurisdiction.', 11);

insert into public.materials (module_id, id, title, kind, pages, size_mb) values
  ('sen-301', 'm1', 'Lecture Slides — Chapter 04', 'slides', 42, 4.2),
  ('sen-301', 'm2', 'Case Reader: Kxao Moses v. State', 'reading', 18, 2.1),
  ('sen-301', 'm3', 'Tutorial Handout 04', 'handout', 6, 0.8),

  ('eco-220', 'm1', 'Reader — Corridor Economics', 'reading', 24, 3.6),
  ('eco-220', 'm2', 'Slides — Seminar 06', 'slides', 28, 3.2),
  ('eco-220', 'm3', 'Tutorial Notes', 'notes', 8, 1.8),

  ('his-140', 'm1', 'Primary Sources — Unit 03', 'reading', 32, 3.4),
  ('his-140', 'm2', 'Lecture Slides', 'slides', 22, 2.4),
  ('his-140', 'm3', 'Essay Prompt', 'handout', 2, 0.6),

  ('bot-210', 'm1', 'Field Guide — Arid Flora', 'reading', 38, 6.2),
  ('bot-210', 'm2', 'Lecture Slides', 'slides', 26, 4.4),

  ('law-110', 'm1', 'Constitution Reader', 'reading', 44, 4.8),
  ('law-110', 'm2', 'Slides — Customary Law', 'slides', 30, 3.4),
  ('law-110', 'm3', 'Tutorial 07', 'handout', 4, 0.6);


