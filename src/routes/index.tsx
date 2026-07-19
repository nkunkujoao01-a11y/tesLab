import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  CloudDownload,
  Sparkles,
  Compass,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "eLearn — Learn anywhere, even offline" },
      {
        name: "description",
        content:
          "Download modules on Wi-Fi, study offline. AI summaries, progress tracking, and a reading library built for students.",
      },
    ],
  }),
  component: Onboarding,
});

type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  motif: (className?: string) => React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    eyebrow: "Chapter one",
    title: "Study anywhere, even without internet.",
    body: "Download your modules on campus Wi-Fi and open them later — on the taxi, at home, on the veld. The library travels with you.",
    icon: CloudDownload,
    motif: () => (
      <div className="relative h-full w-full">
        <div className="absolute inset-0 rounded-3xl bg-prestige-deep" />
        <div className="absolute inset-4 rounded-2xl border border-prestige-gold/40" />
        <div className="absolute inset-x-10 top-14 space-y-3">
          <div className="h-2 w-24 rounded-full bg-prestige-gold/70" />
          <div className="h-2 w-40 rounded-full bg-prestige-cream/20" />
          <div className="h-2 w-32 rounded-full bg-prestige-cream/20" />
        </div>
        <div className="absolute inset-x-10 bottom-14">
          <div className="mb-3 h-px w-full bg-prestige-cream/15" />
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-prestige-gold">
                Offline
              </p>
              <p className="font-display text-lg text-prestige-cream">
                Chapter 04
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-prestige-cream/50">
                Downloaded
              </p>
              <p className="font-display text-lg text-prestige-cream">12.4 MB</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Chapter two",
    title: "Turn a lecture into a page you can hold.",
    body: "The on-device model reads your slides and gives you a clean summary. No internet needed to write it, no waiting.",
    icon: Sparkles,
    motif: () => (
      <div className="relative h-full w-full">
        <div className="absolute inset-0 rounded-3xl bg-prestige-cream" />
        <div className="absolute inset-6 rounded-2xl border border-prestige-deep/10 bg-white/60 p-6">
          <p className="eyebrow">AI summary</p>
          <div className="mt-3 space-y-2">
            <div className="h-2 w-full rounded-full bg-prestige-deep/10" />
            <div className="h-2 w-5/6 rounded-full bg-prestige-deep/10" />
            <div className="h-2 w-4/6 rounded-full bg-prestige-deep/10" />
            <div className="h-2 w-3/6 rounded-full bg-prestige-deep/10" />
          </div>
          <div className="mt-5 h-px w-full bg-prestige-deep/5" />
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-prestige-gold">
            Regenerate
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Chapter three",
    title: "Never lose track of a single week.",
    body: "A quiet record of the reading you actually did — modules, chapters, streaks, and the rank of your effort.",
    icon: Compass,
    motif: () => (
      <div className="relative h-full w-full">
        <div className="absolute inset-0 rounded-3xl bg-prestige-deep" />
        <div className="absolute inset-6 rounded-2xl bg-prestige-mid/25 p-6">
          <p className="eyebrow text-prestige-gold">Twelve weeks</p>
          <div className="mt-4 grid grid-cols-12 gap-1.5">
            {Array.from({ length: 84 }).map((_, i) => {
              const intensity = [0, 1, 2, 3][(i * 7) % 4];
              const shade =
                intensity === 0
                  ? "bg-prestige-cream/10"
                  : intensity === 1
                    ? "bg-prestige-gold/25"
                    : intensity === 2
                      ? "bg-prestige-gold/55"
                      : "bg-prestige-gold";
              return (
                <div
                  key={i}
                  className={cn("aspect-square rounded-[3px]", shade)}
                />
              );
            })}
          </div>
        </div>
      </div>
    ),
  },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const last = step === SLIDES.length - 1;

  const next = () => {
    if (last) navigate({ to: "/login" });
    else setStep((s) => s + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-6 pt-12 pb-10 lg:max-w-[520px] lg:px-10 lg:pt-16">
        {/* Wordmark */}
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Namibia University of Science and Technology</p>
            <p className="mt-1 font-display text-xl font-medium tracking-tight">
              eLearn
              <span className="ml-1 inline-block h-1.5 w-1.5 translate-y-[-6px] rounded-full bg-prestige-gold" />
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="text-xs font-semibold uppercase tracking-widest text-prestige-deep/85 hover:text-prestige-deep"
          >
            Skip
          </button>
        </div>

        {/* Motif */}
        <div key={step} className="animate-rise mt-10 aspect-[4/5] w-full">
          {slide.motif()}
        </div>

        {/* Copy */}
        <div key={`copy-${step}`} className="animate-rise mt-8 flex-1">
          <p className="eyebrow">{slide.eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-medium leading-[1.15] tracking-tight text-balance text-prestige-deep">
            {slide.title}
          </h1>
          <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
            {slide.body}
          </p>
        </div>

        {/* Footer controls */}
        <div className="mt-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === step
                    ? "w-8 bg-prestige-deep"
                    : "w-4 bg-prestige-deep/15",
                )}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="group inline-flex items-center gap-2 rounded-full bg-prestige-deep px-5 py-3 text-sm font-medium text-prestige-cream shadow-lg shadow-prestige-deep/20 transition-transform active:scale-[0.97]"
          >
            <span>{last ? "Enter library" : "Continue"}</span>
            <ChevronRight
              className="h-4 w-4 text-prestige-gold transition-transform group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
