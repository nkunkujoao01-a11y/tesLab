import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/tutorials")({
  head: () => ({
    meta: [
      { title: "Tutorials — eLearn" },
      {
        name: "description",
        content: "How offline AI, downloads, NUST sync, and quizzes/flashcards work in eLearn.",
      },
    ],
  }),
  component: TutorialsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-medium text-prestige-deep">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

/** A small numbered walkthrough card, same visual pattern already used
 * for the Gemini-key steps in settings.tsx — reused here rather than
 * inventing a second "how to" layout. */
function Steps({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-4">
      <ol className="space-y-3">
        {items.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-prestige-gold text-[10px] font-bold text-prestige-deep">
              {i + 1}
            </span>
            <p className="text-[12px] leading-relaxed text-foreground/85">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Four topics, on purpose — not a full manual. Reuses real explanatory
 * language already written for legal.tsx/settings.tsx rather than
 * inventing new claims about what the app does. */
function TutorialsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[680px] px-6 pb-24 pt-10 lg:pt-14">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Profile
        </Link>

        <p className="mt-6 eyebrow">eLearn</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-prestige-deep">
          Tutorials
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A few key features, explained at your own pace.
        </p>

        <Section title="How offline AI works">
          <p>
            Summaries, quizzes, flashcards, and the study assistant can run entirely on your own
            device — a small AI model downloaded once, then used with no network calls afterward, so
            it works even with no signal. If you connect your own free Google AI (Gemini) key in
            Settings, the app can also use Google's cloud AI instead, which is usually faster and
            better quality when you're online. eLearn automatically falls back to on-device AI
            whenever you're offline or haven't connected a key.
          </p>
          <p>
            On-device generation is slower on older or lower-memory phones — that's the model
            running locally on your hardware, not a network delay. Connecting a free Gemini key is
            the fastest way to speed this up.
          </p>
        </Section>

        <Section title="Downloading modules for offline use">
          <p>
            Download a module's materials once on Wi-Fi, then read, summarize, and quiz yourself on
            them anywhere — no data, no signal needed afterward.
          </p>
          <Steps
            items={[
              "Open a module from Library or Courses.",
              'Tap the download icon next to any material, or "Download all" for the whole module.',
              "Once downloaded, it's available offline — check Profile > Downloads any time to see what's stored on this device and how much space it's using.",
            ]}
          />
        </Section>

        <Section title="Connecting your NUST account">
          <p>
            Connecting your real NUST student number and password pulls in your actual enrolled
            courses, materials, and grades from NUST eLearning (Moodle) — kept in sync automatically
            after that.
          </p>
          <Steps
            items={[
              "Go to Settings > NUST eLearning.",
              "Enter the same student number and password you use at elearning.nust.na.",
              "Your password is sent once to connect and never stored — only a revocable access token is kept, so you can disconnect at any time.",
            ]}
          />
        </Section>

        <Section title="Quizzes & flashcards">
          <p>
            Generated from a module's own materials or your personal documents — real questions
            based on what you actually uploaded or downloaded, not generic ones. Quiz results and
            flashcard ratings ("I knew this" / "I didn't know this") feed directly into your
            Progress page, so your own record reflects real understanding, not just whether you
            opened something.
          </p>
        </Section>
      </div>
    </div>
  );
}
