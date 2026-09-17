-- Security fix: persist an audit trail for the three account-lifecycle
-- actions a super admin can take (admin_set_lecturer_role, ban/unban via
-- setUserBanned, delete via deleteUserAccount — src/lib/admin-server.ts,
-- src/hooks/use-super-admin.ts). Before this, every one of those actions
-- only ever reached a `console.error` on failure and nothing at all on
-- success — a super admin (or someone who compromised a super admin's
-- session) could deny having banned/deleted/promoted an account, with no
-- queryable record to check that against. Found during a STRIDE review
-- (Repudiation) of this app's admin actions.
--
-- No FK on actor_id/target_user_id to auth.users, deliberately: an
-- `on delete cascade` would delete the very audit rows proving an account
-- was deleted the moment deleteUserAccount ran, which defeats the point;
-- `on delete set null` would still lose which account was involved. Plain
-- uuid columns keep the row intact regardless of what later happens to
-- either account.
--
-- Insert-only from trusted paths: admin_set_lecturer_role inserts directly
-- (same SECURITY DEFINER function, same transaction as its own update);
-- setUserBanned/deleteUserAccount (admin-server.ts) already run their
-- privileged action via a service-role client after independently
-- re-verifying the caller is a super admin (verifyCallerIsSuperAdmin) — the
-- same service-role client now also inserts here. No table grants to
-- authenticated/anon, so nothing can insert a fabricated log entry through
-- any client-reachable path — same "RLS enabled, zero client grants"
-- shape as moodle_login_attempts (0031)/moodle_connections (0017). Reads
-- go through get_admin_audit_log() below, same is_super_admin()-gated
-- pattern as get_all_users_admin_info (0037).

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  target_user_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

revoke all on public.admin_audit_log from authenticated, anon;

create or replace function public.get_admin_audit_log()
returns table(
  id uuid,
  actor_id uuid,
  action text,
  target_user_id uuid,
  details jsonb,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select a.id, a.actor_id, a.action, a.target_user_id, a.details, a.created_at
  from public.admin_audit_log a
  where public.is_super_admin()
  order by a.created_at desc
  limit 500;
$$;

revoke all on function public.get_admin_audit_log() from public;
grant execute on function public.get_admin_audit_log() to authenticated;

-- admin_set_lecturer_role (0037_super_admin_rpcs.sql) already runs inside
-- its own is_super_admin() check — this redefinition just adds the audit
-- insert after the update succeeds, same function signature/grants.
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
  insert into public.admin_audit_log (actor_id, action, target_user_id, details)
  values (
    auth.uid(),
    'set_lecturer_role',
    target_user_id,
    jsonb_build_object('new_is_lecturer', new_is_lecturer)
  );
end;
$$;
