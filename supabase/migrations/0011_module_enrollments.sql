-- eLearn: module enrollment/roster — see DEV_LOG.md, Feature 58 (part 3 of
-- the admin-dashboard work; parts 1-2 were content upload/extraction and
-- quiz authoring, Features 56-57).
--
-- Scope decision: enrollment here is a roster concept, not an access
-- gate. Every module has always been publicly readable in this app
-- (0001_init.sql's "Modules are publicly readable" policy) and nothing in
-- the user's request asked to change that — "the admin can see who is
-- registered for their module" describes a roster, not a paywall.
-- Enrolling is self-service (a student taps "Enrol" on a module they're
-- taking), not admin-assigned, since there's no existing concept of
-- admin-to-student assignment anywhere in this schema to build on.

create table public.module_enrollments (
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id text not null references public.modules (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

alter table public.module_enrollments enable row level security;

-- A student manages their own enrollment only (enrol/unenrol themselves,
-- see their own enrolled modules) — same owner-only shape as
-- personal_documents (0005_personal_documents.sql).
create policy "Users can manage their own enrollment"
  on public.module_enrollments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Lecturers additionally need to see the *roster* — everyone enrolled in
-- a module, not just their own row. There's no per-module ownership
-- concept in this schema (any lecturer can edit any module, per
-- 0008_lecturer_role.sql), so this grants read access to all enrollments,
-- matching that same existing "any lecturer, any module" admin model
-- rather than inventing a per-module ownership concept this pass didn't
-- ask for.
create policy "Lecturers can view all enrollments"
  on public.module_enrollments for select
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

-- A roster of user_ids is useless without real names to show — but
-- `profiles`' existing "Users can view their own profile" policy
-- (0001_init.sql) blocks a lecturer from reading anyone else's row. This
-- grants lecturers read access to every profile, the same "any lecturer,
-- any [shared content]" model 0008_lecturer_role.sql already established
-- for modules/materials, applied here to the profile rows a roster needs
-- to display. Safe against recursive RLS: the subquery's own "own row"
-- policy already permits it to see exactly the querying lecturer's row.
create policy "Lecturers can view all profiles"
  on public.profiles for select
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));
