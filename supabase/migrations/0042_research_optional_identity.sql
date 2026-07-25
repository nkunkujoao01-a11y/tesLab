-- eLearn: the research study (0025_research_study.sql) originally recorded
-- only anonymous responses. The researcher now wants a signed-in
-- respondent identified by default (real name, so they can follow up or
-- give credit), with anonymity kept as an explicit opt-out a student can
-- still choose at consent time — a real choice each time, not a silent
-- removal of the anonymity option this study's original ethics approval
-- promised.
--
-- user_id/full_name are both nullable and always null together whenever a
-- student chooses to stay anonymous — anonymous_id (already required,
-- not-null) remains the only identifier in that case, exactly as before
-- this migration. full_name is captured as a point-in-time snapshot
-- (copied from profiles.full_name at submission time, see
-- research-study.ts) rather than joined live from profiles, so a later
-- profile-name change doesn't retroactively alter what this research
-- record says a real respondent's name was at the time they answered.
alter table public.research_consent
  add column user_id uuid references auth.users (id) on delete set null,
  add column full_name text;

alter table public.research_survey_responses
  add column user_id uuid references auth.users (id) on delete set null,
  add column full_name text;

-- Replaces the old "with check (true)" insert policies — still lets any
-- signed-in student record a response, but a client can no longer claim
-- an identity that isn't its own: user_id must either be left out
-- entirely (the anonymous choice) or match the actual signed-in user.
drop policy "Anyone signed in can record a consent response" on public.research_consent;
create policy "Anyone signed in can record a consent response"
  on public.research_consent for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy "Anyone signed in can submit a survey response" on public.research_survey_responses;
create policy "Anyone signed in can submit a survey response"
  on public.research_survey_responses for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());
