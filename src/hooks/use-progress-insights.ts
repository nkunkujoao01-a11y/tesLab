// Real learning-performance aggregation for the Progress page — distinct
// from use-activity.ts, which only ever tracked *engagement* (did you
// open this material). QuizAttempt and FlashcardReview (db.ts) already
// held real data — score/total per quiz attempt, a self-rating per
// flashcard — but neither was ever aggregated anywhere before this; a
// quiz's own page only ever showed its own best score in isolation, and
// flashcards had no aggregate view at all.
import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { getUserDb, type QuizAttempt, type FlashcardReview } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import type { Module } from "@/lib/modules-api";

export type ModuleQuizStats = {
  moduleId: string;
  code: string;
  title: string;
  avgPct: number;
  quizCount: number;
};

export type QuizInsights = {
  // Every *distinct* quiz (by docId) a student has ever attempted, not a
  // raw attempt count — a student retaking the same quiz 5 times to
  // improve their score shouldn't inflate this. Each quiz's own best
  // attempt is what counts toward every average here, matching the
  // "Best: X/Y" a single quiz's own page already shows (QuizPanel) — a
  // straight average of every raw attempt would unfairly punish
  // practicing/retaking to improve.
  quizzesTaken: number;
  overallAvgPct: number | null;
  byModule: ModuleQuizStats[];
  weakestModule: ModuleQuizStats | null;
  strongestModule: ModuleQuizStats | null;
};

export type ModuleFlashcardStats = {
  moduleId: string;
  code: string;
  title: string;
  knownPct: number;
  reviewedCount: number;
};

export type FlashcardInsights = {
  totalReviewed: number;
  totalKnown: number;
  overallKnownPct: number | null;
  byModule: ModuleFlashcardStats[];
};

// materialKey(moduleId, materialId) is "${moduleId}::${materialId}" (see
// db.ts) — a personal document or collection's docId is a bare uuid with
// no "::" at all, so this is a safe, unambiguous way to tell "this
// attempt/review belongs to a real catalog module" from "this one
// doesn't map to any module" without a separate lookup table.
function moduleIdFromDocId(docId: string): string | null {
  const idx = docId.indexOf("::");
  return idx === -1 ? null : docId.slice(0, idx);
}

function bestAttemptPerQuiz(attempts: QuizAttempt[]): QuizAttempt[] {
  const best = new Map<string, QuizAttempt>();
  for (const attempt of attempts) {
    const current = best.get(attempt.docId);
    const pct = attempt.total > 0 ? attempt.score / attempt.total : 0;
    const currentPct = current && current.total > 0 ? current.score / current.total : -1;
    if (!current || pct > currentPct) best.set(attempt.docId, attempt);
  }
  return [...best.values()];
}

const EMPTY_QUIZ_INSIGHTS: QuizInsights = {
  quizzesTaken: 0,
  overallAvgPct: null,
  byModule: [],
  weakestModule: null,
  strongestModule: null,
};

/** Real quiz performance, not just "did you generate one" — see this
 * file's own header comment. `modules` is the already-loaded catalog
 * (Progress's own route loader) used only to attach a real title/code to
 * whichever attempts map to a real module; personal-document and
 * collection quizzes still count toward the overall average, just not
 * toward any per-module breakdown, since they don't belong to one. */
export function useQuizInsights(modules: Module[]): QuizInsights {
  const { user } = useAuth();
  const [insights, setInsights] = useState<QuizInsights>(EMPTY_QUIZ_INSIGHTS);

  useEffect(() => {
    if (!user) {
      setInsights(EMPTY_QUIZ_INSIGHTS);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.quizAttempts.toArray()).subscribe({
      next: (attempts) => {
        const best = bestAttemptPerQuiz(attempts);
        if (best.length === 0) {
          setInsights(EMPTY_QUIZ_INSIGHTS);
          return;
        }

        const moduleById = new Map(modules.map((m) => [m.id, m]));
        const byModuleAcc = new Map<string, { sumPct: number; count: number }>();
        let sumPct = 0;
        for (const attempt of best) {
          const pct = attempt.total > 0 ? attempt.score / attempt.total : 0;
          sumPct += pct;
          const moduleId = moduleIdFromDocId(attempt.docId);
          if (moduleId && moduleById.has(moduleId)) {
            const acc = byModuleAcc.get(moduleId) ?? { sumPct: 0, count: 0 };
            acc.sumPct += pct;
            acc.count += 1;
            byModuleAcc.set(moduleId, acc);
          }
        }

        const byModule: ModuleQuizStats[] = [...byModuleAcc.entries()]
          .map(([moduleId, acc]) => {
            const m = moduleById.get(moduleId);
            return {
              moduleId,
              code: m?.code ?? "",
              title: m?.title ?? moduleId,
              avgPct: acc.sumPct / acc.count,
              quizCount: acc.count,
            };
          })
          .sort((a, b) => a.avgPct - b.avgPct);

        setInsights({
          quizzesTaken: best.length,
          overallAvgPct: sumPct / best.length,
          byModule,
          weakestModule: byModule[0] ?? null,
          strongestModule: byModule.length > 0 ? byModule[byModule.length - 1] : null,
        });
      },
      error: (err) => console.error("Failed to compute quiz insights", err),
    });
    return () => sub.unsubscribe();
  }, [user, modules]);

  return insights;
}

const EMPTY_FLASHCARD_INSIGHTS: FlashcardInsights = {
  totalReviewed: 0,
  totalKnown: 0,
  overallKnownPct: null,
  byModule: [],
};

/** Real flashcard mastery, not just "a deck exists" — see this file's own
 * header comment. Unlike quiz attempts, FlashcardReview rows are already
 * "latest rating per card" (put, not add — see that type's own comment),
 * so no best-of dedup is needed here. */
export function useFlashcardInsights(modules: Module[]): FlashcardInsights {
  const { user } = useAuth();
  const [insights, setInsights] = useState<FlashcardInsights>(EMPTY_FLASHCARD_INSIGHTS);

  useEffect(() => {
    if (!user) {
      setInsights(EMPTY_FLASHCARD_INSIGHTS);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.flashcardReviews.toArray()).subscribe({
      next: (reviews: FlashcardReview[]) => {
        if (reviews.length === 0) {
          setInsights(EMPTY_FLASHCARD_INSIGHTS);
          return;
        }

        const moduleById = new Map(modules.map((m) => [m.id, m]));
        const byModuleAcc = new Map<string, { known: number; total: number }>();
        let totalKnown = 0;
        for (const review of reviews) {
          if (review.knew) totalKnown++;
          const moduleId = moduleIdFromDocId(review.docId);
          if (moduleId && moduleById.has(moduleId)) {
            const acc = byModuleAcc.get(moduleId) ?? { known: 0, total: 0 };
            acc.total += 1;
            if (review.knew) acc.known += 1;
            byModuleAcc.set(moduleId, acc);
          }
        }

        const byModule: ModuleFlashcardStats[] = [...byModuleAcc.entries()]
          .map(([moduleId, acc]) => {
            const m = moduleById.get(moduleId);
            return {
              moduleId,
              code: m?.code ?? "",
              title: m?.title ?? moduleId,
              knownPct: acc.known / acc.total,
              reviewedCount: acc.total,
            };
          })
          .sort((a, b) => a.knownPct - b.knownPct);

        setInsights({
          totalReviewed: reviews.length,
          totalKnown,
          overallKnownPct: totalKnown / reviews.length,
          byModule,
        });
      },
      error: (err) => console.error("Failed to compute flashcard insights", err),
    });
    return () => sub.unsubscribe();
  }, [user, modules]);

  return insights;
}
