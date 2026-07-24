-- eLearn: lets a lecturer assign or remove a student's enrollment on their
-- behalf — 0011_module_enrollments.sql's own policy only ever let a
-- student manage their *own* row ("Users can manage their own
-- enrollment"), with no admin-assigns-a-student path at the time ("no
-- existing concept of admin-to-student assignment anywhere in this schema
-- to build on" — see that migration's own comment). This adds exactly
-- that, now that it's been asked for, without touching the existing
-- student-self-service policy at all — both paths coexist, same "any
-- lecturer, any module" admin model 0011/0008 already established for
-- everything else in the catalog.

create policy "Lecturers can manage any enrollment"
  on public.module_enrollments for all
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ))
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));
