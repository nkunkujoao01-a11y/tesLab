-- eLearn: real assignment due dates from NUST eLearning — synced by the
-- same background job as moodle_courses/moodle_grades (0019), via
-- mod_assign_get_assignments, never written by students directly. Same
-- owner-only, select-only-for-authenticated RLS pattern as every other
-- moodle_* table.

create table public.moodle_assignments (
  course_id bigint not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  assignment_id bigint not null,
  name text not null,
  -- Moodle's own "not set" value is the integer 0, not null — the sync
  -- job (moodle-cron-handler.ts's moodleTimestampToIso) already converts
  -- that to a real null before it ever reaches this column, so every
  -- reader here can trust null to mean "genuinely no due date," not "we
  -- forgot to check."
  due_date timestamptz,
  allow_submissions_from timestamptz,
  primary key (user_id, course_id, assignment_id),
  foreign key (user_id, course_id) references public.moodle_courses (user_id, id) on delete cascade
);

alter table public.moodle_assignments enable row level security;

create policy "Users can view their own Moodle assignments"
  on public.moodle_assignments for select using (auth.uid() = user_id);
