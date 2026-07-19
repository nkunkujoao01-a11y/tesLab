import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, FileText, Loader2, Send, Sparkles, Trash2, User } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { ChatModelDownloadPrompt } from "@/components/ChatModelDownloadPrompt";
import { useDocumentCollection, usePersonalDocuments } from "@/hooks/use-documents";
import { useChatModelStatus } from "@/hooks/use-ai-chat";
import {
  useCollectionMessages,
  useSendCollectionMessage,
  useClearCollectionConversation,
} from "@/hooks/use-collection-chat";
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

export const Route = createFileRoute("/documents/collections/$collectionId/chat")({
  head: () => ({
    meta: [
      { title: "Ask this collection — eLearn" },
      {
        name: "description",
        content: "Ask questions grounded in every document in this collection.",
      },
    ],
  }),
  component: CollectionChat,
});

function CollectionChat() {
  const { collectionId } = Route.useParams();
  const collection = useDocumentCollection(collectionId);
  const allDocs = usePersonalDocuments();
  const members = allDocs.filter((doc) => doc.collectionId === collectionId);
  const modelStatus = useChatModelStatus();
  const messages = useCollectionMessages(collectionId);
  const { sendMessage, sending, streamingText } = useSendCollectionMessage(collectionId, members);
  const { clearConversation } = useClearCollectionConversation(collectionId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText]);

  const handleSend = () => {
    if (!draft.trim() || sending) return;
    void sendMessage(draft);
    setDraft("");
  };

  // Same "briefly blank while a liveQuery-backed hook settles" pattern as
  // documents.collections.$collectionId.tsx.
  if (collection === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <MobileShell>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-6 pt-10 pb-6 lg:px-10 lg:pt-14">
        <div className="min-w-0">
          <Link
            to="/documents/collections/$collectionId"
            params={{ collectionId }}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {collection.name}
          </Link>
          <h1 className="mt-3 font-display text-2xl font-medium tracking-tight text-balance text-prestige-deep lg:text-3xl">
            Ask this collection
          </h1>
        </div>
        {messages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                aria-label="Clear conversation"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/70 text-prestige-mid transition-all hover:text-destructive active:scale-90"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every message in this collection's thread will be removed from this device. This
                  can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void clearConversation()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {members.length === 0 ? (
        <div className="px-6 lg:px-10">
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <FileText className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">No documents yet</p>
            <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
              Add at least one document to this collection before asking it questions — there's
              nothing to ground answers in yet.
            </p>
            <Link
              to="/documents/collections/$collectionId"
              params={{ collectionId }}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97]"
            >
              Back to collection
            </Link>
          </div>
        </div>
      ) : modelStatus !== "ready" ? (
        <ChatModelDownloadPrompt />
      ) : (
        <>
          <div className="space-y-4 px-6 pb-28 lg:px-10">
            {messages.length === 0 && !streamingText && (
              <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
                <Sparkles className="mx-auto h-6 w-6 text-prestige-gold" strokeWidth={1.5} />
                <p className="mt-3 text-sm text-muted-foreground">
                  Ask about {members.length === 1 ? "this document" : "these documents"} — answers
                  are grounded in {members.length === 1 ? "its" : "their"} actual text, running
                  entirely on your device.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.key}
                className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    msg.role === "user"
                      ? "bg-prestige-deep text-prestige-cream"
                      : "bg-prestige-deep/5 text-prestige-mid"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-3.5 w-3.5" strokeWidth={1.75} />
                  ) : (
                    <Bot className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-prestige-deep text-prestige-cream"
                      : "bg-card text-foreground/90 ring-1 ring-border/60"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                  <Bot className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
                <div className="max-w-[80%] rounded-2xl bg-card px-4 py-2.5 text-sm leading-relaxed text-foreground/90 ring-1 ring-border/60">
                  {streamingText || (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                      Thinking…
                    </span>
                  )}
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="fixed inset-x-0 bottom-20 z-20 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md lg:bottom-0 lg:ml-64">
            <div className="mx-auto flex max-w-[680px] items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder="Ask about this collection…"
                disabled={sending}
                className="flex-1 rounded-full border border-border/70 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-prestige-gold disabled:opacity-60"
              />
              <button
                type="button"
                disabled={!draft.trim() || sending}
                onClick={handleSend}
                aria-label="Send"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-prestige-deep text-prestige-cream transition-all active:scale-[0.95] disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Send className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </MobileShell>
  );
}
