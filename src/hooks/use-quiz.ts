import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import {
  getUserDb,
  type GeneratedFlashcardSet,
  type GeneratedQuiz,
  type QuizAttempt,
} from "@/lib/db";
import {
  generateFlashcards,
  buildSingleQuestionPrompt,
  buildQuestionSource,
  parseQuizResponse,
  parseCloudQuizJson,
  parseCloudFlashcardsJson,
  matchAnswerToOption,
  pickQuizQuestionCount,
  pickFlashcardCount,
  type QuizQuestion,
} from "@/lib/quiz-gen";
import { askChatModel } from "@/lib/ai-chat";
import { WorkerBusyError, answerQuestionViaWorker } from "@/lib/ai-worker-client";
import { generateViaCloud, CloudUnavailableError } from "@/lib/ai-cloud";
import {
  classifyModelError,
  isFatalCategory,
  fatalErrorUserMessage,
} from "@/lib/ai-error-classifier";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/hooks/use-activity";

// Cloud models handle far more context per call than the small on-device
// ones (MAX_SOURCE_CHARS in quiz-gen.ts) — this is a generous but still
// bounded budget so a very large document doesn't balloon a single
// request against the student's own free-tier token quota.
const CLOUD_SOURCE_CHARS = 12_000;

/** Every flashcard set the signed-in user has ever generated, across all
 * documents — used by the quiz/flashcard library view (src/routes/library.tsx)
 * to know which documents actually have real content to show, grouped by
 * collection there. */
export function useAllFlashcardSets(): GeneratedFlashcardSet[] {
  const { user } = useAuth();
  const [sets, setSets] = useState<GeneratedFlashcardSet[]>([]);

  useEffect(() => {
    if (!user) {
      setSets([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.generatedFlashcardSets.toArray()).subscribe({
      next: setSets,
      error: (err) => console.error("Failed to read flashcard sets", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return sets;
}

/** Same purpose as useAllFlashcardSets above, for generated quizzes. */
export function useAllQuizzes(): GeneratedQuiz[] {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<GeneratedQuiz[]>([]);

  useEffect(() => {
    if (!user) {
      setQuizzes([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.generatedQuizzes.toArray()).subscribe({
      next: setQuizzes,
      error: (err) => console.error("Failed to read quizzes", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return quizzes;
}

export function useFlashcardSet(docId: string): GeneratedFlashcardSet | undefined {
  const { user } = useAuth();
  const [set, setSet] = useState<GeneratedFlashcardSet | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setSet(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.generatedFlashcardSets.get(docId)).subscribe({
      next: setSet,
      error: (err) => console.error("Failed to read flashcard set", err),
    });
    return () => sub.unsubscribe();
  }, [user, docId]);

  return set;
}

/** Extractive by default, so this is normally instant and needs no chat
 * model download — the "generating" state exists partly for a consistent
 * UX with the AI-backed quiz generator below, and partly because the
 * cloud attempt tried first here (see ai-cloud.ts) is a real network call,
 * not instant like the extractive fallback it may fall through to. */
export function useGenerateFlashcards() {
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const generate = useCallback(
    async (docId: string, sourceText: string) => {
      if (!user) return;
      setPendingIds((prev) => new Set(prev).add(docId));
      try {
        let cards = [] as ReturnType<typeof generateFlashcards>;
        let method: "cloud" | "extractive" = "extractive";
        try {
          const raw = await generateViaCloud(
            "flashcards",
            sourceText.slice(0, CLOUD_SOURCE_CHARS),
            user.id,
            pickFlashcardCount(),
          );
          const cloudCards = parseCloudFlashcardsJson(raw);
          if (cloudCards.length > 0) {
            cards = cloudCards;
            method = "cloud";
          }
        } catch (err) {
          if (!(err instanceof CloudUnavailableError)) {
            console.error("Unexpected error calling cloud AI for flashcard generation", err);
          }
          // Any cloud failure (offline, no key, bad JSON, rate limit) falls
          // straight through to the existing extractive path below — cloud
          // is an optional enhancement, never a requirement.
        }

        if (cards.length === 0) {
          cards = generateFlashcards(sourceText);
        }
        if (cards.length === 0) {
          toast.error("This document doesn't have enough heading structure for flashcards yet.");
          return;
        }
        await getUserDb(user.id).generatedFlashcardSets.put({
          docId,
          cards,
          generatedAt: Date.now(),
          method,
        });
        void logActivity(user.id, "summary");
      } catch (err) {
        console.error("Failed to generate flashcards", err);
        toast.error("Couldn't generate flashcards. Try again.");
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
      }
    },
    [user],
  );

  return { generate, pendingIds };
}

export function useQuiz(docId: string): GeneratedQuiz | undefined {
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<GeneratedQuiz | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setQuiz(undefined);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.generatedQuizzes.get(docId)).subscribe({
      next: setQuiz,
      error: (err) => console.error("Failed to read quiz", err),
    });
    return () => sub.unsubscribe();
  }, [user, docId]);

  return quiz;
}

/** Every submitted attempt at one quiz, newest first — see db.ts's
 * QuizAttempt for why this is a full history rather than a single
 * overwritten row. */
export function useQuizAttempts(docId: string): QuizAttempt[] {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    if (!user) {
      setAttempts([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() =>
      db.quizAttempts.where("docId").equals(docId).reverse().sortBy("submittedAt"),
    ).subscribe({
      next: setAttempts,
      error: (err) => console.error("Failed to read quiz attempts", err),
    });
    return () => sub.unsubscribe();
  }, [user, docId]);

  return attempts;
}

/** Records one submitted quiz attempt — a plain local IndexedDB write, so
 * this works identically online or offline (no network round trip, unlike
 * the generation calls elsewhere in this file). */
export function useRecordQuizAttempt() {
  const { user } = useAuth();

  return useCallback(
    async (docId: string, score: number, total: number, answers: Record<number, number>) => {
      if (!user) return;
      await getUserDb(user.id).quizAttempts.add({
        id: crypto.randomUUID(),
        docId,
        score,
        total,
        answers,
        submittedAt: Date.now(),
      });
      // Real practice, not just generation — see ActivityType's own
      // comment on why this used to only ever log as "summary" (at
      // generation time), never reflecting that the quiz was actually
      // taken.
      void logActivity(user.id, "quiz");
    },
    [user],
  );
}

/** A student's own self-rating on one flashcard — see FlashcardReview's
 * own comment. `put`, not `add`: this tracks current mastery per card,
 * so re-rating a card (flip through the deck again, change your mind)
 * overwrites its previous rating rather than accumulating a history the
 * way a quiz attempt does. */
export function useRecordFlashcardReview() {
  const { user } = useAuth();

  return useCallback(
    async (docId: string, cardIndex: number, knew: boolean) => {
      if (!user) return;
      await getUserDb(user.id).flashcardReviews.put({
        key: `${docId}::${cardIndex}`,
        docId,
        cardIndex,
        knew,
        reviewedAt: Date.now(),
      });
      void logActivity(user.id, "flashcard");
    },
    [user],
  );
}

/** Every card review for one flashcard set (docId), keyed by cardIndex —
 * the caller (FlashcardDeck) uses this to show each card's current
 * rating and compute a real "known" count for the deck as a whole. */
export function useFlashcardReviews(docId: string): Record<number, boolean> {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!user) {
      setReviews({});
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() =>
      db.flashcardReviews.where("docId").equals(docId).toArray(),
    ).subscribe({
      next: (rows) => {
        const next: Record<number, boolean> = {};
        for (const row of rows) next[row.cardIndex] = row.knew;
        setReviews(next);
      },
      error: (err) => console.error("Failed to read flashcard reviews", err),
    });
    return () => sub.unsubscribe();
  }, [user, docId]);

  return reviews;
}

// One question per model call (see buildSingleQuestionPrompt's own
// comment for why) needs far less headroom than the original all-at-once
// attempt — a single question's worth of output, not several.
const QUIZ_MAX_NEW_TOKENS = 150;

// Below this extractive-QA confidence score, the answer span isn't trusted
// enough to override the chat model's own stated answer — an unverified
// starting threshold (see ai-qa.ts's own comment on this model not yet
// having a real-device confirmation pass), not a tuned one.
const MIN_QA_SCORE = 0.1;

export type QuizProgress = { current: number; total: number };

/** Genuinely needs the on-device chat model (the same one "Ask AI" and
 * collection chat already use) — plausible wrong answers can't be
 * extracted the way flashcards are, only generated. Generates one
 * question at a time (see quiz-gen.ts) rather than all of them in a
 * single call — real on-device testing found a single multi-question
 * generation could run for minutes with no visible progress; this way
 * the UI can show real "question 2 of 3" progress, and a single failed
 * question just gets skipped rather than losing the whole quiz. */
export function useGenerateQuiz() {
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [progress, setProgress] = useState<Record<string, QuizProgress>>({});

  const generate = useCallback(
    async (docId: string, sourceText: string) => {
      if (!user) return;
      // Functional form specifically so this reads the truly-latest state
      // even under a rapid double-invocation (e.g. a fast double-tap on a
      // touchscreen before the disabled button re-render lands) — real-
      // device testing surfaced exactly this: two overlapping calls for
      // the same document, each looping through 3 questions against the
      // one shared worker, produced a scrambled mix of "AI worker is busy"
      // rejections. This is a second, redundant guard alongside the UI's
      // own `disabled={isGeneratingQuiz}` — belt and suspenders, since the
      // UI guard alone still leaves that brief pre-re-render window open.
      let alreadyRunning = false;
      setPendingIds((prev) => {
        if (prev.has(docId)) {
          alreadyRunning = true;
          return prev;
        }
        return new Set(prev).add(docId);
      });
      if (alreadyRunning) return;

      const questions: QuizQuestion[] = [];
      let method: "cloud" | "on-device" = "on-device";
      // Picked once per run, not per question — the on-device loop below
      // and the cloud prompt both need to agree on the same total (see
      // pickQuizQuestionCount's own comment).
      const questionCount = pickQuizQuestionCount();
      try {
        try {
          const raw = await generateViaCloud(
            "quiz",
            sourceText.slice(0, CLOUD_SOURCE_CHARS),
            user.id,
            questionCount,
          );
          const cloudQuestions = parseCloudQuizJson(raw);
          if (cloudQuestions.length > 0) {
            questions.push(...cloudQuestions);
            method = "cloud";
          }
        } catch (err) {
          if (!(err instanceof CloudUnavailableError)) {
            console.error("Unexpected error calling cloud AI for quiz generation", err);
          }
          // Any cloud failure (offline, no key, bad JSON, rate limit) falls
          // straight through to the existing on-device loop below — cloud
          // is an optional enhancement, never a requirement.
        }

        // Skipped entirely when the cloud attempt above already produced
        // real questions — checked once via `usedCloud`, not by re-reading
        // questions.length each iteration, since that grows as this same
        // loop pushes its own on-device questions into it.
        const usedCloud = method === "cloud";
        for (let i = 1; !usedCloud && i <= questionCount; i++) {
          setProgress((prev) => ({ ...prev, [docId]: { current: i, total: questionCount } }));
          const prompt = buildSingleQuestionPrompt(
            sourceText,
            i,
            questions.map((q) => q.question),
            questionCount,
          );
          try {
            let raw: string;
            try {
              raw = await askChatModel(
                [{ role: "user", content: prompt }],
                undefined,
                QUIZ_MAX_NEW_TOKENS,
              );
            } catch (err) {
              // Not a model failure at all — just this worker's own
              // "reject if busy, not queued" scheduling (see
              // ai-worker-client.ts's WorkerBusyError). A short wait and
              // one retry is the right response, not treating it like a
              // real generation error.
              if (!(err instanceof WorkerBusyError)) throw err;
              console.error(`Question ${i} hit a busy worker, retrying once`, err);
              await new Promise((resolve) => setTimeout(resolve, 1000));
              raw = await askChatModel(
                [{ role: "user", content: prompt }],
                undefined,
                QUIZ_MAX_NEW_TOKENS,
              );
            }
            let parsed = parseQuizResponse(raw);
            // Greedy decoding is deterministic — if the format came out
            // malformed, calling again with the identical prompt would
            // reproduce the exact same malformed output. Retrying once
            // with real sampling turned on gives a genuinely different
            // attempt an actual chance to parse correctly, instead of a
            // guaranteed repeat of the same failure (found via real-device
            // testing: this used to just silently drop the question).
            if (parsed.length === 0) {
              const resampled = await askChatModel(
                [{ role: "user", content: prompt }],
                undefined,
                QUIZ_MAX_NEW_TOKENS,
                true,
              );
              parsed = parseQuizResponse(resampled);
            }
            if (parsed.length > 0) {
              const parsedQuestion = parsed[0];
              try {
                const { answer, score } = await answerQuestionViaWorker(
                  parsedQuestion.question,
                  buildQuestionSource(sourceText),
                );
                // QA grounding is a best-effort validation step, not a
                // required one — only override the chat model's own stated
                // answer when the extracted span is both confident and
                // clearly matches a *different* option than the one it
                // already picked. A low-confidence or non-matching result
                // leaves the chat model's answer as-is rather than losing
                // the question over an optional check.
                if (score >= MIN_QA_SCORE) {
                  const matchedIndex = matchAnswerToOption(answer, parsedQuestion.options);
                  if (matchedIndex >= 0 && matchedIndex !== parsedQuestion.correctIndex) {
                    parsedQuestion.correctIndex = matchedIndex;
                  }
                }
              } catch (err) {
                console.error(
                  `QA grounding failed for question ${i}, keeping the model's own answer`,
                  err,
                );
              }
              questions.push(parsedQuestion);
            }
          } catch (err) {
            console.error(`Failed to generate question ${i}`, err);
            const category = classifyModelError(err);
            if (isFatalCategory(category)) {
              // This will reproduce identically for every remaining
              // question — stop now instead of repeating the same doomed
              // attempt 2 more times, and say so plainly rather than the
              // generic "try again" (which won't help for a fatal error).
              toast.error(fatalErrorUserMessage(category, "this quiz"));
              return;
            }
            // A non-fatal failure on one question shouldn't sink the rest
            // — same "exclude, don't fake" discipline as parseQuizResponse
            // itself.
          }
        }
        if (questions.length === 0) {
          toast.error("Couldn't generate a quiz from this document. Try again.");
          return;
        }
        // Real gap found from on-device generation: a slow/timed-out
        // question is silently dropped (see the catch above — "shouldn't
        // sink the rest"), which is the right call for the quiz itself,
        // but left a student with e.g. 2 of 5 questions and zero
        // indication anything went wrong. Only fires for the on-device
        // path, where this is common; the cloud path either returns the
        // full set or fails as a whole (see the try/catch above), so it
        // never partially under-delivers this way.
        if (!usedCloud && questions.length < questionCount) {
          toast.warning(
            `Generated ${questions.length} of ${questionCount} questions — the rest timed out on this device. Connecting a free cloud AI key (Settings) avoids this.`,
          );
        }
        await getUserDb(user.id).generatedQuizzes.put({
          docId,
          questions,
          generatedAt: Date.now(),
          method,
        });
        void logActivity(user.id, "summary");
      } catch (err) {
        console.error("Failed to generate quiz", err);
        toast.error("Couldn't generate a quiz. Try again.");
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
        setProgress((prev) => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
      }
    },
    [user],
  );

  return { generate, pendingIds, progress };
}
