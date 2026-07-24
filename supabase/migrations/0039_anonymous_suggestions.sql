-- eLearn: a general, always-available anonymous suggestion box — separate
-- from the existing (non-anonymous, account-tied) feedback table and from
-- the one-time research-study survey. Same anonymous-by-design shape as
-- research_consent/research_survey_responses (0025_research_study.sql):
-- no user_id/email anywhere, only a random per-device anonymous_id
-- (getAnonymousId(), research-study.ts — reused here, not a second
-- identity scheme), insert-only for everyone, select only for a real
-- super admin.

create table public.anonymous_suggestions (
  id uuid primary key,
  anonymous_id text not null,
  message text not null,
  submitted_at timestamptz not null default now()
);

alter table public.anonymous_suggestions enable row level security;

create policy "Users can submit anonymous suggestions"
  on public.anonymous_suggestions for insert
  to authenticated
  with check (true);

create policy "Super admins can view anonymous suggestions"
  on public.anonymous_suggestions for select
  to authenticated
  using (public.is_super_admin());

-- Same generic rate-limit trigger every other abuse-prone insert-only
-- table uses (0034_insert_rate_limits.sql, patched in
-- 0038_fix_rate_limit_trigger_null_auth.sql) — adds one new case branch
-- (tighter than the generic 20/hour default, since a suggestion box needs
-- fewer legitimate submissions per person than e.g. module_messages).
create or replace function public.enforce_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  window_minutes integer;
  max_count integer;
  recent_count integer;
begin
  if auth.uid() is null or public.is_lecturer() then
    return new;
  end if;

  case tg_table_name
    when 'feedback' then window_minutes := 60; max_count := 10;
    when 'research_consent' then window_minutes := 60; max_count := 3;
    when 'research_survey_responses' then window_minutes := 60; max_count := 3;
    when 'module_messages' then window_minutes := 5; max_count := 20;
    when 'anonymous_suggestions' then window_minutes := 60; max_count := 5;
    else window_minutes := 60; max_count := 20;
  end case;

  delete from public.insert_rate_limits
  where user_id = auth.uid()
    and table_name = tg_table_name
    and created_at < now() - interval '2 hours';

  select count(*) into recent_count
  from public.insert_rate_limits
  where user_id = auth.uid()
    and table_name = tg_table_name
    and created_at > now() - (window_minutes || ' minutes')::interval;

  if recent_count >= max_count then
    raise exception 'Too many submissions — please wait before trying again.';
  end if;

  insert into public.insert_rate_limits (user_id, table_name)
  values (auth.uid(), tg_table_name);

  return new;
end;
$$;

create trigger rate_limit_anonymous_suggestions
  before insert on public.anonymous_suggestions
  for each row execute function public.enforce_insert_rate_limit();
