-- Security hardening (no behavior change): standardize every remaining
-- lecturer-gated policy on public.is_lecturer() (0013_fix_profiles_recursion.sql)
-- instead of the raw inline `exists (select 1 from public.profiles where
-- id = auth.uid() and is_lecturer = true)`.
--
-- 0013 introduced is_lecturer() specifically because a policy *on
-- profiles itself* subquerying back into profiles is genuine infinite
-- recursion (Postgres 42P17) — a SECURITY DEFINER function bypasses RLS
-- for its own internal access, so calling it from a policy doesn't
-- re-trigger that policy set. Every lecturer-gated policy added after
-- 0013 (0026, 0027, 0028, 0029) reverted to the raw inline form instead of
-- this helper. None of them currently live on profiles itself, so none
-- recurse today — but the safe pattern didn't become the standing
-- convention, which is exactly how 0011's original bug happened in the
-- first place. This migration doesn't fix a live bug; it removes the
-- footgun for the next lecturer-gated policy someone adds directly on
-- profiles.

drop policy "Lecturers can manage any enrollment" on public.module_enrollments;
create policy "Lecturers can manage any enrollment"
  on public.module_enrollments for all
  to authenticated
  using (public.is_lecturer())
  with check (public.is_lecturer());

drop policy "Lecturers can manage grades" on public.module_grades;
create policy "Lecturers can manage grades"
  on public.module_grades for all
  to authenticated
  using (public.is_lecturer())
  with check (public.is_lecturer());

drop policy "Lecturers can view all activity" on public.activity_events;
create policy "Lecturers can view all activity"
  on public.activity_events for select
  to authenticated
  using (public.is_lecturer());

drop policy "Lecturers can view all read history" on public.read_materials;
create policy "Lecturers can view all read history"
  on public.read_materials for select
  to authenticated
  using (public.is_lecturer());

drop policy "Lecturers can manage conversations" on public.module_conversations;
create policy "Lecturers can manage conversations"
  on public.module_conversations for all
  to authenticated
  using (public.is_lecturer())
  with check (public.is_lecturer());

drop policy "Lecturers can manage all messages" on public.module_messages;
create policy "Lecturers can manage all messages"
  on public.module_messages for all
  to authenticated
  using (public.is_lecturer())
  with check (public.is_lecturer());

drop policy "Lecturers can view all Moodle courses" on public.moodle_courses;
create policy "Lecturers can view all Moodle courses"
  on public.moodle_courses for select
  to authenticated
  using (public.is_lecturer());
