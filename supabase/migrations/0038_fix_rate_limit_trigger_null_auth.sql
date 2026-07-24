-- Fix: enforce_insert_rate_limit() (0034_insert_rate_limits.sql) assumed
-- auth.uid() is always a real value, but it's null for anything inserted
-- via the service-role key (no JWT/session context) — the trigger would
-- then try to insert that null into insert_rate_limits.user_id, which is
-- not null, and the whole insert would fail with a constraint violation.
-- Found while seeding test data for the super-admin verification pass;
-- nothing in this app currently inserts into feedback/research_consent/
-- research_survey_responses/module_messages via service-role (only real
-- users via their own JWT), so this was never hit in production — but a
-- future service-role code path touching these tables would trip over it.
-- Rate limiting a caller with no real identity to key on doesn't make
-- sense anyway, so skip the check entirely in that case.

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
