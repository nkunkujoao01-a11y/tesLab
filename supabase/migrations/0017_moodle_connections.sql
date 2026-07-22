-- eLearn: connect a student's real NUST eLearning (Moodle) account.
--
-- The student's NUST password is never stored anywhere — only a revocable
-- Moodle API token (wstoken), obtained once via Moodle's own supported
-- "mobile app" web service login flow (POST username+password to
-- login/token.php, same mechanism the real Moodle mobile app uses), is
-- persisted here, encrypted with the same Vault secret
-- (key_encryption_secret) 0014/0016 already set up for the Gemini BYOK
-- key — no second secret to configure.
--
-- Unlike the Gemini key (which the browser reads back to call Gemini
-- directly), the Moodle token never needs to leave the server — every
-- Moodle call happens server-side (src/lib/moodle-server.ts) — so there is
-- no student-facing "get token" RPC here at all, only a status check that
-- never returns the token itself.

create table public.moodle_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  moodle_user_id bigint not null,
  encrypted_token bytea not null,
  site_url text not null default 'https://elearning.nust.na',
  full_name text,
  -- Cached `functions` array from core_webservice_get_site_info — which
  -- webservice functions NUST's admin actually enabled for this service.
  -- The sync job branches on this instead of assuming a fixed function
  -- set, since that's only discoverable per-instance, per-token.
  available_functions text[],
  -- Set true when a sync call comes back with an invalid/revoked token —
  -- excludes this connection from all future sync attempts (see
  -- admin_list_moodle_connections_due_for_sync below) until the student
  -- reconnects, so a dead token doesn't get retried forever.
  needs_reconnect boolean not null default false,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now()
);

alter table public.moodle_connections enable row level security;

create policy "Users can manage their own Moodle connection"
  on public.moodle_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No direct table grants — every real read/write goes through the
-- SECURITY DEFINER functions below, same defense-in-depth reasoning as
-- ai_provider_keys (0014).
revoke all on public.moodle_connections from authenticated, anon;

create or replace function public.save_moodle_connection(
  p_moodle_user_id bigint,
  p_token text,
  p_full_name text,
  p_available_functions text[]
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'key_encryption_secret';
  if v_secret is null or v_secret = '' then
    raise exception 'Key encryption secret is not configured on this project';
  end if;
  insert into public.moodle_connections (
    user_id, moodle_user_id, encrypted_token, full_name, available_functions, needs_reconnect
  )
  values (
    auth.uid(), p_moodle_user_id, pgp_sym_encrypt(p_token, v_secret), p_full_name, p_available_functions, false
  )
  on conflict (user_id) do update set
    moodle_user_id = excluded.moodle_user_id,
    encrypted_token = excluded.encrypted_token,
    full_name = excluded.full_name,
    available_functions = excluded.available_functions,
    -- A fresh connect clears any stale "needs reconnect" flag from a
    -- previously revoked token.
    needs_reconnect = false,
    last_sync_error = null;
end;
$$;

create or replace function public.has_moodle_connection()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.moodle_connections where user_id = auth.uid()
  );
$$;

create or replace function public.get_moodle_connection_status()
returns table(
  connected boolean,
  needs_reconnect boolean,
  full_name text,
  last_sync_at timestamptz,
  last_sync_error text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    true as connected,
    mc.needs_reconnect,
    mc.full_name,
    mc.last_sync_at,
    mc.last_sync_error
  from public.moodle_connections mc
  where mc.user_id = auth.uid();
$$;

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
  delete from public.moodle_connections where user_id = auth.uid();
end;
$$;

revoke all on function public.save_moodle_connection(bigint, text, text, text[]) from public;
revoke all on function public.has_moodle_connection() from public;
revoke all on function public.get_moodle_connection_status() from public;
revoke all on function public.clear_moodle_connection() from public;
grant execute on function public.save_moodle_connection(bigint, text, text, text[]) to authenticated;
grant execute on function public.has_moodle_connection() to authenticated;
grant execute on function public.get_moodle_connection_status() to authenticated;
grant execute on function public.clear_moodle_connection() to authenticated;

-- Below: service_role-only functions for the background sync job (Phase
-- B) to decrypt/read connections on behalf of *any* user — never
-- grantable to authenticated/anon, since these bypass the "only your own
-- row" boundary the functions above enforce via auth.uid(). Safe only
-- because service_role already has full table access in Supabase by
-- design; these exist to keep decryption itself auditable/narrow rather
-- than scattering pgp_sym_decrypt calls across ad-hoc trusted-context SQL.

create or replace function public.admin_get_moodle_token(p_user_id uuid)
returns table(token text, site_url text, available_functions text[])
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'key_encryption_secret';
  if v_secret is null or v_secret = '' then
    raise exception 'Key encryption secret is not configured on this project';
  end if;
  return query
    select pgp_sym_decrypt(mc.encrypted_token, v_secret), mc.site_url, mc.available_functions
    from public.moodle_connections mc
    where mc.user_id = p_user_id and mc.needs_reconnect = false;
end;
$$;

create or replace function public.admin_list_moodle_connections_due_for_sync(p_stale_before timestamptz)
returns table(user_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select user_id from public.moodle_connections
  where needs_reconnect = false
    and (last_sync_at is null or last_sync_at < p_stale_before);
$$;

create or replace function public.admin_record_moodle_sync_result(
  p_user_id uuid,
  p_error text,
  p_needs_reconnect boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.moodle_connections
  set last_sync_at = now(),
      last_sync_error = p_error,
      needs_reconnect = p_needs_reconnect
  where user_id = p_user_id;
$$;

revoke all on function public.admin_get_moodle_token(uuid) from public, authenticated, anon;
revoke all on function public.admin_list_moodle_connections_due_for_sync(timestamptz) from public, authenticated, anon;
revoke all on function public.admin_record_moodle_sync_result(uuid, text, boolean) from public, authenticated, anon;
grant execute on function public.admin_get_moodle_token(uuid) to service_role;
grant execute on function public.admin_list_moodle_connections_due_for_sync(timestamptz) to service_role;
grant execute on function public.admin_record_moodle_sync_result(uuid, text, boolean) to service_role;
