import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  XCircle,
  Brain,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AiContentTabKey = "summary" | "flashcards" | "quiz";

/** A small segmented control for switching between a material's generated
 * AI content — summary, flashcards, and quiz used to all render stacked on
 * one page at once (increasingly long scroll as a student generated more
 * of them); this lets the reader routes show exactly one at a time
 * instead, while keeping each route's own summary/flashcard/quiz JSX
 * otherwise unchanged (just wrapped in `activeTab === "…"` in the caller)
 * rather than forcing all three routes through one big shared content
 * component that would need to reconcile their genuinely different
 * layouts. */
export function AiContentTabStrip({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: AiContentTabKey; label: string; available: boolean }[];
  active: AiContentTabKey;
  onChange: (key: AiContentTabKey) => void;
}) {
  const visible = tabs.filter((t) => t.available);
  if (visible.length < 2) return null;
  return (
    <div className="mt-10 flex items-center gap-1.5 overflow-x-auto rounded-full bg-secondary/60 p-1">
      {visible.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all",
            active === tab.key
              ? "bg-prestige-deep text-prestige-cream"
              : "text-prestige-mid hover:text-prestige-deep",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Shared flashcard/quiz rendering for Phase J — originally written inline
 * in documents.$docId.tsx (personal documents), extracted here so the
 * reader (catalog materials) and collections can reuse the exact same
 * UI rather than a second copy that could drift out of sync.
 *
 * `reviews`/`onReview` are optional (same "existing callers still render
 * fine without them" precedent as QuizPanel's own `attempts`/`onSubmit`)
 * — before this, a flashcard deck was pure flip-through with no learning
 * signal captured at all; rating a card after seeing its answer is what
 * lets a real "known" count exist anywhere in this app.
 *
 * A light spaced-repetition ordering, not a full date-scheduled system:
 * cards never rated come first, "Still learning" cards next, "I knew
 * this" cards last — so opening the same deck again naturally surfaces
 * whatever needs practice before what's already solid. The priority order
 * is snapshotted once per mount (`initialReviews`), not recomputed live
 * off every rating — reordering the deck under a student's feet mid-
 * session, right as they rate a card, would be disorienting; freezing it
 * to "how things stood when I opened this deck" means the reordering
 * only ever happens between sessions, which is exactly when it should. */
export function FlashcardDeck({
  cards,
  reviews,
  onReview,
}: {
  cards: { front: string; back: string }[];
  // cardIndex -> knew, from useFlashcardReviews(docId).
  reviews?: Record<number, boolean>;
  onReview?: (cardIndex: number, knew: boolean) => void;
}) {
  const [initialReviews] = useState(reviews);
  const displayOrder = useMemo(() => {
    const priority = (cardIndex: number): number => {
      const rating = initialReviews?.[cardIndex];
      if (rating === undefined) return 0;
      return rating ? 2 : 1;
    };
    return cards.map((_, i) => i).sort((a, b) => priority(a) - priority(b));
  }, [cards, initialReviews]);
  const wasReordered = initialReviews && Object.keys(initialReviews).length > 0;

  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cardIndex = displayOrder[position];
  const card = cards[cardIndex];
  const cardRating = reviews?.[cardIndex];
  const knownCount = reviews ? Object.values(reviews).filter(Boolean).length : 0;
  const reviewedCount = reviews ? Object.keys(reviews).length : 0;

  const goTo = (next: number) => {
    setFlipped(false);
    setPosition(Math.max(0, Math.min(cards.length - 1, next)));
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-mid">
          Flashcards
        </p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {reviews && reviewedCount > 0 && `${knownCount}/${cards.length} known · `}
          {position + 1} / {cards.length}
        </p>
      </div>
      {wasReordered && position === 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Showing cards you're still learning first.
        </p>
      )}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="mt-3 flex min-h-[160px] w-full flex-col items-center justify-center rounded-2xl bg-card p-6 text-center ring-1 ring-border/60 transition-all hover:ring-prestige-gold/40 active:scale-[0.99]"
      >
        <p className="text-[9px] font-semibold uppercase tracking-widest text-prestige-mid/70">
          {flipped ? "Answer" : "Question"} · tap to flip
        </p>
        <p className="mt-3 text-base leading-relaxed text-prestige-deep">
          {flipped ? card.back : card.front}
        </p>
        {cardRating !== undefined && (
          <p
            className={cn(
              "mt-3 text-[10px] font-semibold uppercase tracking-widest",
              cardRating ? "text-prestige-mid" : "text-destructive",
            )}
          >
            {cardRating ? "Marked known" : "Marked still learning"}
          </p>
        )}
      </button>

      {flipped && onReview && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onReview(cardIndex, false)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold ring-1 transition-all active:scale-[0.97]",
              cardRating === false
                ? "bg-destructive/10 text-destructive ring-destructive/40"
                : "text-prestige-deep ring-border/60 hover:bg-secondary",
            )}
          >
            <Brain className="h-3.5 w-3.5" strokeWidth={1.75} />
            Still learning
          </button>
          <button
            type="button"
            onClick={() => onReview(cardIndex, true)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold ring-1 transition-all active:scale-[0.97]",
              cardRating === true
                ? "bg-prestige-mid/10 text-prestige-mid ring-prestige-mid/40"
                : "text-prestige-deep ring-border/60 hover:bg-secondary",
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>I knew this</span>
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={position === 0}
          onClick={() => goTo(position - 1)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-prestige-deep ring-1 ring-border/60 transition-all hover:bg-secondary active:scale-[0.97] disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Previous
        </button>
        <button
          type="button"
          disabled={position === cards.length - 1}
          onClick={() => goTo(position + 1)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-prestige-deep ring-1 ring-border/60 transition-all hover:bg-secondary active:scale-[0.97] disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

export function QuizPanel({
  questions,
  onSubmit,
  attempts,
}: {
  questions: { question: string; options: string[]; correctIndex: number }[];
  // Called with the final score/answers when the student submits — see
  // db.ts's QuizAttempt for why the caller persists this as history rather
  // than this component owning any storage itself (it's pure render+local
  // state, same as FlashcardDeck above).
  onSubmit?: (score: number, total: number, answers: Record<number, number>) => void;
  // Newest-first, from useQuizAttempts(docId) — optional so existing
  // callers that haven't wired attempt history yet still render fine.
  attempts?: { score: number; total: number }[];
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const allAnswered = Object.keys(answers).length === questions.length;
  const score = questions.filter((q, i) => answers[i] === q.correctIndex).length;
  const bestScore =
    attempts && attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : undefined;

  const selectAnswer = (qIndex: number, optIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  const submit = () => {
    setSubmitted(true);
    onSubmit?.(score, questions.length, answers);
  };

  const retake = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-mid">
          Quiz
        </p>
        {submitted ? (
          <p className="text-[10px] uppercase tracking-widest text-prestige-mid">
            Score: {score} / {questions.length}
          </p>
        ) : (
          attempts &&
          attempts.length > 0 && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Best: {bestScore} / {questions.length} &middot; {attempts.length}{" "}
              {attempts.length === 1 ? "attempt" : "attempts"}
            </p>
          )
        )}
      </div>
      <div className="mt-3 space-y-5">
        {questions.map((q, qIndex) => {
          const selected = answers[qIndex];
          return (
            <div key={qIndex} className="rounded-2xl bg-card p-5 ring-1 ring-border/60">
              <p className="text-sm font-medium text-prestige-deep">
                {qIndex + 1}. {q.question}
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, optIndex) => {
                  const isSelected = selected === optIndex;
                  const isCorrect = optIndex === q.correctIndex;
                  const showResult = submitted && (isSelected || isCorrect);
                  return (
                    <button
                      key={optIndex}
                      type="button"
                      onClick={() => selectAnswer(qIndex, optIndex)}
                      disabled={submitted}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left text-sm ring-1 transition-all ${
                        submitted
                          ? isCorrect
                            ? "bg-prestige-mid/10 ring-prestige-mid/40 text-prestige-deep"
                            : isSelected
                              ? "bg-destructive/10 ring-destructive/40 text-prestige-deep"
                              : "ring-border/50 text-foreground/70"
                          : isSelected
                            ? "bg-prestige-deep text-prestige-cream ring-prestige-deep"
                            : "ring-border/60 text-foreground/80 hover:bg-secondary active:scale-[0.99]"
                      }`}
                    >
                      {showResult &&
                        (isCorrect ? (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-prestige-mid"
                            strokeWidth={1.75}
                          />
                        ) : (
                          <XCircle
                            className="h-4 w-4 shrink-0 text-destructive"
                            strokeWidth={1.75}
                          />
                        ))}
                      <span className="min-w-0 flex-1">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5">
        {submitted ? (
          <button
            type="button"
            onClick={retake}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.97]"
          >
            <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Retake
          </button>
        ) : (
          <button
            type="button"
            disabled={!allAnswered}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
          >
            Submit quiz
          </button>
        )}
      </div>
    </div>
  );
}
