import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Download, ListChecks, Loader2, RefreshCw } from "lucide-react";
import { fetchModule } from "@/lib/modules-api";
import { materialKey } from "@/lib/db";
import { useDownloadedMaterialContent } from "@/hooks/use-downloads";
import { useQuiz, useQuizAttempts, useRecordQuizAttempt, useGenerateQuiz } from "@/hooks/use-quiz";
import { useChatModelStatus } from "@/hooks/use-ai-chat";
import { useCloudAiKey, useCloudAiEnabled } from "@/hooks/use-cloud-ai";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { buildQuizExportText } from "@/lib/quiz-gen";
import { buildStructuredExportHtml, downloadBlob } from "@/lib/structured-export";
import { QuizPanel } from "@/components/QuizFlashcards";

export const Route = createFileRoute("/courses/$moduleId/quiz/$docId")({
  loader: async ({ params }) => {
    const module = await fetchModule(params.moduleId);
    if (!module) throw notFound();
    const doc = module.materials.find((m) => m.id === params.docId);
    if (!doc) throw notFound();
    return { module, doc };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.doc.title} — Quiz` : "Quiz — eLearn" },
      { name: "description", content: "An AI-generated quiz for this material." },
    ],
  }),
  component: MaterialQuizPage,
});

/** A dedicated, standalone view for one material's quiz — its own page
 * rather than a tab dropped into the reader (see the reader route's own
 * comment on why quiz/flashcards moved off the shared tab strip),
 * reachable from the reader's "Quiz" action and reusing the exact same
 * QuizPanel (with real attempt history) the tab used to render. */
function MaterialQuizPage() {
  const { module, doc } = Route.useLoaderData();
  const key = materialKey(module.id, doc.id);
  const quiz = useQuiz(key);
  const attempts = useQuizAttempts(key);
  const recordAttempt = useRecordQuizAttempt();
  const content = useDownloadedMaterialContent(module.id, doc.id);
  const pageSourceText = content ? [content.lead, ...content.body].join(" ") : "";
  const { generate: generateQuizFor, pendingIds, progress: quizProgress } = useGenerateQuiz();
  const isGenerating = pendingIds.has(key);
  const questionProgress = quizProgress[key];
  const chatModelReady = useChatModelStatus() === "ready";
  const { connected: cloudConnected } = useCloudAiKey();
  const [cloudEnabled] = useCloudAiEnabled();
  const isOnline = useOnlineStatus();
  const cloudQuizReady = cloudConnected === true && cloudEnabled && isOnline;
  const quizUnavailable = !chatModelReady && !cloudQuizReady;

  const download = () => {
    if (!quiz) return;
    const html = buildStructuredExportHtml(
      `${doc.title} — Quiz`,
      buildQuizExportText(quiz.questions),
    );
    downloadBlob(new Blob([html], { type: "text/html" }), `${doc.title} — Quiz.html`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[680px] items-center justify-between px-6 py-4">
          <Link
            to="/courses/$moduleId/read/$docId"
            params={{ moduleId: module.id, docId: doc.id }}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {doc.title}
          </Link>
          {quiz && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-prestige-gold">
              <ListChecks className="h-3 w-3" strokeWidth={2} />
              {quiz.method === "cloud" ? "Cloud AI" : "On-device"}
            </span>
          )}
        </div>
      </header>

      <article className="mx-auto max-w-[680px] px-6 pb-32 pt-10 lg:pt-14">
        {!quiz || quiz.questions.length === 0 ? (
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <ListChecks className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">No quiz yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Go back to the reader and tap "Quiz" — it'll show up here.
            </p>
            <Link
              to="/courses/$moduleId/read/$docId"
              params={{ moduleId: module.id, docId: doc.id }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              Open reader
            </Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">
              {module.code} · {module.chapter}
            </p>
            <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
              {doc.title}
            </h1>

            <QuizPanel
              questions={quiz.questions}
              attempts={attempts}
              onSubmit={(score, total, answers) => void recordAttempt(key, score, total, answers)}
            />

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/60 pt-6">
              <button
                type="button"
                onClick={download}
                className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2.5 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                Download
              </button>
              <button
                type="button"
                disabled={isGenerating || !content || quizUnavailable}
                title={
                  quizUnavailable
                    ? "Connect a free cloud AI key (Settings) or download the on-device assistant from Ask AI"
                    : undefined
                }
                onClick={() => void generateQuizFor(key, pageSourceText)}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97] disabled:opacity-60"
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {isGenerating
                  ? questionProgress
                    ? `Q${questionProgress.current}/${questionProgress.total}…`
                    : "Starting…"
                  : "New quiz"}
              </button>
              <Link
                to="/courses/$moduleId/read/$docId"
                params={{ moduleId: module.id, docId: doc.id }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97]"
              >
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                Back to reader
              </Link>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
