-- eLearn: adds student_number alongside full_name (0042_research_optional_identity.sql)
-- — captured the same way (a point-in-time snapshot at submission time, null
-- whenever the student chose to stay anonymous), so the research page can
-- show a real, useful identifier without needing a separate profiles.student_number
-- column, which doesn't exist: the only place a student number is ever
-- recorded is baked into the synthetic login email for the NUST-student-number
-- sign-in method (`<studentnumber>@nust-student.invalid`, see
-- moodle-server.ts's studentNumberToEmail) — extracted from auth.users.email
-- client-side at submission time (research-study.ts), null for anyone who
-- signed in with Google or a plain email/password instead.
alter table public.research_consent
  add column student_number text;

alter table public.research_survey_responses
  add column student_number text;
