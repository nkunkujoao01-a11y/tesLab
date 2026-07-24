-- eLearn: introduces a "super admin" platform role, layered on top of
-- the existing lecturer role (0008_lecturer_role.sql) rather than a
-- separate permission model. Same manual-dashboard-only philosophy as
-- is_lecturer — deliberately no in-app way to grant this to yourself or
-- anyone else.

alter table public.profiles
  add column is_super_admin boolean not null default false;

-- Redefined, not paralleled — every one of the ~12 existing lecturer-gated
-- policies that already call is_lecturer() (0013_fix_profiles_recursion.sql)
-- now also passes for a super admin, with zero migration churn on any of
-- them. Deliberate simplification: a super admin can always do everything
-- a lecturer can, plus more.
create or replace function public.is_lecturer()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_lecturer or is_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Mirrors is_lecturer() exactly, same SECURITY DEFINER reasoning (0013's
-- own comment: a policy on profiles subquerying into profiles is genuine
-- 42P17 recursion — bypassing RLS for this function's own internal
-- access breaks the cycle). Kept distinct from is_lecturer() rather than
-- folded into it, because a handful of things (research data, the two new
-- RPCs below, the /admin/super route gate) must stay super-admin-only
-- even though ordinary lecturers now also satisfy is_lecturer().
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Extends 0030_fix_profile_self_escalation.sql's guard to also pin
-- is_super_admin on self-update — the exact same hole 0030 closed for
-- is_lecturer reopens for this new column otherwise: a signed-in student
-- could PATCH their own profiles row with {"is_super_admin": true} via
-- the raw REST API.
drop policy "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_lecturer = (select is_lecturer from public.profiles where id = auth.uid())
    and is_super_admin = (select is_super_admin from public.profiles where id = auth.uid())
  );
