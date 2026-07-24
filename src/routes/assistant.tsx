import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, Loader2, Send, Sparkles, TriangleAlert, Trash2, User } from "lucide-react";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { ChatModelDownloadPrompt } from "@/components/ChatModelDownloadPrompt";
import {
  useChatModelStatus,
  useChatModelOfflineCapable,
  useAssistantMessages,
  useSendAssistantMessage,
  useClearAssistantConversation,
  useThinkingLabel,
  useStaleAiOperationWarning,
} from "@/hooks/use-ai-chat";
import { useCloudAiKey, useCloudAiEnabled } from "@/hooks/use-cloud-ai";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
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
        content:
          "A study assistant that answers via your connected cloud AI, or on-device offline.",
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
  const thinkingLabel = useThinkingLabel(sending);
  const staleAiOperation = useStaleAiOperationWarning();
  const [draft, setDraft] = useState("");

  // A connected, enabled cloud key with real internet can serve every chat
  // turn without the on-device model ever being downloaded — see
  // courses.$moduleId.read.$docId.tsx's identical comment for why quiz
  // generation used to wrongly gate on chatModelReady alone; this page had
  // the same gap, but worse: it blocked the whole chat UI behind a forced
  // download prompt instead of just one disabled button.
  const { connected: cloudConnected } = useCloudAiKey();
  const [cloudEnabled] = useCloudAiEnabled();
  const isOnline = useOnlineStatus();
  const cloudChatReady = cloudConnected === true && cloudEnabled && isOnline;
  const chatReady = modelStatus === "ready" || cloudChatReady;

  const { sentinelRef, jumpToBottom } = useStickToBottom([messages, streamingText]);

  const handleSend = () => {
    if (!draft.trim() || sending) return;
    jumpToBottom();
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

      {!chatReady ? (
        <ChatModelDownloadPrompt />
      ) : (
        <>
          <div className="space-y-4 px-6 pb-28 lg:px-10">
            {staleAiOperation && (
              <div className="animate-rise flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <p>
                  The AI didn't finish {staleAiOperation.op === "load" ? "loading" : "generating"}{" "}
                  {staleAiOperation.modelLabel} last time — this can happen if the app closed or
                  crashed. If that keeps happening, try a smaller model in Profile &gt; AI Settings,
                  or connect a free cloud AI key so answers don't rely on this device at all.
                </p>
              </div>
            )}
            {cloudChatReady && modelStatus !== "ready" && (
              <div className="animate-rise flex items-start gap-2.5 rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                <Sparkles
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-prestige-gold"
                  strokeWidth={1.75}
                />
                <p>
                  Answering with your connected cloud AI — going offline will need the on-device
                  model instead.
                </p>
              </div>
            )}
            {modelStatus === "ready" && !offlineCapable && (
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
                  Ask about your coursework, or anything else — answered by your connected cloud AI
                  when you're online, or on-device when you're not.
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
                      {thinkingLabel}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div ref={sentinelRef} />
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
