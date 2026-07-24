import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Download,
  FileQuestion,
  FileText,
  GraduationCap,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { LibrarySearchButton } from "@/components/LibrarySearch";
import { formatMb } from "@/lib/mock-data";
import { fetchModules } from "@/lib/modules-api";
import { useDownloadedModuleIds } from "@/hooks/use-downloads";
import { useReadMaterialIds, moduleCompletion } from "@/hooks/use-activity";

export const Route = createFileRoute("/courses/")({
  loader: () => fetchModules(),
  head: () => ({
    meta: [
      { title: "Library — eLearn" },
      {
        name: "description",
        content:
          "Your full module library. Browse, download, and open every course you're enrolled in.",
      },
    ],
  }),
  component: Courses,
});

function Courses() {
  const modules = Route.useLoaderData();
  const featured = modules[0];
  const rest = modules.slice(1);
  const downloadedIds = useDownloadedModuleIds();
  const readMaterialIds = useReadMaterialIds();
  const featuredCompletion = moduleCompletion(featured.materials, featured.id, readMaterialIds);

  return (
    <MobileShell>
      <PageHeader
        eyebrow="Library"
        title="Your modules"
        action={<LibrarySearchButton modules={modules} />}
      />

      <div className="space-y-8 px-6 lg:px-10 lg:pb-16">
        {/* My documents + Summaries + Quiz/flashcard library */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/courses/moodle"
            className="animate-rise group flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-border/60 transition-colors hover:ring-prestige-gold/40"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-prestige-deep">My NUST courses</p>
              <p className="text-[11px] text-muted-foreground">
                Your real enrolled courses, materials, and grades from NUST eLearning
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-prestige-gold" strokeWidth={2} />
          </Link>

          <Link
            to="/documents"
            className="animate-rise group flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-border/60 transition-colors hover:ring-prestige-gold/40"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-prestige-deep">My documents</p>
              <p className="text-[11px] text-muted-foreground">
                Upload your own PDFs — extracted and summarised on this device
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-prestige-gold" strokeWidth={2} />
          </Link>

          {/* Moved here from its own bottom-nav slot — see MobileShell.tsx's
           * own comment on why. */}
          <Link
            to="/summaries"
            className="animate-rise group flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-border/60 transition-colors hover:ring-prestige-gold/40"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-prestige-deep">Summaries</p>
              <p className="text-[11px] text-muted-foreground">
                Every AI summary you've generated, kept alongside its source
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-prestige-gold" strokeWidth={2} />
          </Link>

          <Link
            to="/library"
            className="animate-rise group flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-border/60 transition-colors hover:ring-prestige-gold/40"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <FileQuestion className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-prestige-deep">Quizzes & flashcards</p>
              <p className="text-[11px] text-muted-foreground">
                Every quiz and flashcard set you've generated, in one place
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-prestige-gold" strokeWidth={2} />
          </Link>
        </div>

        {/* Featured hero */}
        <Link
          to="/courses/$moduleId"
          params={{ moduleId: featured.id }}
          className="group animate-rise block"
        >
          <div className="relative overflow-hidden rounded-2xl bg-prestige-deep p-8 text-prestige-cream transition-transform duration-300 group-hover:scale-[1.01] group-active:scale-[0.98] lg:flex lg:items-end lg:justify-between lg:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-prestige-gold/10 blur-3xl" />
            <div className="relative max-w-xl">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-gold">
                {featured.faculty} · {featured.code}
              </p>
              <h2 className="mt-2 font-display text-2xl font-medium leading-tight text-balance lg:text-4xl">
                {featured.title}
              </h2>
              <p className="mt-3 max-w-[42ch] text-sm text-prestige-cream/70">{featured.summary}</p>
            </div>
            <div className="relative mt-6 flex items-center gap-6 text-xs lg:mt-0">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-prestige-cream/50">
                  Chapter
                </p>
                <p className="font-display text-lg">{featured.chapter.split(" — ")[0]}</p>
              </div>
              <div className="h-8 w-px bg-prestige-cream/15" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-prestige-cream/50">
                  Materials opened
                </p>
                <p className="font-display text-lg">
                  {featuredCompletion.opened}/{featuredCompletion.total}
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* Grid */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((m) => {
            const isDownloaded = downloadedIds.has(m.id);
            const completion = moduleCompletion(m.materials, m.id, readMaterialIds);
            return (
              <Link
                key={m.id}
                to="/courses/$moduleId"
                params={{ moduleId: m.id }}
                className="animate-rise group relative flex flex-col justify-between rounded-2xl bg-card p-5 ring-1 ring-border/60 transition-all hover:-translate-y-0.5 hover:ring-prestige-gold/40"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-prestige-mid">
                      {m.faculty} · {m.code}
                    </p>
                    {isDownloaded ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-prestige-mid"
                        title="Available offline"
                      >
                        <CheckCircle2 className="h-3 w-3 text-prestige-gold" strokeWidth={2} />
                        Offline
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <Download className="h-3 w-3" strokeWidth={2} />
                        {formatMb(m.sizeMb)}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 font-display text-lg font-medium leading-tight text-prestige-deep text-balance">
                    {m.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{m.chapter}</p>
                </div>
                <div className="mt-6">
                  <div className="flex justify-between text-[10px] font-medium text-prestige-mid">
                    <span>
                      {completion.opened}/{completion.total} materials opened
                    </span>
                    <span>{Math.round(completion.pct * 100)}%</span>
                  </div>
                  <div className="mt-2 h-0.5 w-full bg-prestige-deep/10">
                    <div
                      className="h-full bg-prestige-gold"
                      style={{ width: `${completion.pct * 100}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </MobileShell>
  );
}
