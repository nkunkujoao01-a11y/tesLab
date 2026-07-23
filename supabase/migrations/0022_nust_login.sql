-- eLearn: lets a student log in with just their NUST student number +
-- password, instead of first creating a separate eLearn email/password
-- account and then connecting Moodle as a second step in Settings. The
-- login itself still only ever touches Moodle's own login/token.php (see
-- moodle-server.ts) — this migration only adds the one missing piece:
-- a way for that server-side login flow (which runs *before* any Supabase
-- session exists yet) to save the resulting Moodle connection against the
-- right account, the same way save_moodle_connection (0017) does for an
-- already-signed-in student, just addressed by an explicit user id
-- instead of auth.uid() — same service_role-only trust boundary as
-- admin_get_moodle_token/admin_record_moodle_sync_result (0017).
create or replace function public.admin_save_moodle_connection(
  p_user_id uuid,
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
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'key_encryption_secret';
  if v_secret is null or v_secret = '' then
    raise exception 'Key encryption secret is not configured on this project';
  end if;
  insert into public.moodle_connections (
    user_id, moodle_user_id, encrypted_token, full_name, available_functions, needs_reconnect
  )
  values (
    p_user_id, p_moodle_user_id, pgp_sym_encrypt(p_token, v_secret), p_full_name, p_available_functions, false
  )
  on conflict (user_id) do update set
    moodle_user_id = excluded.moodle_user_id,
    encrypted_token = excluded.encrypted_token,
    full_name = excluded.full_name,
    available_functions = excluded.available_functions,
    needs_reconnect = false,
    last_sync_error = null;
end;
$$;

revoke all on function public.admin_save_moodle_connection(uuid, bigint, text, text, text[]) from public, authenticated, anon;
grant execute on function public.admin_save_moodle_connection(uuid, bigint, text, text, text[]) to service_role;
