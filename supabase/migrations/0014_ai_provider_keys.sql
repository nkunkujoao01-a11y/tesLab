-- eLearn: BYOK (bring-your-own-key) cloud AI storage.
--
-- Each student who opts in supplies their own free Gemini API key (see
-- src/lib/ai-cloud.ts) rather than the app sharing one backend key across
-- every student — free-tier quotas are per-key (roughly 250-1500
-- requests/day depending on model), which a single shared key can't
-- support at real multi-thousand-student scale. BYOK scales for free
-- because each student's own free-tier quota belongs to them alone.
--
-- Same owner-only RLS pattern as document_collections (0007) for defense
-- in depth at the row level, plus real encryption at rest via pgcrypto so
-- a raw table dump doesn't hand over plaintext keys — RLS already stops
-- *other users* from reading a row through the app; encryption addresses
-- the separate case of a database-level leak.
--
-- The encryption secret is intentionally NOT stored in this table or in
-- any migration file. It must be set once, out of band, as a custom
-- Postgres setting on this specific project — e.g. via the SQL editor:
--   alter database postgres set app.settings.key_encryption_secret = '<a long random value>';
-- (or the equivalent "custom Postgres config" entry in the Supabase
-- dashboard's Database settings, if this project's Supabase tier exposes
-- one). This is an external, one-time step for whoever administers the
-- live project — same category as confirming the Google OAuth provider is
-- enabled (see the Google Sign-In work) — not something a migration file
-- can do on its own. Until it's set, save/get below fail loudly (a NULL
-- secret raises an explicit exception) rather than ever storing anything
-- in plaintext or silently no-op'ing.

create extension if not exists pgcrypto;

create table public.ai_provider_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'gemini',
  encrypted_key bytea not null,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.ai_provider_keys enable row level security;

create policy "Users can manage their own AI provider keys"
  on public.ai_provider_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No direct table grants beyond RLS's own reach — every real read/write
-- goes through the SECURITY DEFINER functions below, so the plaintext key
-- only ever exists transiently inside a function call, never in a plain
-- client-visible select/insert.
revoke all on public.ai_provider_keys from authenticated, anon;

create or replace function public.save_ai_provider_key(p_provider text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text := current_setting('app.settings.key_encryption_secret', true);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
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
  v_secret text := current_setting('app.settings.key_encryption_secret', true);
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
  if v_secret is null or v_secret = '' then
    raise exception 'Key encryption secret is not configured on this project';
  end if;
  return pgp_sym_decrypt(v_row.encrypted_key, v_secret);
end;
$$;

-- Existence check without decrypting anything — lets the UI (e.g. "show
-- the AI notes tab") ask "is cloud AI available for this student" without
-- paying for a decrypt it doesn't need yet.
create or replace function public.has_ai_provider_key(p_provider text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.ai_provider_keys
    where user_id = auth.uid() and provider = p_provider
  );
$$;

create or replace function public.clear_ai_provider_key(p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.ai_provider_keys where user_id = auth.uid() and provider = p_provider;
end;
$$;

-- Only signed-in users may call these — the anon role has no auth.uid()
-- to check against anyway, so there's nothing for it to do here.
revoke all on function public.save_ai_provider_key(text, text) from public;
revoke all on function public.get_ai_provider_key(text) from public;
revoke all on function public.has_ai_provider_key(text) from public;
revoke all on function public.clear_ai_provider_key(text) from public;
grant execute on function public.save_ai_provider_key(text, text) to authenticated;
grant execute on function public.get_ai_provider_key(text) to authenticated;
grant execute on function public.has_ai_provider_key(text) to authenticated;
grant execute on function public.clear_ai_provider_key(text) to authenticated;
