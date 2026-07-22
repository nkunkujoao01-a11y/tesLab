-- eLearn: switch the BYOK key-encryption secret from a custom Postgres GUC
-- to Supabase Vault.
--
-- 0014_ai_provider_keys.sql's `alter database postgres set
-- app.settings.key_encryption_secret = ...` hit a real permission error on
-- this project (42501: permission denied to set parameter) — the role
-- behind Supabase's SQL Editor isn't a database owner/superuser for
-- ALTER DATABASE SET, contrary to what that migration's own comment
-- assumed. Vault (built on pgsodium) is Supabase's supported mechanism for
-- exactly this "one secret, readable only from a SECURITY DEFINER
-- function" need, and doesn't require that privilege.
--
-- The secret itself still isn't stored in any migration file — create it
-- once, manually, in the SQL Editor:
--   select vault.create_secret('<a long random value>', 'key_encryption_secret');
-- To rotate it later: select vault.update_secret(id, '<new value>') where
-- id is from `select id from vault.secrets where name = 'key_encryption_secret'`.

create or replace function public.save_ai_provider_key(p_provider text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
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
  insert into public.ai_provider_keys (user_id, provider, encrypted_key)
  values (auth.uid(), p_provider, pgp_sym_encrypt(p_key, v_secret))
  on conflict (user_id, provider)
  do update set encrypted_key = excluded.encrypted_key, created_at = now();
end;
$$;

create or replace function public.get_ai_provider_key(p_provider text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_row public.ai_provider_keys;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into v_row from public.ai_provider_keys
    where user_id = auth.uid() and provider = p_provider;
  if not found then
    return null;
  end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'key_encryption_secret';
  if v_secret is null or v_secret = '' then
    raise exception 'Key encryption secret is not configured on this project';
  end if;
  return pgp_sym_decrypt(v_row.encrypted_key, v_secret);
end;
$$;
