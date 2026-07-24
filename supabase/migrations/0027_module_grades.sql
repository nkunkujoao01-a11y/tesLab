-- eLearn: lets a lecturer record grades for students in a catalog module
-- they administer — "Assignment 1: 42/50", "Midterm: 78/100", etc. One
-- row per graded item per student, not a single "final grade" column, so
-- a module can carry several graded items over a term the same way a
-- real gradebook would, and a student sees the whole breakdown, not just
-- one number. Distinct from moodleGrades (sync.ts/db.ts) — that's
-- read-only data pulled from a student's *real* NUST Moodle account for
-- courses they're actually enrolled in there; this is admin-entered data
-- for this app's own catalog modules, a completely separate system with
-- no live Moodle course behind it.

create table public.module_grades (
  id uuid primary key,
  module_id text not null references public.modules (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  score numeric not null,
  max_score numeric not null,
  graded_at timestamptz not null default now(),
  -- Who entered it — set null (not cascade-deleted) if that lecturer's
  -- account is later removed, since the grade record itself should
  -- outlive who happened to enter it.
  graded_by uuid references auth.users (id) on delete set null
);

alter table public.module_grades enable row level security;

-- Same "any lecturer, any module" admin model as every other lecturer
-- policy in this schema (0008_lecturer_role.sql onward) — there's no
-- per-module ownership concept to scope this to instead.
create policy "Lecturers can manage grades"
  on public.module_grades for all
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ))
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

-- A student sees only their own grades — never another student's, and
-- never granted insert/update/delete (a grade is lecturer-entered only).
create policy "Students can view their own grades"
  on public.module_grades for select
  using (auth.uid() = user_id);
