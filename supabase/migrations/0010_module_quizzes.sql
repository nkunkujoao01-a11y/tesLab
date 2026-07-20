-- eLearn: admin-authored quizzes for a module — see DEV_LOG.md, Feature 57
-- (part 2 of the admin-dashboard work; part 1 was content upload/
-- extraction, Feature 56). Distinct from the existing per-student,
-- client-side generated quizzes (src/hooks/use-quiz.ts, stored in each
-- student's own Dexie `generatedQuizzes` table) — this is a single quiz a
-- lecturer authors once for the whole module, the same "one shared
-- catalog, admin-write/student-read" shape `materials` already has.
--
-- One row per question, not one row per whole quiz (a JSON blob) — same
-- reasoning as `materials` being its own table rather than a JSON array on
-- `modules`: individual questions are what gets added/edited one at a
-- time through the admin UI, and RLS/ordering both want a real row.

create table public.module_quizzes (
  id uuid primary key,
  module_id text not null references public.modules (id) on delete cascade,
  question text not null,
  options text[] not null,
  correct_index integer not null,
  created_at timestamptz not null default now()
);

alter table public.module_quizzes enable row level security;

create policy "Module quizzes are publicly readable"
  on public.module_quizzes for select
  using (true);

-- Same lecturer-only write gate as materials (0008_lecturer_role.sql) —
-- reusing the identical policy shape rather than inventing a new access
-- model for what's conceptually the same kind of shared-catalog content.

create policy "Lecturers can insert module quizzes"
  on public.module_quizzes for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

create policy "Lecturers can update module quizzes"
  on public.module_quizzes for update
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

create policy "Lecturers can delete module quizzes"
  on public.module_quizzes for delete
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));
