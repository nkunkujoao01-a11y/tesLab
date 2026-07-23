-- eLearn: disconnecting a NUST eLearning account previously only removed
-- the connection/token itself — every previously-synced course, section,
-- module, and grade (moodle_courses etc., 0019_moodle_content.sql) stayed
-- in place indefinitely, with nothing to ever clean it up. Combined with a
-- student reconnecting under a *different* real NUST identity, this was
-- the other half of the "still shows the wrong student's modules" bug —
-- moodle-cron-handler.ts's own sync-time cleanup only runs on the *next
-- successful sync of an active connection*; disconnecting needs to clear
-- this student's synced content immediately, since there's no future sync
-- left to ever do it once the connection itself is gone.
create or replace function public.clear_moodle_connection()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  -- Cascades to moodle_course_sections/moodle_course_modules/moodle_grades
  -- via their own FKs to moodle_courses (see 0019).
  delete from public.moodle_courses where user_id = auth.uid();
  delete from public.moodle_connections where user_id = auth.uid();
end;
$$;
