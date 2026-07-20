-- eLearn: admin console real-data access — see DEV_LOG.md, Feature 59.
--
-- The new admin console's Feedback inbox needs a lecturer to read every
-- student's submitted feedback (table rows and their attached images),
-- not just their own. `0009_feedback.sql`'s existing policies only ever
-- granted a user access to their *own* feedback (correct for a student
-- submitting a report, wrong for a lecturer reviewing everyone's). Same
-- "any lecturer, any [shared content]" model 0008_lecturer_role.sql and
-- 0011_module_enrollments.sql already established, applied here to
-- feedback specifically.

create policy "Lecturers can view all feedback"
  on public.feedback for select
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

-- Storage RLS is separate from table RLS — granting the row above doesn't
-- unlock the attached images in the private feedback-images bucket, which
-- 0009_feedback.sql scoped to "your own folder only". Same grant, applied
-- at the storage-object layer.
create policy "Lecturers can view all feedback images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'feedback-images'
    and exists (
      select 1 from public.profiles where id = auth.uid() and is_lecturer = true
    )
  );
