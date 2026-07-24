-- Security review note (no behavior change): module_quizzes.correct_index
-- is world-readable (0010_module_quizzes.sql's "Module quizzes are
-- publicly readable" policy, using(true), no role restriction) because
-- grading happens client-side in use-quiz.ts/the admin quiz-review UI.
-- Anyone, even signed out, can read the answer key straight from
-- /rest/v1/module_quizzes before attempting a quiz.
--
-- Explicitly reviewed and accepted, not an oversight: these are
-- self-check study quizzes for a student's own revision, not proctored
-- exams, so exposing the answer key ahead of time costs a student only
-- their own honesty about whether they actually knew it — not academic
-- integrity for anyone else. Moving grading server-side (an RPC that
-- checks an answer and returns only right/wrong) would close this, but
-- was judged not worth the added complexity for what these quizzes are
-- actually used for.

comment on column public.module_quizzes.correct_index is
  'Intentionally world-readable (see "Module quizzes are publicly readable" policy, 0010_module_quizzes.sql) — grading is client-side and these are self-check study quizzes, not proctored exams. Accepted trade-off, documented in 0032_document_quiz_answer_tradeoff.sql.';
