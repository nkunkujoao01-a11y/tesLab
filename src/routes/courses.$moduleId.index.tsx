import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  Download,
  CheckCircle2,
  Copy,
  ChevronRight,
  Trash2,
  Loader2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { QuizPanel } from "@/components/QuizFlashcards";
import { formatMb } from "@/lib/mock-data";
import { fetchModule, type Material } from "@/lib/modules-api";
import { cn } from "@/lib/utils";
import { materialKey } from "@/lib/db";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useDownloadedModuleIds,
  useDownloadedMaterialIds,
  useDownloadMaterial,
  useDeleteModule,
} from "@/hooks/use-downloads";
import { useLatestModuleSummary } from "@/hooks/use-summaries";
import {
  useReadMaterialIds,
  useMaterialReadProgress,
  moduleCompletion,
} from "@/hooks/use-activity";
import { useModuleEnrollment } from "@/hooks/use-enrollment";

export const Route = createFileRoute("/courses/$moduleId/")({
  loader: async ({ params }) => {
    const module = await fetchModule(params.moduleId);
    if (!module) throw notFound();
    return { module };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `${loaderData.module.title} — eLearn` : "Module — eLearn",
      },
      {
        name: "description",
        content: loaderData?.module.summary ?? "Module details, materials, and AI summary.",
      },
    ],
  }),
  component: ModuleDetail,
});

/** One material row — its own component (not inlined in the .map above)
 * so it can call useMaterialReadProgress per-material without breaking the
 * Rules of Hooks (a hook can't be called conditionally inside a loop body,
 * only inside a component that itself gets called once per item). */
function MaterialRow({
  mat,
  moduleId,
  isDownloaded,
  isPending,
  onDownload,
}: {
  mat: Material;
  moduleId: string;
  isDownloaded: boolean;
  isPending: boolean;
  onDownload: () => void;
}) {
  const readProgress = useMaterialReadProgress(moduleId, mat.id);
  const rowContent = (
    <>
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
        <FileText className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-prestige-deep">{mat.title}</p>
        <p className="text-[11px] uppercase tracking-widest text-prestige-deep/85">
          {mat.kind} · {mat.pages} pages · {formatMb(mat.sizeMb)}
        </p>
        {isDownloaded && readProgress > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="h-0.5 w-16 overflow-hidden rounded-full bg-prestige-deep/10">
              <div className="h-full bg-prestige-gold" style={{ width: `${readProgress}%` }} />
            </div>
            <span className="text-[10px] font-medium text-prestige-mid">{readProgress}% read</span>
          </div>
        )}
      </div>
    </>
  );
  const rowClassName = cn(
    "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl p-4 ring-1 transition-colors",
    isDownloaded
      ? "bg-card ring-border/60 hover:ring-prestige-gold/40"
      : "bg-card/40 ring-border/40",
  );

  if (isDownloaded) {
    // A single interactive row is fine here — the whole thing is one link
    // to the reader.
    return (
      <li>
        <Link
          to="/courses/$moduleId/read/$docId"
          params={{ moduleId, docId: mat.id }}
          className={cn(rowClassName, "group")}
        >
          {rowContent}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-prestige-deep/5 px-3 py-1.5 text-[11px] font-medium text-prestige-mid">
            <CheckCircle2 className="h-3.5 w-3.5 text-prestige-gold" strokeWidth={2} />
            Open
          </span>
        </Link>
      </li>
    );
  }

  // Not downloaded yet: nothing to read, so the row itself isn't a link —
  // only "Get" is interactive. (Previously this whole row *was* a <Link>
  // with the button nested inside it and a preventDefault/stopPropagation
  // hack to stop it from navigating — invalid HTML (button-in-anchor) that
  // hid the button from the accessibility tree. See DEV_LOG.md, Feature 18.)
  return (
    <li>
      <div className={rowClassName}>
        {rowContent}
        <button
          type="button"
          disabled={isPending}
          aria-label={`Download ${mat.title}`}
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-[11px] font-medium ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.95] disabled:opacity-60 disabled:active:scale-100"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          {isPending ? "Getting…" : "Get"}
        </button>
      </div>
    </li>
  );
}

function ModuleDetail() {
  const { module } = Route.useLoaderData();
  const downloadedModuleIds = useDownloadedModuleIds();
  const downloadedMaterialIds = useDownloadedMaterialIds();
  const { downloadMaterial, pendingIds } = useDownloadMaterial();
  const { deleteModule, pendingIds: deletingIds } = useDeleteModule();
  const isDeleting = deletingIds.has(module.id);
  // Only reflects real IndexedDB records — materials seeded as `downloaded: true`
  // in mock data were never actually downloaded through this app, so there's
  // nothing in storage for "Remove download" to free for those.
  const hasRealDownload =
    downloadedModuleIds.has(module.id) ||
    module.materials.some((mat) => downloadedMaterialIds.has(materialKey(module.id, mat.id)));

  const readMaterialIds = useReadMaterialIds();
  const completion = moduleCompletion(module.materials, module.id, readMaterialIds);

  const latestSummary = useLatestModuleSummary(module.id);
  const summarySourceMaterial = latestSummary
    ? module.materials.find((mat) => mat.id === latestSummary.materialId)
    : undefined;
  const [copied, setCopied] = useState(false);
  const copyToNotes = () => {
    if (!latestSummary) return;
    void navigator.clipboard.writeText(latestSummary.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const {
    enrolled,
    loading: enrollmentLoading,
    toggling,
    toggle: toggleEnrollment,
  } = useModuleEnrollment(module.id);

  return (
    <MobileShell>
      {/* Top bar with back */}
      <div className="flex items-center justify-between px-6 pt-10 lg:px-10 lg:pt-14">
        <Link
          to="/courses"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Library
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-prestige-deep/85">
          {module.faculty} · {module.code}
        </p>
      </div>

      <div className="grid gap-10 px-6 pt-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 lg:px-10 lg:pb-16">
        <div className="min-w-0 space-y-10">
          {/* Hero */}
          <header className="animate-rise">
            <h1 className="font-display text-3xl font-medium leading-[1.1] tracking-tight text-balance text-prestige-deep lg:text-4xl">
              {module.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{module.chapter}</span>
              <span className="h-1 w-1 rounded-full bg-prestige-gold" />
              <span>{module.lecturer}</span>
            </div>
            {!enrollmentLoading && (
              <button
                type="button"
                disabled={toggling}
                onClick={() => void toggleEnrollment()}
                className={cn(
                  "mt-4 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-50",
                  enrolled
                    ? "bg-prestige-deep/5 text-prestige-mid ring-1 ring-prestige-deep/20"
                    : "bg-prestige-deep text-prestige-cream",
                )}
              >
                {enrolled ? (
                  <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {toggling ? "Updating…" : enrolled ? "Enrolled" : "Enrol in this module"}
              </button>
            )}
            <div className="mt-6 h-px w-16 bg-prestige-gold" />
          </header>

          {/* Materials */}
          <section className="animate-rise">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-display text-sm font-semibold text-prestige-deep">
                Lecture materials
              </h2>
              {hasRealDownload && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={isDeleting}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      )}
                      {isDeleting ? "Removing…" : "Remove download"}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove this download?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {module.title} and all of its downloaded materials will be removed from this
                        device. You can download it again anytime — nothing is deleted from your
                        account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void deleteModule(module.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remove download
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <ul className="space-y-3">
              {module.materials.map((mat: Material) => (
                <MaterialRow
                  key={mat.id}
                  mat={mat}
                  moduleId={module.id}
                  isDownloaded={downloadedMaterialIds.has(materialKey(module.id, mat.id))}
                  isPending={pendingIds.has(materialKey(module.id, mat.id))}
                  onDownload={() =>
                    void downloadMaterial(mat.id, module.id, mat.sizeMb, mat.content, mat.kind)
                  }
                />
              ))}
            </ul>
          </section>

          {/* AI summary */}
          <section className="animate-rise">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-1 rounded-2xl border-t border-l border-prestige-gold/40" />
              <article className="relative rounded-2xl bg-prestige-deep p-6 text-prestige-cream lg:p-8">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-gold">
                    AI summary
                  </p>
                  {latestSummary && (
                    <p className="text-[10px] uppercase tracking-widest text-prestige-cream/50">
                      On-device
                    </p>
                  )}
                </div>
                {latestSummary ? (
                  <>
                    <p className="mt-5 font-display text-lg leading-relaxed text-prestige-cream/90 lg:text-xl">
                      {latestSummary.body}
                    </p>
                    {summarySourceMaterial && (
                      <p className="mt-3 text-[11px] uppercase tracking-widest text-prestige-cream/40">
                        From {summarySourceMaterial.title}
                      </p>
                    )}
                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      <Link
                        to="/courses/$moduleId/read/$docId"
                        params={{ moduleId: module.id, docId: latestSummary.materialId }}
                        className="inline-flex items-center gap-2 rounded-lg bg-prestige-cream/10 px-3 py-2 text-xs font-medium text-prestige-cream transition-colors hover:bg-prestige-cream/20"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Open in reader
                      </Link>
                      {latestSummary.sections && latestSummary.sections.length > 0 && (
                        <Link
                          to="/courses/$moduleId/summary/$docId"
                          params={{ moduleId: module.id, docId: latestSummary.materialId }}
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-prestige-cream ring-1 ring-prestige-cream/25 transition-colors hover:bg-prestige-cream/10"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                          View full summary
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={copyToNotes}
                        className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-3 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
                      >
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                        {copied ? "Copied" : "Copy to notes"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-5 text-sm leading-relaxed text-prestige-cream/70">
                      {module.materials.length > 0
                        ? "No AI summary yet. Open a material and generate one — it'll show up here."
                        : "No materials yet — a summary will show up here once one's added and opened."}
                    </p>
                    {module.materials.length > 0 && (
                      <div className="mt-6">
                        <Link
                          to="/courses/$moduleId/read/$docId"
                          params={{ moduleId: module.id, docId: module.materials[0].id }}
                          className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-3 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Open a material
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </article>
            </div>
          </section>

          {/* Module quiz — admin-authored, shared across every student in
              this module (see Feature 57); distinct from a student's own
              on-device generated quiz for a single material. Only renders
              when a lecturer has actually added questions. Same bare
              QuizPanel usage as documents.$docId.index.tsx — it renders
              its own "Quiz" label, no extra heading needed here. */}
          {module.quizQuestions.length > 0 && (
            <section className="animate-rise">
              <QuizPanel questions={module.quizQuestions} />
            </section>
          )}

          {/* Progress footer */}
          <section className="animate-rise">
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow">Materials opened</p>
                <p className="mt-1 font-display text-2xl text-prestige-deep">
                  {completion.opened}
                  <span className="text-muted-foreground">/{completion.total}</span>
                </p>
              </div>
              <p className="font-display text-2xl text-prestige-deep">
                {Math.round(completion.pct * 100)}%
              </p>
            </div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-prestige-deep/10">
              <div
                className="h-full bg-prestige-gold"
                style={{ width: `${completion.pct * 100}%` }}
              />
            </div>
          </section>
        </div>

        {/* Side info */}
        <aside className="hidden space-y-4 lg:sticky lg:top-10 lg:block lg:h-fit">
          {module.materials.length > 0 && (
            <div className="rounded-2xl bg-card p-6 ring-1 ring-border/60">
              <p className="eyebrow">Next lesson</p>
              <p className="mt-2 font-display text-lg text-prestige-deep">
                {module.chapter.split(" — ")[1] ?? "Coming up"}
              </p>
              <Link
                to="/courses/$moduleId/read/$docId"
                params={{ moduleId: module.id, docId: module.materials[0].id }}
                className="mt-4 inline-flex w-full items-center justify-between rounded-lg bg-prestige-deep px-4 py-3 text-sm font-medium text-prestige-cream"
              >
                <span>Resume reading</span>
                <ChevronRight className="h-4 w-4 text-prestige-gold" strokeWidth={2} />
              </Link>
            </div>
          )}
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border/60">
            <p className="eyebrow">Module size</p>
            <p className="mt-2 font-display text-lg text-prestige-deep">
              {formatMb(module.sizeMb)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Downloads once. Reads anywhere.</p>
          </div>
        </aside>
      </div>
    </MobileShell>
  );
}
