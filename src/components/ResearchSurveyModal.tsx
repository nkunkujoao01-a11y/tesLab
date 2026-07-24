// The post-task questionnaire for the same usability study
// ResearchConsentGate introduces — System Usability Scale, then
// perceived-usefulness (TAM/UTAUT), then data-efficiency/satisfaction,
// then optional open-ended questions. Paginated by section rather than
// one long scroll of 23 questions — real usability studies of usability
// studies consistently find a wall of Likert rows gets abandoned partway;
// one focused section at a time, with a visible step count, reads as a
// short task instead of an open-ended chore. Auto-triggered once after
// real usage (see use-research-study.ts), but also reachable anytime,
// voluntarily, from Profile — this component doesn't know or care which
// path opened it, both just render it with `onClose`.
import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubmitResearchSurvey, useResearchSurveyDraft } from "@/hooks/use-research-study";
import type { ResearchSurveyAnswers } from "@/lib/supabase";

const SUS_QUESTIONS: [number, string][] = [
  [1, "I think that I would like to use this platform frequently."],
  [2, "I found the platform unnecessarily complex."],
  [3, "I thought the platform was easy to use."],
  [
    4,
    "I think that I would need the support of a technical person to be able to use this platform.",
  ],
  [5, "I found the various functions in this platform were well integrated."],
  [6, "I thought there was too much inconsistency in this platform."],
  [7, "I would imagine that most people would learn to use this platform very quickly."],
  [8, "I found the platform very cumbersome to use."],
  [9, "I felt very confident using the platform."],
  [10, "I needed to learn a lot of things before I could get going with this platform."],
];

const TAM_QUESTIONS: [number, string][] = [
  [11, "Using this platform helped me to access study materials more easily."],
  [
    12,
    "The offline feature (downloading lectures) allowed me to study even without an internet connection.",
  ],
  [13, "The AI summaries helped me to understand the main points of the lecture notes faster."],
  [14, "I found it easy to download modules for offline use."],
  [15, "Navigating between downloaded content and summaries was straightforward."],
];

const DATA_QUESTIONS: [number, string][] = [
  [
    16,
    "Using this platform would save me money on mobile data compared to using the regular NUST Moodle site.",
  ],
  [
    17,
    "I believe this platform is a practical solution for students with limited internet access.",
  ],
  [18, "I was able to complete the tasks (download, view summary) successfully on my own."],
  [19, "I would recommend this platform to other students."],
  [20, "Overall, I am satisfied with the performance of this platform."],
];

const CONTINUE_DEVELOPMENT_QUESTION =
  "Would you like to see this app continue being developed with more features?";

const OPEN_QUESTIONS: [number, string][] = [
  [22, "What was the best feature of this platform?"],
  [23, "What was the most difficult part of using this platform?"],
  [24, "Do you have any suggestions for improvement?"],
];

type Step = { key: string; title: string; instructions: string };
const STEPS: Step[] = [
  {
    key: "sus",
    title: "System usability",
    instructions: "How strongly do you agree or disagree with each statement?",
  },
  {
    key: "tam",
    title: "Usefulness & ease of use",
    instructions: "Based on your experience using the platform.",
  },
  {
    key: "data",
    title: "Data efficiency & satisfaction",
    instructions: "Based on your experience using the platform.",
  },
  { key: "open", title: "A few open questions", instructions: "Optional, but genuinely helpful." },
];

function ScaleRow({
  number,
  question,
  value,
  onChange,
}: {
  number: number;
  question: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="border-t border-border/60 py-4 first:border-none first:pt-0">
      <p className="text-sm leading-relaxed text-foreground/90">{question}</p>
      <div className="mt-3 flex items-center justify-between gap-1.5">
        <span className="w-16 shrink-0 text-[10px] text-muted-foreground">Disagree</span>
        <div className="flex flex-1 items-center justify-center gap-2 sm:gap-4">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              aria-label={`${v} out of 5`}
              onClick={() => onChange(v)}
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 transition-all active:scale-90",
                value === v
                  ? "bg-prestige-deep text-prestige-cream ring-prestige-deep"
                  : "text-muted-foreground ring-border/70 hover:bg-secondary",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">Agree</span>
      </div>
      <p className="mt-1 text-right text-[10px] text-muted-foreground">Question {number}</p>
    </div>
  );
}

export function ResearchSurveyModal({ onClose }: { onClose: () => void }) {
  const { submit, submitting } = useSubmitResearchSurvey();
  const { draft, loading: draftLoading, saveDraft, clearDraft } = useResearchSurveyDraft();
  const [stepIndex, setStepIndex] = useState(0);
  const [sus, setSus] = useState<Record<number, number>>({});
  const [tam, setTam] = useState<Record<number, number>>({});
  const [dataEfficiency, setDataEfficiency] = useState<Record<number, number>>({});
  const [openEnded, setOpenEnded] = useState<Record<number, string>>({});
  const [continueDevelopment, setContinueDevelopment] = useState<number | undefined>(undefined);
  // Distinguishes "haven't hydrated from the saved draft yet" from a real
  // step-0 first visit — without this, the very first render's blank
  // state would immediately overwrite a real in-progress draft before the
  // hydration effect below even runs.
  const hydrated = useRef(false);

  // Restore an in-progress draft exactly once, the moment it's done
  // loading — never again after that (this component only mounts once
  // per open), so a student's own further edits aren't fought by this
  // effect re-firing.
  useEffect(() => {
    if (draftLoading || hydrated.current) return;
    hydrated.current = true;
    if (draft) {
      setStepIndex(draft.stepIndex);
      setSus(draft.sus);
      setTam(draft.tam);
      setDataEfficiency(draft.dataEfficiency);
      setOpenEnded(draft.openEnded);
      setContinueDevelopment(draft.continueDevelopment);
    }
  }, [draft, draftLoading]);

  // Persists on every change once hydration has happened — so closing the
  // app (or just this modal) mid-survey never loses progress. Skipped
  // before hydration so the blank initial state can't clobber a real
  // saved draft in the instant before it loads.
  useEffect(() => {
    if (!hydrated.current) return;
    saveDraft({ stepIndex, sus, tam, dataEfficiency, openEnded, continueDevelopment });
  }, [stepIndex, sus, tam, dataEfficiency, openEnded, continueDevelopment, saveDraft]);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleSubmit = async () => {
    const answers: ResearchSurveyAnswers = {
      sus,
      tam,
      dataEfficiency,
      openEnded,
      continueDevelopment,
    };
    const ok = await submit(answers);
    if (ok) {
      clearDraft();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-screen max-w-[620px] flex-col px-6 py-10 lg:py-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-prestige-deep">
              {step.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{step.instructions}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-prestige-mid transition-colors hover:bg-secondary hover:text-prestige-deep"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-2 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= stepIndex ? "bg-prestige-gold" : "bg-secondary",
              )}
            />
          ))}
        </div>

        <div className="mt-8 flex-1">
          {step.key === "sus" &&
            SUS_QUESTIONS.map(([n, q]) => (
              <ScaleRow
                key={n}
                number={n}
                question={q}
                value={sus[n]}
                onChange={(v) => setSus((prev) => ({ ...prev, [n]: v }))}
              />
            ))}
          {step.key === "tam" &&
            TAM_QUESTIONS.map(([n, q]) => (
              <ScaleRow
                key={n}
                number={n}
                question={q}
                value={tam[n]}
                onChange={(v) => setTam((prev) => ({ ...prev, [n]: v }))}
              />
            ))}
          {step.key === "data" &&
            DATA_QUESTIONS.map(([n, q]) => (
              <ScaleRow
                key={n}
                number={n}
                question={q}
                value={dataEfficiency[n]}
                onChange={(v) => setDataEfficiency((prev) => ({ ...prev, [n]: v }))}
              />
            ))}
          {step.key === "open" && (
            <div className="space-y-5">
              <ScaleRow
                number={21}
                question={CONTINUE_DEVELOPMENT_QUESTION}
                value={continueDevelopment}
                onChange={setContinueDevelopment}
              />
              {OPEN_QUESTIONS.map(([n, q]) => (
                <div key={n}>
                  <label className="text-sm font-medium text-prestige-deep">{q}</label>
                  <textarea
                    value={openEnded[n] ?? ""}
                    onChange={(e) => setOpenEnded((prev) => ({ ...prev, [n]: e.target.value }))}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-lg border border-border/70 bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50"
                    placeholder="Optional"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-border/60 pt-5">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            className="rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97] disabled:opacity-0"
          >
            Back
          </button>
          {isLastStep ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-5 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
              Submit survey
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
              className="rounded-lg bg-prestige-deep px-5 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97]"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
