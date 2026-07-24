import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CloudDownload,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { ChatModelDownloadPrompt } from "@/components/ChatModelDownloadPrompt";
import { fetchModule } from "@/lib/modules-api";
import { useDownloadedModuleMaterials } from "@/hooks/use-downloads";
import {
  useChatModelStatus,
  useThinkingLabel,
  useStaleAiOperationWarning,
} from "@/hooks/use-ai-chat";
import { useCloudAiKey, useCloudAiEnabled } from "@/hooks/use-cloud-ai";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import {
  useCollectionMessages,
  useSendCollectionMessage,
  useClearCollectionConversation,
} from "@/hooks/use-collection-chat";
import type { RetrievableDocument } from "@/lib/retrieval";
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

export const Route = createFileRoute("/courses/$moduleId/chat/")({
  loader: async ({ params }) => {
    const module = await fetchModule(params.moduleId);
    if (!module) throw notFound();
    return { module };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Ask AI — ${loaderData.module.code}`
          : "Ask AI about this module — eLearn",
      },
      {
        name: "description",
        content: "Ask questions grounded in every downloaded material in this module.",
      },
    ],
  }),
  component: ModuleChat,
});

/** Ask-AI-about-this-whole-module — same grounded-chat machinery as
 * documents.collections.$collectionId.chat.tsx (retrieval across several
 * documents at once, cloud-first with on-device fallback), just sourcing
 * its "documents" from every material this student has downloaded in
 * this module (use-downloads.ts) instead of a personal-document folder.
 * Scoped by the module's own id — a bare catalog slug like "sen-301",
 * genuinely distinct from every other key already used in
 * collectionMessages (materialKey's "moduleId::materialId" pairs, and
 * personal document/collection uuids) — so this is its own real
 * conversation thread, separate from any single material's own chat
 * (courses.$moduleId.chat.$docId.tsx). */
function ModuleChat() {
  const { module } = Route.useLoaderData();
  const contentByMaterialId = useDownloadedModuleMaterials(module.id);
  const modelStatus = useChatModelStatus();
  const messages = useCollectionMessages(module.id);

  const documents = useMemo<RetrievableDocument[]>(
    () =>
      module.materials
        .filter((m) => contentByMaterialId.has(m.id))
        .map((m) => {
          const content = contentByMaterialId.get(m.id)!;
          return {
            id: m.id,
            title: m.title,
            text: `${content.heading}\n\n${content.lead}\n\n${content.body.join("\n\n")}`,
          };
        }),
    [module.materials, contentByMaterialId],
  );

  const { sendMessage, sending, streamingText } = useSendCollectionMessage(module.id, documents);
  const thinkingLabel = useThinkingLabel(sending);
  const staleAiOperation = useStaleAiOperationWarning();
  const { clearConversation } = useClearCollectionConversation(module.id);
  const [draft, setDraft] = useState("");

  // See assistant.tsx's identical comment.
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-6 pt-10 pb-6 lg:px-10 lg:pt-14">
        <div className="min-w-0">
          <Link
            to="/courses/$moduleId"
            params={{ moduleId: module.id }}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {module.code}
          </Link>
          <h1 className="mt-3 font-display text-2xl font-medium tracking-tight text-balance text-prestige-deep lg:text-3xl">
            Ask AI about this module
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
                  Every message in this module's thread will be removed from this device. This can't
                  be undone.
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

      {documents.length === 0 ? (
        <div className="px-6 lg:px-10">
          <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
            <CloudDownload className="mx-auto h-8 w-8 text-prestige-gold" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg text-prestige-deep">No downloaded materials</p>
            <p className="mt-2 max-w-[36ch] mx-auto text-sm text-muted-foreground">
              Download at least one material in this module first — asking AI about it needs the
              actual text on this device.
            </p>
            <Link
              to="/courses/$moduleId"
              params={{ moduleId: module.id }}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97]"
            >
              Back to module
            </Link>
          </div>
        </div>
      ) : !chatReady ? (
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
            {messages.length === 0 && !streamingText && (
              <div className="animate-rise rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
                <Sparkles className="mx-auto h-6 w-6 text-prestige-gold" strokeWidth={1.5} />
                <p className="mt-3 text-sm text-muted-foreground">
                  Ask about anything in this module — answers are grounded across {documents.length}{" "}
                  downloaded {documents.length === 1 ? "material" : "materials"}, not just one.
                </p>
                <div className="mx-auto mt-4 flex max-w-[36ch] flex-wrap justify-center gap-1.5">
                  {documents.map((doc) => (
                    <span
                      key={doc.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary/60 px-2.5 py-1 text-[10px] font-medium text-prestige-mid"
                    >
                      <FileText className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{doc.title}</span>
                    </span>
                  ))}
                </div>
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
                placeholder="Ask about this module…"
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
