-- eLearn: supports the NUST ethics-approved usability study this app is
-- part of (researcher Joao Ndongala Nkunku, supervisor Dr Tendai
-- Mataranyika) — a consent record and a post-task System Usability
-- Scale/TAM/UTAUT/data-efficiency questionnaire.
--
-- Deliberately no user_id, email, or any other column that could
-- re-identify a real account — the consent form's own text promises "No
-- personal information that can identify you... will be collected."
-- `anonymous_id` is a random per-device id (see research-study.ts's
-- getAnonymousId), generated client-side, never derived from or joined
-- back to auth.users. Consistent with 0009_feedback.sql's own "submit
-- once, no read-back, reviewed manually by the researcher" shape, except
-- there's no per-user select policy here at all — this data was never
-- meant to be looked up by anyone from the client, anonymous or not.

create table public.research_consent (
  id uuid primary key,
  anonymous_id text not null,
  agreed boolean not null,
  responded_at timestamptz not null
);

alter table public.research_consent enable row level security;

-- No `auth.uid()` check — there is no identity here to check against by
-- design. Any signed-in student can record one consent response; nothing
-- about who they are travels with it.
create policy "Anyone signed in can record a consent response"
  on public.research_consent for insert
  to authenticated
  with check (true);

create table public.research_survey_responses (
  id uuid primary key,
  anonymous_id text not null,
  -- sus_1..sus_10 (System Usability Scale), tam_11..tam_15 (perceived
  -- usefulness/ease of use), data_16..data_20 (data efficiency &
  -- satisfaction) as integers 1-5; open_21..open_23 as free text. Kept as
  -- one jsonb blob rather than 23 columns — the question set is owned by
  -- the study instrument, not this schema, and a jsonb blob lets it stay
  -- that way without a migration per wording tweak.
  answers jsonb not null,
  submitted_at timestamptz not null
);

alter table public.research_survey_responses enable row level security;

create policy "Anyone signed in can submit a survey response"
  on public.research_survey_responses for insert
  to authenticated
  with check (true);
