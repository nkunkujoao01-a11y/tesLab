import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Github, Heart, Linkedin, Mail } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About - eLearn" },
      { name: "description", content: "About the creator of eLearn." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
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
          About the creator
        </h1>
        <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-foreground/85">
          eLearn is built and maintained by Joao Ndongala Nkunku, a NUST student, as part of an
          honours research project on low-bandwidth eLearning for Namibian university students.
          Every feature here, offline-first downloads, on-device AI, real NUST Moodle sync, is
          designed and built by one person, in between studies.
        </p>
        <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-foreground/85">
          Beyond eLearn, he builds websites and web tools more generally — feel free to reach out
          any time.
        </p>

        <div className="mt-8 rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <Heart className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-prestige-deep">Like this app?</p>
              <p className="text-[11px] text-muted-foreground">
                A follow on GitHub genuinely helps, and costs nothing
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://github.com/iZIer01"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97]"
            >
              <Github className="h-3.5 w-3.5" strokeWidth={1.75} />
              Follow @iZIer01 on GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/joao-nkunku"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.97]"
            >
              <Linkedin className="h-3.5 w-3.5" strokeWidth={1.75} />
              Connect on LinkedIn
            </a>
            <a
              href="mailto:nkunkujoao01@gmail.com"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.97]"
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
              nkunkujoao01@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
