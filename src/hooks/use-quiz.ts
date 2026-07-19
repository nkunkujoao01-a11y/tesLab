import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import { getUserDb, type GeneratedFlashcardSet, type GeneratedQuiz } from "@/lib/db";
import {
  generateFlashcards,
  buildSingleQuestionPrompt,
  parseQuizResponse,
  QUIZ_QUESTION_COUNT,
  type QuizQuestion,
} from "@/lib/quiz-gen";
import { askChatModel } from "@/lib/ai-chat";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/hooks/use-activity";

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

/** Extractive, so this is instant and needs no chat model download — the
 * "generating" state exists only for a consistent UX with the AI-backed
 * quiz generator below, not because this is genuinely slow. */
export function useGenerateFlashcards() {
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const generate = useCallback(
    async (docId: string, sourceText: string) => {
      if (!user) return;
      setPendingIds((prev) => new Set(prev).add(docId));
      try {
        const cards = generateFlashcards(sourceText);
        if (cards.length === 0) {
          toast.error("This document doesn't have enough heading structure for flashcards yet.");
          return;
        }
        await getUserDb(user.id).generatedFlashcardSets.put({
          docId,
          cards,
          generatedAt: Date.now(),
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

// One question per model call (see buildSingleQuestionPrompt's own
// comment for why) needs far less headroom than the original all-at-once
// attempt — a single question's worth of output, not several.
const QUIZ_MAX_NEW_TOKENS = 150;

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
      setPendingIds((prev) => new Set(prev).add(docId));
      const questions: QuizQuestion[] = [];
      try {
        for (let i = 1; i <= QUIZ_QUESTION_COUNT; i++) {
          setProgress((prev) => ({ ...prev, [docId]: { current: i, total: QUIZ_QUESTION_COUNT } }));
          const prompt = buildSingleQuestionPrompt(
            sourceText,
            i,
            questions.map((q) => q.question),
          );
          try {
            const raw = await askChatModel(
              [{ role: "user", content: prompt }],
              undefined,
              QUIZ_MAX_NEW_TOKENS,
            );
            const parsed = parseQuizResponse(raw);
            if (parsed.length > 0) questions.push(parsed[0]);
          } catch (err) {
            // One bad question shouldn't sink the rest — same "exclude,
            // don't fake" discipline as parseQuizResponse itself.
            console.error(`Failed to generate question ${i}`, err);
          }
        }
        if (questions.length === 0) {
          toast.error("Couldn't generate a quiz from this document. Try again.");
          return;
        }
        await getUserDb(user.id).generatedQuizzes.put({
          docId,
          questions,
          generatedAt: Date.now(),
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
