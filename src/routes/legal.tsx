import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Terms & Privacy — eLearn" },
      { name: "description", content: "Terms of use and privacy policy for eLearn." },
    ],
  }),
  component: LegalPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-medium text-prestige-deep">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

/** A genuine first draft, describing what this app actually does (see the
 * migrations under supabase/migrations for the real schema this reflects)
 * — not template legal boilerplate. Reachable from Profile and the
 * sign-up flow; not a substitute for review by whoever is legally
 * responsible for this deployment before it's treated as final. */
function LegalPage() {
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
          Terms & Privacy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated 2026-07-24.</p>

        <Section title="What this app is">
          <p>
            eLearn is a study platform built for Namibia University of Science and Technology (NUST)
            students — offline-first course materials, AI-generated summaries/quizzes/ flashcards,
            and (for students who connect their real NUST credentials) a live sync of your actual
            enrolled courses, materials, and grades from NUST eLearning (Moodle).
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You can sign in with an email and password, a Google account, or your NUST student
            number and password. Signing in with your NUST student number links your account to a
            system-generated address ending in "@nust-student.invalid" — this is never a real,
            reachable email address, only an internal identifier; it's never shown to other
            students.
          </p>
          <p>
            Your profile stores your name, program, university, and faculty — shown to you and, for
            a module you're enrolled in, to the lecturer(s) administering it.
          </p>
        </Section>

        <Section title="What we store, and where">
          <p>
            Downloaded course materials, generated summaries, quizzes, and flashcards, and your
            uploaded personal documents are kept on your own device (in your browser's local
            storage) so the app works offline. Some of this — your uploaded documents' extracted
            text and summaries, your reading progress, and your activity history — also syncs to our
            servers (hosted on Supabase) so it follows you across your own devices. Nothing you
            store is visible to other students; a lecturer administering a module you're enrolled in
            can see your enrollment, any grades they've recorded for you, your materials-read
            progress in that module, and messages you exchange with them.
          </p>
        </Section>

        <Section title="AI features">
          <p>
            Summaries, quizzes, flashcards, and the study assistant can run entirely on your own
            device (a small AI model downloaded once, never sent anywhere) or, if you connect your
            own free Google AI (Gemini) key in Settings, through Google's cloud AI service using
            your key. We never see or store your cloud AI key in a readable form, and we never use a
            shared key on your behalf — every cloud request uses your own connected key, and content
            sent to it is subject to Google's own terms for that service.
          </p>
        </Section>

        <Section title="Your real NUST Moodle data">
          <p>
            If you connect your NUST student number and password, we use it once, server-side, to
            fetch your real enrolled courses, materials, and grades directly from NUST's own Moodle
            system, then keep that connection synced automatically. Your Moodle password is used
            only to authenticate that request and is not stored in readable form afterward.
            Disconnecting removes the synced course data from your account.
          </p>
        </Section>

        <Section title="Feedback and the research study">
          <p>
            Feedback you submit from Profile (a message, an optional star rating, optional
            screenshots) is tied to your account and reviewed by whoever administers this project.
          </p>
          <p>
            Separately, this app is also part of a NUST-approved research study on eLearning
            usability — participation is entirely optional, and any data collected for that study (a
            one-time consent response, an optional usability survey) is anonymous: it is never
            linked to your name, student number, or account, only to a random identifier generated
            on your device. See the consent screen shown on your first visit for the full details of
            that study.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            You can disconnect your NUST Moodle account and clear your device's local storage at any
            time from Profile and Settings. To request deletion of your account and the data we hold
            on our servers, contact whoever administers this deployment for you.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            This page may be updated as the app changes. Continuing to use eLearn after an update
            means you accept the current version.
          </p>
        </Section>
      </div>
    </div>
  );
}
