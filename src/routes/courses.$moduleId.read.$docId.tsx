import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Sparkles,
  CloudDownload,
  Copy,
  Download,
  Layers,
  ListChecks,
  LogIn,
  Loader2,
  Share2,
} from "lucide-react";
import { formatMb } from "@/lib/mock-data";
import { fetchModule } from "@/lib/modules-api";
import { materialKey } from "@/lib/db";
import {
  useDownloadedMaterialIds,
  useDownloadMaterial,
  useDownloadedMaterialContent,
} from "@/hooks/use-downloads";
import { useMaterialSummary, useGenerateSummary } from "@/hooks/use-summaries";
import { buildSummaryExportText } from "@/lib/summarize-structured";
import {
  markMaterialRead,
  updateMaterialReadProgress,
  useMaterialReadProgress,
} from "@/hooks/use-activity";
import { useReadingProgress } from "@/hooks/use-reading-progress";
import { useAuth } from "@/hooks/use-auth";
import { useFlashcardSet, useGenerateFlashcards, useQuiz, useGenerateQuiz } from "@/hooks/use-quiz";
import { useChatModelStatus } from "@/hooks/use-ai-chat";
import { useCloudAiKey, useCloudAiEnabled } from "@/hooks/use-cloud-ai";
import { useOnlineStatus, useCanShareFiles } from "@/hooks/use-online-status";
import { ReadingWidthControl } from "@/components/ReadingWidthControl";
import { useReadingWidth, READING_WIDTH_STYLE } from "@/hooks/use-reading-width";
import { buildStructuredExportHtml, shareOrDownloadBlob } from "@/lib/structured-export";

export const Route = createFileRoute("/courses/$moduleId/read/$docId")({
  loader: async ({ params }) => {
    const module = await fetchModule(params.moduleId);
    if (!module) throw notFound();
    const doc = module.materials.find((m) => m.id === params.docId);
    if (!doc) throw notFound();
    return { module, doc };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `${loaderData.doc.title} — eLearn Reader` : "Reader — eLearn",
      },
      {
        name: "description",
        content: "A distraction-free reader for your downloaded material.",
      },
    ],
  }),
  component: Reader,
});

function Reader() {
  const { module, doc } = Route.useLoaderData();
  const { user, loading: authLoading } = useAuth();

  const key = materialKey(module.id, doc.id);
  const downloadedMaterialIds = useDownloadedMaterialIds();
  const { downloadMaterial, pendingIds } = useDownloadMaterial();
  const isDownloaded = downloadedMaterialIds.has(key);
  const isPending = pendingIds.has(key);

  useEffect(() => {
    if (isDownloaded && user) void markMaterialRead(user.id, doc.id, module.id);
  }, [doc.id, module.id, isDownloaded, user]);

  // Read from the offline cache (not a fresh Supabase fetch) — the reader
  // must work fully offline once a material has been downloaded.
  const content = useDownloadedMaterialContent(module.id, doc.id);

  // Real scroll-based reading progress — replaces the old "Page N of M"
  // counter, which was a plain number a button incremented with no actual
  // pagination of the content behind it (see DEV_LOG.md).
  const storedProgress = useMaterialReadProgress(module.id, doc.id);
  const persistProgress = useCallback(
    (pct: number) => {
      if (user) void updateMaterialReadProgress(user.id, doc.id, module.id, pct);
    },
    [user, doc.id, module.id],
  );
  const readProgress = useReadingProgress(!!content, storedProgress, persistProgress);
  const [readingWidth, setReadingWidth] = useReadingWidth();

  const summary = useMaterialSummary(module.id, doc.id);
  const { generateSummary, pendingIds: summarizingIds } = useGenerateSummary();
  const isSummarizing = summarizingIds.has(key);
  const pageSourceText = content ? [content.lead, ...content.body].join(" ") : "";
  // A catalog material's content is heading/lead/body/pull — not the
  // pdf-extract.ts `#`/`##` markdown personal documents get — so
  // generateFlashcards() (which looks for that structure) needs a small
  // synthetic document built from it first: one heading, one card. Less
  // granular than a personal document with real chapter headings, but an
  // honest reflection of what this content actually contains, not a
  // guess at structure that isn't there.
  const flashcardSourceText = content
    ? `# ${content.heading}\n\n${content.lead}\n\n${content.body.join("\n\n")}`
    : "";

  // Same key used by downloads/summaries (materialKey) — reusing the
  // bare material id here would reopen the exact cross-module collision
  // bug Feature 9 found and fixed (material ids like "m1" repeat across
  // different modules).
  const flashcardSet = useFlashcardSet(key);
  const { generate: generateFlashcardsFor, pendingIds: flashcardPendingIds } =
    useGenerateFlashcards();
  const isGeneratingFlashcards = flashcardPendingIds.has(key);

  const quiz = useQuiz(key);
  const {
    generate: generateQuizFor,
    pendingIds: quizPendingIds,
    progress: quizProgress,
  } = useGenerateQuiz();
  const isGeneratingQuiz = quizPendingIds.has(key);
  const quizQuestionProgress = quizProgress[key];
  const chatModelStatus = useChatModelStatus();
  const chatModelReady = chatModelStatus === "ready";
  const { connected: cloudConnected } = useCloudAiKey();
  const [cloudEnabled] = useCloudAiEnabled();
  const isOnline = useOnlineStatus();
  // A quiz needs *some* AI path — either the downloaded on-device model, or
  // the online AI (connected key, turned on in settings, actual internet).
  // Previously this button only ever checked chatModelReady, so a student
  // who'd connected a free cloud key but never downloaded the on-device
  // model saw a permanently disabled Quiz button despite cloud generation
  // already working end-to-end.
  const cloudQuizReady = cloudConnected === true && cloudEnabled && isOnline;
  const quizUnavailable = !chatModelReady && !cloudQuizReady;
  const canShare = useCanShareFiles();

  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const copyToNotes = () => {
    if (!summary) return;
    void navigator.clipboard.writeText(summary.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const downloadSummary = () => {
    if (!summary) return;
    const text = summary.sections
      ? buildSummaryExportText(summary.body, summary.sections)
      : summary.body;
    const html = buildStructuredExportHtml(`${doc.title} — Summary`, text);
    void shareOrDownloadBlob(
      new Blob([html], { type: "text/html" }),
      `${doc.title} — Summary.html`,
      `${doc.title} — Summary`,
    );
  };
  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-prestige-deep/5 text-prestige-mid">
          <LogIn className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 font-display text-xl font-medium text-prestige-deep">
          Sign in to continue
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
          Sign in to read your downloaded materials.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-5 py-2.5 text-sm font-medium text-prestige-cream transition-transform active:scale-[0.97]"
        >
          <LogIn className="h-4 w-4" strokeWidth={1.75} />
          Sign in
        </Link>
      </div>
    );
  }

  if (!isDownloaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-prestige-deep/5 text-prestige-mid">
          <CloudDownload className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 font-display text-xl font-medium text-prestige-deep">
          Not downloaded yet
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
          {doc.title} isn't available offline. Download it to start reading.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            void downloadMaterial(doc.id, module.id, doc.sizeMb, doc.content, doc.kind)
          }
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-5 py-2.5 text-sm font-medium text-prestige-cream transition-transform active:scale-[0.97] disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <CloudDownload className="h-4 w-4" strokeWidth={1.75} />
          )}
          {isPending ? "Getting…" : `Get · ${formatMb(doc.sizeMb)}`}
        </button>
        <Link
          to="/courses/$moduleId"
          params={{ moduleId: module.id }}
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Back to {module.code}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-4">
          <Link
            to="/courses/$moduleId"
            params={{ moduleId: module.id }}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {module.code}
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-deep/85">
              {readProgress}% read
            </p>
            <ReadingWidthControl width={readingWidth} onChange={setReadingWidth} />
          </div>
        </div>
        <div className="h-0.5 w-full bg-prestige-deep/5">
          <div
            className="h-full bg-prestige-gold transition-all"
            style={{ width: `${readProgress}%` }}
          />
        </div>
      </header>

      {/* Article body */}
      <article
        className="mx-auto px-6 pb-40 pt-12 lg:pt-16"
        style={{ maxWidth: READING_WIDTH_STYLE[readingWidth] }}
      >
        {content ? (
          <>
            <p className="eyebrow">
              {doc.kind} · {module.chapter}
            </p>
            <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
              {content.heading}
            </h1>
            <p className="mt-6 font-display text-lg italic leading-relaxed text-prestige-mid lg:text-xl">
              {content.lead}
            </p>
            <div className="mt-8 h-px w-full bg-prestige-deep/10" />
            <div className="mt-8 space-y-5 text-[15px] leading-[1.75] text-foreground/85">
              {content.body.slice(0, 2).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <figure className="my-8 border-l-2 border-prestige-gold pl-6">
                <p className="font-display text-xl leading-snug text-prestige-deep text-balance">
                  {content.pull}
                </p>
                <figcaption className="mt-3 text-[11px] uppercase tracking-widest text-prestige-mid">
                  — {module.lecturer}
                </figcaption>
              </figure>
              {content.body.slice(2).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading downloaded content…</p>
        )}

        {(summary || isSummarizing) && (
          <div className="relative mt-6">
            <div className="pointer-events-none absolute -inset-1 rounded-2xl border-t border-l border-prestige-gold/40" />
            <div className="relative rounded-2xl bg-prestige-deep p-6 text-prestige-cream">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-gold">
                  AI summary
                </p>
                <p className="text-[10px] uppercase tracking-widest text-prestige-cream/50">
                  On-device
                  {summary?.method === "neural"
                    ? " · Neural model"
                    : summary?.method === "extractive"
                      ? " · Extractive"
                      : ""}
                </p>
              </div>
              {isSummarizing ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-prestige-cream/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                  Summarising this page…
                </p>
              ) : (
                <>
                  <p className="mt-4 text-[15px] leading-relaxed text-prestige-cream/90">
                    {summary?.body}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={copyToNotes}
                      className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-3 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                      {copied ? "Copied" : "Copy to notes"}
                    </button>
                    <button
                      type="button"
                      onClick={downloadSummary}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-prestige-cream ring-1 ring-prestige-cream/25 transition-colors hover:bg-prestige-cream/10"
                    >
                      {canShare ? (
                        <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      ) : (
                        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                      )}
                      {canShare ? "Share" : "Download"}
                    </button>
                    {summary?.sections && summary.sections.length > 0 && (
                      <Link
                        to="/courses/$moduleId/summary/$docId"
                        params={{ moduleId: module.id, docId: doc.id }}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-prestige-cream ring-1 ring-prestige-cream/25 transition-colors hover:bg-prestige-cream/10"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                        View full summary
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {isGeneratingQuiz && (
          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Writing a quiz question by question can take a few minutes on this device — this is
            genuinely working, not stuck.
          </p>
        )}
      </article>

      {/* Floating actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[720px] items-center justify-end gap-2 px-5 py-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Link
              to="/courses/$moduleId/chat/$docId"
              params={{ moduleId: module.id, docId: doc.id }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97]"
            >
              <Bot className="h-3.5 w-3.5" strokeWidth={2} />
              Ask AI
            </Link>
            <button
              type="button"
              disabled={isGeneratingFlashcards || !content}
              onClick={() => {
                if (flashcardSet) {
                  void navigate({
                    to: "/courses/$moduleId/flashcards/$docId",
                    params: { moduleId: module.id, docId: doc.id },
                  });
                  return;
                }
                void generateFlashcardsFor(key, flashcardSourceText).then(() => {
                  void navigate({
                    to: "/courses/$moduleId/flashcards/$docId",
                    params: { moduleId: module.id, docId: doc.id },
                  });
                });
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97] disabled:opacity-60"
            >
              {isGeneratingFlashcards ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Layers className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {flashcardSet ? "View cards" : "Cards"}
            </button>
            <button
              type="button"
              disabled={isGeneratingQuiz || !content || quizUnavailable}
              title={
                quizUnavailable
                  ? "Connect a free cloud AI key (Settings) or download the on-device assistant from Ask AI"
                  : undefined
              }
              onClick={() => {
                if (quiz) {
                  void navigate({
                    to: "/courses/$moduleId/quiz/$docId",
                    params: { moduleId: module.id, docId: doc.id },
                  });
                  return;
                }
                void generateQuizFor(key, pageSourceText).then(() => {
                  void navigate({
                    to: "/courses/$moduleId/quiz/$docId",
                    params: { moduleId: module.id, docId: doc.id },
                  });
                });
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97] disabled:opacity-60"
            >
              {isGeneratingQuiz ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <ListChecks className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {isGeneratingQuiz
                ? quizQuestionProgress
                  ? `Q${quizQuestionProgress.current}/${quizQuestionProgress.total}…`
                  : "Starting…"
                : quiz
                  ? "View quiz"
                  : "Quiz"}
            </button>
            <button
              type="button"
              disabled={isSummarizing || !content}
              onClick={() => {
                void generateSummary(
                  doc.id,
                  module.id,
                  pageSourceText,
                  content?.heading ?? doc.title,
                );
              }}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-prestige-gold px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-prestige-deep transition-transform active:scale-[0.97] disabled:opacity-60"
            >
              {isSummarizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {isSummarizing ? "Summarising…" : summary ? "Regenerate" : "Summarise"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
