-- eLearn: lets a student's *own* signed-in browser request a file proxy
-- fetch through our server (see fetchMoodleFile, src/lib/moodle-server.ts)
-- without that server hop needing a service-role client — this returns
-- only the caller's own token, gated by auth.uid(), same trust boundary as
-- get_ai_provider_key (0014) already uses for the Gemini key. The token
-- still never reaches the browser itself: only the server function that
-- calls this RPC ever sees it, then discards it after fetching the file —
-- same one-hop discipline as the original connect flow
-- (0017_moodle_connections.sql's own header comment).

create or replace function public.get_own_moodle_file_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'key_encryption_secret';
  if v_secret is null or v_secret = '' then
    raise exception 'Key encryption secret is not configured on this project';
  end if;
  select pgp_sym_decrypt(encrypted_token, v_secret) into v_token
    from public.moodle_connections
    where user_id = auth.uid() and needs_reconnect = false;
  if v_token is null then
    raise exception 'No connected Moodle account';
  end if;
  return v_token;
end;
$$;

revoke all on function public.get_own_moodle_file_token() from public, anon;
grant execute on function public.get_own_moodle_file_token() to authenticated;
