import { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCw, XCircle } from "lucide-react";

/** Shared flashcard/quiz rendering for Phase J — originally written inline
 * in documents.$docId.tsx (personal documents), extracted here so the
 * reader (catalog materials) and collections can reuse the exact same
 * UI rather than a second copy that could drift out of sync. */
export function FlashcardDeck({ cards }: { cards: { front: string; back: string }[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  const goTo = (next: number) => {
    setFlipped(false);
    setIndex(Math.max(0, Math.min(cards.length - 1, next)));
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-mid">
          Flashcards
        </p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {index + 1} / {cards.length}
        </p>
      </div>
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
      </button>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-prestige-deep ring-1 ring-border/60 transition-all hover:bg-secondary active:scale-[0.97] disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Previous
        </button>
        <button
          type="button"
          disabled={index === cards.length - 1}
          onClick={() => goTo(index + 1)}
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
}: {
  questions: { question: string; options: string[]; correctIndex: number }[];
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const allAnswered = Object.keys(answers).length === questions.length;
  const score = questions.filter((q, i) => answers[i] === q.correctIndex).length;

  const selectAnswer = (qIndex: number, optIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
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
        {submitted && (
          <p className="text-[10px] uppercase tracking-widest text-prestige-mid">
            Score: {score} / {questions.length}
          </p>
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
            onClick={() => setSubmitted(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
          >
            Submit quiz
          </button>
        )}
      </div>
    </div>
  );
}
