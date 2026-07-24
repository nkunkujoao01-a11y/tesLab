-- eLearn: the two privileged actions a super admin can take from the app
-- itself. Neither touches auth.users directly for writes — ban/delete go
-- through the real Admin API instead, see src/lib/admin-server.ts for why.

-- Grants/revokes lecturer status on any account — the one concrete gap
-- today (is_lecturer can currently only be changed by editing the
-- Supabase dashboard directly). Deliberately does NOT accept an
-- is_super_admin parameter — granting/revoking super admin stays
-- dashboard-only, same original scope limit is_lecturer itself had
-- before this RPC existed (0008_lecturer_role.sql).
create or replace function public.admin_set_lecturer_role(
  target_user_id uuid,
  new_is_lecturer boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;
  update public.profiles set is_lecturer = new_is_lecturer where id = target_user_id;
end;
$$;

revoke all on function public.admin_set_lecturer_role(uuid, boolean) from public;
grant execute on function public.admin_set_lecturer_role(uuid, boolean) to authenticated;

-- Read-only auth.users info for the user directory — avoids needing the
-- paginated admin API just to list users. `where public.is_super_admin()`
-- returns every row for a super admin and zero rows for anyone else,
-- consistent with this codebase's "RLS-denied selects return empty, not
-- an error" convention rather than raising.
create or replace function public.get_all_users_admin_info()
returns table(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until
  from auth.users u
  where public.is_super_admin();
$$;

revoke all on function public.get_all_users_admin_info() from public;
grant execute on function public.get_all_users_admin_info() to authenticated;
