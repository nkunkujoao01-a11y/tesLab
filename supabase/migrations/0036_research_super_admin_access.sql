-- eLearn: super-admin-only read access to the research study's anonymous
-- data (0025_research_study.sql), for whoever administers this project
-- (the named researcher) to eventually review. This data deliberately had
-- no SELECT policy at all — not even for lecturers.
--
-- Gated on the separate is_super_admin() check, not is_lecturer(), so an
-- ordinary lecturer's account — even though it now also satisfies
-- is_lecturer() the same way a super admin's does (0035) — still cannot
-- see this table; only an account with is_super_admin literally true can.

create policy "Super admins can view research consent records"
  on public.research_consent for select
  to authenticated
  using (public.is_super_admin());

create policy "Super admins can view research survey responses"
  on public.research_survey_responses for select
  to authenticated
  using (public.is_super_admin());
