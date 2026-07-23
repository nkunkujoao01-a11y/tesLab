import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  ListChecks,
  Loader2,
  RefreshCw,
  Share2,
} from "lucide-react";
import { useDocumentCollection, usePersonalDocuments } from "@/hooks/use-documents";
import { useQuiz, useQuizAttempts, useRecordQuizAttempt, useGenerateQuiz } from "@/hooks/use-quiz";
import { useChatModelStatus } from "@/hooks/use-ai-chat";
import { useCloudAiKey, useCloudAiEnabled } from "@/hooks/use-cloud-ai";
import { useOnlineStatus, useCanShareFiles } from "@/hooks/use-online-status";
import { buildQuizExportText } from "@/lib/quiz-gen";
import { buildStructuredExportHtml, shareOrDownloadBlob } from "@/lib/structured-export";
import { QuizPanel } from "@/components/QuizFlashcards";

export const Route = createFileRoute("/documents/collections/$collectionId/quiz")({
  head: () => ({
    meta: [
      { title: "Quiz — eLearn" },
      { name: "description", content: "An AI-generated quiz for this collection." },
    ],
  }),
  component: CollectionQuizPage,
});

/** A dedicated, standalone view for a whole collection's quiz — same
 * reasoning and layout as documents.$docId.quiz.tsx, keyed by
 * collectionId instead of a single document's id (see
 * documents.collections.$collectionId.index.tsx's own comment on why
 * flashcards/quiz are generic over an arbitrary string key). */
function CollectionQuizPage() {
  const { collectionId } = Route.useParams();
  const collection = useDocumentCollection(collectionId);
  const quiz = useQuiz(collectionId);
  const attempts = useQuizAttempts(collectionId);
  const recordAttempt = useRecordQuizAttempt();
  const allDocs = usePersonalDocuments();
  const members = allDocs.filter((doc) => doc.collectionId === collectionId);
  // Same construction as documents.collections.$collectionId.index.tsx's
  // own quizSourceText.
  const quizSourceText = members.map((doc) => `${doc.title}: ${doc.text}`).join("\n\n");
  const { generate: generateQuizFor, pendingIds, progress: quizProgress } = useGenerateQuiz();
  const isGenerating = pendingIds.has(collectionId);
  const questionProgress = quizProgress[collectionId];
  const chatModelReady = useChatModelStatus() === "ready";
  const { connected: cloudConnected } = useCloudAiKey();
  const [cloudEnabled] = useCloudAiEnabled();
  const isOnline = useOnlineStatus();
  const cloudQuizReady = cloudConnected === true && cloudEnabled && isOnline;
  const quizUnavailable = !chatModelReady && !cloudQuizReady;
  const canShare = useCanShareFiles();

  if (collection === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  const title = collection?.name ?? "Collection";

  const download = () => {
    if (!quiz) return;
    const html = buildStructuredExportHtml(`${title} — Quiz`, buildQuizExportText(quiz.questions));
    void shareOrDownloadBlob(
      new Blob([html], { type: "text/html" }),
      `${title} — Quiz.html`,
      `${title} — Quiz`,
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[680px] items-center justify-between px-6 py-4">
          <Link
            to="/documents/collections/$collectionId"
            params={{ collectionId }}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {title}
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
              Go back to the collection and tap "Quiz for this collection" — it'll show up here.
            </p>
            <Link
              to="/documents/collections/$collectionId"
              params={{ collectionId }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              Open collection
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
              {title}
            </h1>

            <QuizPanel
              questions={quiz.questions}
              attempts={attempts}
              onSubmit={(score, total, answers) =>
                void recordAttempt(collectionId, score, total, answers)
              }
            />

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/60 pt-6">
              <button
                type="button"
                onClick={download}
                className="inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2.5 text-xs font-semibold text-prestige-deep transition-transform active:scale-[0.97]"
              >
                {canShare ? (
                  <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Download className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                {canShare ? "Share" : "Download"}
              </button>
              <button
                type="button"
                disabled={isGenerating || quizUnavailable}
                title={
                  quizUnavailable
                    ? "Connect a free cloud AI key (Settings) or download the on-device assistant from Ask AI"
                    : undefined
                }
                onClick={() => void generateQuizFor(collectionId, quizSourceText)}
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
                to="/documents/collections/$collectionId"
                params={{ collectionId }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all active:scale-[0.97]"
              >
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                Back to collection
              </Link>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
