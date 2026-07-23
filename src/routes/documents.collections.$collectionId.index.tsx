import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  Upload,
  Loader2,
  Trash2,
  FolderPlus,
  Layers,
  ListChecks,
  MessageCircle,
  Pencil,
  X,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { formatMb, formatRelative } from "@/lib/mock-data";
import {
  usePersonalDocuments,
  useUploadDocument,
  useDocumentCollection,
  useDeleteCollection,
  useRenameCollection,
  useSetDocumentCollection,
} from "@/hooks/use-documents";
import { useFlashcardSet, useGenerateFlashcards, useQuiz, useGenerateQuiz } from "@/hooks/use-quiz";
import { useChatModelStatus } from "@/hooks/use-ai-chat";
import { useCloudAiKey, useCloudAiEnabled } from "@/hooks/use-cloud-ai";
import { useOnlineStatus } from "@/hooks/use-online-status";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/documents/collections/$collectionId/")({
  head: () => ({
    meta: [{ title: "Collection — eLearn" }],
  }),
  component: CollectionDetail,
});

function AddDocumentsDialog({ collectionId }: { collectionId: string }) {
  const docs = usePersonalDocuments();
  const { setDocumentCollection } = useSetDocumentCollection();
  const [open, setOpen] = useState(false);

  const available = docs.filter((doc) => doc.collectionId !== collectionId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.97]"
      >
        <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        Add existing document
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to this collection</DialogTitle>
          <DialogDescription>
            {available.length === 0
              ? "Every other document is already here."
              : "A document already in another collection will move here."}
          </DialogDescription>
        </DialogHeader>
        {available.length > 0 && (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {available.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => void setDocumentCollection(doc.id, collectionId)}
                  className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left ring-1 ring-border/60 transition-all hover:bg-secondary active:scale-[0.98]"
                >
                  <FileText className="h-4 w-4 shrink-0 text-prestige-mid" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 truncate text-sm text-prestige-deep">
                    {doc.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Deferred out of Feature 33's first pass — see useRenameCollection's own
 * comment for why this became worth building. Same Dialog+input pattern
 * as NewCollectionDialog on the documents index page, pre-filled with the
 * current name rather than starting blank. */
function RenameCollectionDialog({
  collectionId,
  currentName,
}: {
  collectionId: string;
  currentName: string;
}) {
  const { renameCollection } = useRenameCollection();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await renameCollection(collectionId, name);
    setSaving(false);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setName(currentName);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Rename collection"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-prestige-mid transition-all hover:bg-secondary hover:text-prestige-deep active:scale-90"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename collection</DialogTitle>
          <DialogDescription>Documents inside stay exactly where they are.</DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
          }}
          className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-prestige-gold"
        />
        <button
          type="button"
          disabled={!name.trim() || saving}
          onClick={() => void handleSave()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> : null}
          Save
        </button>
      </DialogContent>
    </Dialog>
  );
}

function CollectionDetail() {
  const { collectionId } = Route.useParams();
  const collection = useDocumentCollection(collectionId);
  const allDocs = usePersonalDocuments();
  const members = allDocs.filter((doc) => doc.collectionId === collectionId);
  const { upload, status, progress } = useUploadDocument();
  const { deleteCollection } = useDeleteCollection();
  const { setDocumentCollection } = useSetDocumentCollection();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Keyed by collectionId, not any one document's id — generateFlashcards/
  // useGenerateQuiz are already generic over an arbitrary string key (see
  // documents.$docId.tsx and the reader for the other two callers), so a
  // whole-collection deck/quiz just reuses the same tables and hooks
  // rather than needing new ones.
  const flashcardSet = useFlashcardSet(collectionId);
  const { generate: generateFlashcardsFor, pendingIds: flashcardPendingIds } =
    useGenerateFlashcards();
  const isGeneratingFlashcards = flashcardPendingIds.has(collectionId);

  const quiz = useQuiz(collectionId);
  const {
    generate: generateQuizFor,
    pendingIds: quizPendingIds,
    progress: quizProgress,
  } = useGenerateQuiz();
  const isGeneratingQuiz = quizPendingIds.has(collectionId);
  const quizQuestionProgress = quizProgress[collectionId];
  const chatModelStatus = useChatModelStatus();
  const chatModelReady = chatModelStatus === "ready";
  const { connected: cloudConnected } = useCloudAiKey();
  const [cloudEnabled] = useCloudAiEnabled();
  const isOnline = useOnlineStatus();
  // See courses.$moduleId.read.$docId.tsx's identical comment — a
  // connected, enabled cloud key with real internet can serve a quiz
  // without the on-device model ever being downloaded.
  const cloudQuizReady = cloudConnected === true && cloudEnabled && isOnline;
  const quizUnavailable = !chatModelReady && !cloudQuizReady;

  // Each member document already has its own `#`/`##` structure from
  // pdf-extract.ts; wrapping each one in its own top-level `# title`
  // heading too guarantees at least one flashcard per document even for
  // one with no internal headings of its own, and keeps every card
  // attributable to the document it came from.
  const flashcardSourceText = members.map((doc) => `# ${doc.title}\n\n${doc.text}`).join("\n\n");
  const quizSourceText = members.map((doc) => `${doc.title}: ${doc.text}`).join("\n\n");

  const handleDelete = async () => {
    await deleteCollection(collectionId);
    void navigate({ to: "/documents" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void upload(file, collectionId);
  };

  // Same "undefined while loading, only ever briefly" pattern as
  // documents.$docId.tsx — a liveQuery-backed hook starts undefined for a
  // real collection that just hasn't loaded yet.
  if (collection === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <MobileShell>
      <div className="flex items-center justify-between px-6 pt-10 lg:px-10 lg:pt-14">
        <Link
          to="/documents"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          My documents
        </Link>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:text-destructive active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Delete collection
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{collection.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                The collection itself will be removed, but its {members.length} document
                {members.length === 1 ? "" : "s"} will stay — just uncategorized, not deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void handleDelete()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete collection
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="px-6 pt-6 lg:px-10 lg:pb-16">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 truncate font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-deep lg:text-4xl">
            {collection.name}
          </h1>
          <RenameCollectionDialog collectionId={collectionId} currentName={collection.name} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {members.length} document{members.length === 1 ? "" : "s"}
        </p>
        <div className="mt-6 h-px w-full bg-prestige-deep/10" />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={status === "extracting"}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-60"
          >
            {status === "extracting" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            {status === "extracting"
              ? progress
                ? `Extracting ${progress.page}/${progress.totalPages}…`
                : "Reading…"
              : "Upload PDF here"}
          </button>
          <AddDocumentsDialog collectionId={collectionId} />
          {members.length > 0 && (
            <Link
              to="/documents/collections/$collectionId/chat"
              params={{ collectionId }}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-prestige-gold px-4 py-2.5 text-xs font-semibold text-prestige-deep transition-all active:scale-[0.97]"
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
              Ask this collection
            </Link>
          )}
        </div>

        {members.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isGeneratingFlashcards}
              onClick={() => {
                if (flashcardSet) {
                  void navigate({
                    to: "/documents/collections/$collectionId/flashcards",
                    params: { collectionId },
                  });
                  return;
                }
                void generateFlashcardsFor(collectionId, flashcardSourceText).then(() => {
                  void navigate({
                    to: "/documents/collections/$collectionId/flashcards",
                    params: { collectionId },
                  });
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.97] disabled:opacity-60"
            >
              {isGeneratingFlashcards ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Layers className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {flashcardSet ? "View flashcards" : "Flashcards for this collection"}
            </button>
            <button
              type="button"
              disabled={isGeneratingQuiz || quizUnavailable}
              title={
                quizUnavailable
                  ? "Connect a free cloud AI key (Settings) or download the on-device assistant from Ask AI"
                  : undefined
              }
              onClick={() => {
                if (quiz) {
                  void navigate({
                    to: "/documents/collections/$collectionId/quiz",
                    params: { collectionId },
                  });
                  return;
                }
                void generateQuizFor(collectionId, quizSourceText).then(() => {
                  void navigate({
                    to: "/documents/collections/$collectionId/quiz",
                    params: { collectionId },
                  });
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.97] disabled:opacity-60"
            >
              {isGeneratingQuiz ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <ListChecks className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {isGeneratingQuiz
                ? quizQuestionProgress
                  ? `Q${quizQuestionProgress.current}/${quizQuestionProgress.total}…`
                  : "Starting…"
                : quiz
                  ? "View quiz"
                  : "Quiz for this collection"}
            </button>
          </div>
        )}

        <div className="mt-8">
          {members.length === 0 ? (
            <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
              <FileText className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
              <p className="mt-4 font-display text-lg text-prestige-deep">No documents yet</p>
              <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
                Upload a new PDF straight into this collection, or add one you've already uploaded.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {members.map((doc, i) => (
                <li key={doc.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-border/60 transition-colors hover:ring-prestige-gold/40">
                    <Link to="/documents/$docId" params={{ docId: doc.id }} className="contents">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                        <FileText className="h-4 w-4" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-prestige-deep">
                          {doc.title}
                        </p>
                        <p className="text-[11px] uppercase tracking-widest text-prestige-mid/70">
                          {doc.pageCount} pages · {formatMb(doc.sizeMb)} ·{" "}
                          {formatRelative(new Date(doc.uploadedAt).toISOString())}
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Remove ${doc.title} from this collection`}
                      title="Remove from this collection (keeps the document)"
                      onClick={() => void setDocumentCollection(doc.id, undefined)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-all hover:text-destructive active:scale-90"
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </MobileShell>
  );
}
