-- Security hardening: cap unbounded inserts on feedback, research_consent,
-- research_survey_responses, and module_messages — today any signed-in
-- user can insert unlimited rows into any of these (each policy is a
-- plain "insert your own row" check with no frequency limit at all), so
-- a script could flood a lecturer's inbox, pollute the NUST ethics
-- research dataset with junk survey responses, or fill the feedback
-- table, all while staying fully within RLS.
--
-- One generic table + BEFORE INSERT trigger function rather than four
-- bespoke ones — the shape (count this user's recent inserts into this
-- table, reject past a threshold, self-prune old rows) is identical
-- across all four; only the threshold differs per table's real usage
-- pattern. Lecturers are exempted (public.is_lecturer(), same helper used
-- everywhere else in this schema) since they're a trusted role here, not
-- part of the abuse surface this closes.
--
-- research_consent/research_survey_responses deliberately carry no
-- user_id (0025_research_study.sql's whole point is anonymity) — this
-- table only ever uses auth.uid() transiently, at insert-check time, to
-- decide whether *this session* is submitting too often; it's never
-- joined back to the anonymous research rows themselves, so it doesn't
-- undermine that anonymity.

create table public.insert_rate_limits (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  table_name text not null,
  created_at timestamptz not null default now()
);

create index insert_rate_limits_user_table_idx
  on public.insert_rate_limits (user_id, table_name, created_at);

-- No policies granted, on purpose — only ever touched by the SECURITY
-- DEFINER trigger function below, never a direct client read/write, same
-- "RLS enabled, zero grants" shape as moodle_login_attempts
-- (0031_moodle_login_rate_limit.sql).
alter table public.insert_rate_limits enable row level security;

create function public.enforce_insert_rate_limit()
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
  if public.is_lecturer() then
    return new;
  end if;

  case tg_table_name
    when 'feedback' then window_minutes := 60; max_count := 10;
    when 'research_consent' then window_minutes := 60; max_count := 3;
    when 'research_survey_responses' then window_minutes := 60; max_count := 3;
    when 'module_messages' then window_minutes := 5; max_count := 20;
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

create trigger rate_limit_feedback
  before insert on public.feedback
  for each row execute function public.enforce_insert_rate_limit();

create trigger rate_limit_research_consent
  before insert on public.research_consent
  for each row execute function public.enforce_insert_rate_limit();

create trigger rate_limit_research_survey_responses
  before insert on public.research_survey_responses
  for each row execute function public.enforce_insert_rate_limit();

create trigger rate_limit_module_messages
  before insert on public.module_messages
  for each row execute function public.enforce_insert_rate_limit();
