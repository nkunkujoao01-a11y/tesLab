-- eLearn: hotfix for a real, severe bug introduced by
-- 0011_module_enrollments.sql's "Lecturers can view all profiles" policy
-- — see DEV_LOG.md, Feature 59.
--
-- That policy lives ON public.profiles and checks `is_lecturer` via a
-- subquery back INTO public.profiles. Postgres has to apply every one of
-- a table's own RLS policies to evaluate a subquery against that same
-- table — including the policy currently being evaluated — so this
-- self-reference is genuine infinite recursion (Postgres error 42P17),
-- not just risky. It broke every profile read for every user app-wide
-- (any page that calls useAuth() fetches the current user's own profile
-- row), not only the admin console this policy was written for. The
-- *other* "Lecturers can view all ..." policies added this session (on
-- module_enrollments, feedback, storage.objects) don't recurse the same
-- way — they live on a *different* table than the one they subquery into
-- — but this migration switches all of them to the same safe helper for
-- consistency and to close off the same class of bug for good.
--
-- Fix: a SECURITY DEFINER function bypasses RLS for its own internal
-- table access, so calling it from a policy doesn't re-trigger that
-- policy set — the standard, documented way to check a role flag from
-- within a policy on the same table that flag lives on.

create or replace function public.is_lecturer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_lecturer from public.profiles where id = auth.uid()),
    false
  );
$$;

drop policy if exists "Lecturers can view all profiles" on public.profiles;
create policy "Lecturers can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_lecturer());

drop policy if exists "Lecturers can view all enrollments" on public.module_enrollments;
create policy "Lecturers can view all enrollments"
  on public.module_enrollments for select
  to authenticated
  using (public.is_lecturer());

drop policy if exists "Lecturers can view all feedback" on public.feedback;
create policy "Lecturers can view all feedback"
  on public.feedback for select
  to authenticated
  using (public.is_lecturer());

drop policy if exists "Lecturers can view all feedback images" on storage.objects;
create policy "Lecturers can view all feedback images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'feedback-images' and public.is_lecturer());
