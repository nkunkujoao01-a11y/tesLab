import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CloudDownload, Sparkles, Compass, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// A small fixed field of twinkling background particles — purely
// decorative "alive" motion behind the content, independent of which
// slide is showing (so it doesn't remount/reset on every step change the
// way the motif and copy deliberately do). Positions/delays/sizes are
// pre-generated once per mount, not re-randomized on every render.
type Particle = { top: number; left: number; size: number; delay: number; duration: number };

function generateParticles(count: number): Particle[] {
  // A fixed seed sequence (not Math.random()) so this is stable across
  // server render and client hydration — a real mismatch found via
  // testing when this used Math.random() directly (React logs a
  // hydration warning the moment the server's and client's random
  // positions disagree).
  const seeds = [
    0.12, 0.83, 0.34, 0.91, 0.05, 0.67, 0.45, 0.28, 0.72, 0.58, 0.19, 0.95, 0.4, 0.81, 0.63,
  ];
  return Array.from({ length: count }).map((_, i) => {
    const a = seeds[i % seeds.length];
    const b = seeds[(i * 3 + 1) % seeds.length];
    return {
      top: a * 90 + 5,
      left: b * 90 + 5,
      size: 3 + ((i * 7) % 5),
      delay: (i * 0.37) % 3,
      duration: 2.5 + ((i * 11) % 30) / 10,
    };
  });
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "eLearn - Learn anywhere, even offline" },
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
    title: "Study anywhere. Even off the grid.",
    body: "Download your modules on campus Wi-Fi and open them later, on the taxi, at home, on the veld. The library travels with you, no signal required.",
    icon: CloudDownload,
    motif: () => (
      <div className="relative h-full w-full">
        <div className="absolute inset-0 rounded-3xl bg-prestige-deep" />
        <div
          aria-hidden
          className="absolute inset-0 rounded-3xl opacity-70"
          style={{
            background:
              "radial-gradient(60% 45% at 80% 15%, color-mix(in oklab, var(--prestige-gold) 30%, transparent), transparent 70%)",
          }}
        />
        <div className="absolute inset-4 rounded-2xl border border-prestige-gold/40" />
        <div className="absolute inset-x-10 top-14 space-y-3">
          <div
            className="animate-pop-in h-2 w-24 rounded-full bg-prestige-gold/70"
            style={{ animationDelay: "80ms" }}
          />
          <div
            className="animate-pop-in h-2 w-40 rounded-full bg-prestige-cream/20"
            style={{ animationDelay: "180ms" }}
          />
          <div
            className="animate-pop-in h-2 w-32 rounded-full bg-prestige-cream/20"
            style={{ animationDelay: "280ms" }}
          />
        </div>
        <div className="absolute inset-x-10 bottom-14">
          <div className="mb-3 h-px w-full bg-prestige-cream/15" />
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-prestige-gold">Offline</p>
              <p className="font-display text-lg text-prestige-cream">Chapter 04</p>
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
    title: "Watch a lecture become a page you can hold.",
    body: "The on-device model reads your slides and writes a clean summary right here, no internet needed to generate it, no waiting on a server.",
    icon: Sparkles,
    motif: () => (
      <div className="relative h-full w-full overflow-hidden">
        <div className="absolute inset-0 rounded-3xl bg-prestige-cream" />
        <div className="absolute inset-6 overflow-hidden rounded-2xl border border-prestige-deep/10 bg-white/60 p-6">
          <div
            aria-hidden
            className="animate-shimmer-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-prestige-gold/25 to-transparent"
          />
          <p className="eyebrow">AI summary</p>
          <div className="mt-3 space-y-2">
            <div
              className="animate-pop-in h-2 w-full origin-left rounded-full bg-prestige-deep/10"
              style={{ animationDelay: "60ms" }}
            />
            <div
              className="animate-pop-in h-2 w-5/6 origin-left rounded-full bg-prestige-deep/10"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="animate-pop-in h-2 w-4/6 origin-left rounded-full bg-prestige-deep/10"
              style={{ animationDelay: "240ms" }}
            />
            <div
              className="animate-pop-in h-2 w-3/6 origin-left rounded-full bg-prestige-deep/10"
              style={{ animationDelay: "330ms" }}
            />
          </div>
          <div className="mt-5 h-px w-full bg-prestige-deep/5" />
          <div className="animate-glow-pulse mt-4 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-prestige-gold">
            Regenerate
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Chapter three",
    title: "Watch a real streak build, week by week.",
    body: "A quiet, honest record of the reading you actually did: modules, chapters, streaks, and the rank of your own effort. No fake numbers.",
    icon: Compass,
    motif: () => (
      <div className="relative h-full w-full">
        <div className="absolute inset-0 rounded-3xl bg-prestige-deep" />
        <div
          aria-hidden
          className="absolute inset-0 rounded-3xl opacity-60"
          style={{
            background:
              "radial-gradient(50% 40% at 20% 85%, color-mix(in oklab, var(--prestige-gold) 25%, transparent), transparent 70%)",
          }}
        />
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
                  className={cn("animate-pop-in aspect-square rounded-[3px]", shade)}
                  style={{ animationDelay: `${(i % 12) * 22 + Math.floor(i / 12) * 30}ms` }}
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
  const particles = useMemo(() => generateParticles(14), []);
  const Icon = slide.icon;

  const next = () => {
    if (last) navigate({ to: "/login" });
    else setStep((s) => s + 1);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background glows — slow, continuous drift for a sense of
          depth/life behind the content, not tied to any slide's own motif
          (which fully remounts on every step change). Purely decorative:
          aria-hidden, and disabled entirely under prefers-reduced-motion
          (see styles.css). */}
      <div
        aria-hidden
        className="animate-drift pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--prestige-gold) 55%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="animate-drift-reverse pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--prestige-mid) 55%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="animate-drift pointer-events-none absolute top-1/3 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          animationDelay: "-4s",
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--prestige-gold) 40%, transparent), transparent)",
        }}
      />

      {/* Twinkling particle field — small, scattered, continuously alive,
          independent of slide changes (see generateParticles' own
          comment). */}
      {particles.map((p, i) => (
        <div
          key={i}
          aria-hidden
          className="animate-twinkle pointer-events-none absolute rounded-full bg-prestige-gold"
          style={{
            top: `${p.top}%`,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      {/* A large, faint, slowly rotating emblem of the current chapter's
          own icon — purely decorative "this page is alive" motion, and a
          bit of extra visual storytelling per chapter beyond the motif
          card itself. Remounts (and so restarts its rotation) per step,
          same as the motif/copy below — a deliberate beat, not a bug. */}
      <Icon
        key={step}
        aria-hidden
        className="animate-orbit-spin pointer-events-none absolute -top-10 -right-16 h-56 w-56 text-prestige-deep/[0.06] lg:h-72 lg:w-72"
        strokeWidth={0.75}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-6 pt-12 pb-10 lg:max-w-[520px] lg:px-10 lg:pt-16">
        {/* Wordmark */}
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Namibia University of Science and Technology</p>
            <p className="mt-1 font-display text-xl font-medium tracking-tight">
              eLearn
              <span
                className="animate-glow-pulse ml-1 inline-block h-1.5 w-1.5 translate-y-[-6px] rounded-full bg-prestige-gold"
                aria-hidden
              />
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="text-xs font-semibold uppercase tracking-widest text-prestige-deep/85 hover:text-prestige-deep"
          >
            Skip
          </button>
        </div>

        {/* Motif — the outer element handles the one-shot entrance
            (animate-rise, remounts and restarts per step); the inner
            wrapper handles a separate, continuous gentle bob
            (animate-float) so the card feels alive even once it's
            settled, not just on the moment it appears. Two different
            elements because both classes set the same `animation`
            property — put on one element, the second would just
            silently overwrite the first instead of combining. */}
        <div
          key={step}
          className="animate-rise mt-10 aspect-[4/5] w-full"
          style={{ animationDuration: "0.6s" }}
        >
          <div className="animate-float h-full w-full drop-shadow-xl">{slide.motif()}</div>
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
                  "h-1 rounded-full transition-all duration-300",
                  i === step ? "w-8 bg-prestige-deep" : "w-4 bg-prestige-deep/15",
                )}
              />
            ))}
          </div>
          <button
            onClick={next}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full bg-prestige-deep px-5 py-3 text-sm font-medium text-prestige-cream shadow-lg shadow-prestige-deep/20 transition-transform active:scale-[0.97]",
              last && "animate-glow-pulse",
            )}
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
