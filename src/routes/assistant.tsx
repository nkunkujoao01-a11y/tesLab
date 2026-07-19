import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, TriangleAlert, Trash2, User } from "lucide-react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { ChatModelDownloadPrompt } from "@/components/ChatModelDownloadPrompt";
import {
  useChatModelStatus,
  useChatModelOfflineCapable,
  useAssistantMessages,
  useSendAssistantMessage,
  useClearAssistantConversation,
} from "@/hooks/use-ai-chat";
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

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "Ask AI — eLearn" },
      {
        name: "description",
        content: "A study assistant that runs entirely on your device — works offline.",
      },
    ],
  }),
  component: Assistant,
});

function Assistant() {
  const modelStatus = useChatModelStatus();
  const offlineCapable = useChatModelOfflineCapable();
  const messages = useAssistantMessages();
  const { sendMessage, sending, streamingText } = useSendAssistantMessage();
  const { clearConversation } = useClearAssistantConversation();
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

  return (
    <MobileShell>
      <PageHeader
        eyebrow="Ask AI"
        title="Your study assistant"
        action={
          messages.length > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Clear conversation"
                  className="grid h-10 w-10 place-items-center rounded-full border border-border/70 text-prestige-mid transition-all hover:text-destructive active:scale-90"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every message will be removed from this device. This can't be undone.
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
          ) : undefined
        }
      />

      {modelStatus !== "ready" ? (
        <ChatModelDownloadPrompt />
      ) : (
        <>
          <div className="space-y-4 px-6 pb-28 lg:px-10">
            {!offlineCapable && (
              <div className="animate-rise flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <p>
                  This device couldn't save the assistant for offline reuse — it works right now,
                  but may need to redownload after you leave this page while offline.
                </p>
              </div>
            )}
            {messages.length === 0 && !streamingText && (
              <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
                <Sparkles className="mx-auto h-6 w-6 text-prestige-gold" strokeWidth={1.5} />
                <p className="mt-3 text-sm text-muted-foreground">
                  Ask about your coursework, or anything else — this runs entirely on your device,
                  online or offline.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
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
                placeholder="Ask a question…"
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
