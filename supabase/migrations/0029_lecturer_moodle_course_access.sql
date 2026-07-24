-- eLearn: lets a lecturer read moodle_courses across every student — real
-- request: a student's real NUST Moodle course/lecturer, already synced
-- per-student (0019_moodle_content.sql), is a genuine signal for "which
-- students belong together" that the admin console's manual one-at-a-time
-- name search doesn't use at all. Read-only, same "any lecturer, any
-- module" admin model as every other lecturer policy in this schema
-- (0008_lecturer_role.sql onward) — this is what lets the admin console
-- match a catalog module's own code/title/lecturer fields against real
-- Moodle course rows and bulk-suggest the students already on that real
-- course, instead of searching one name at a time.
create policy "Lecturers can view all Moodle courses"
  on public.moodle_courses for select
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));
