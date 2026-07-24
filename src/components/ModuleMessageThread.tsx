// One conversation thread — reused by both the admin panel (any student,
// see admin.modules.$moduleId.tsx) and a student's own message view (see
// courses.$moduleId.index.tsx), which is why `isLecturerView` exists: the
// same messages, the same send box, but only the lecturer side can toggle
// whether replies are open at all.
import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, LockOpen, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useModuleConversation, useSetRepliesAllowed } from "@/hooks/use-module-messaging";

export function ModuleMessageThread({
  moduleId,
  studentId,
  isLecturerView,
}: {
  moduleId: string;
  studentId: string;
  isLecturerView: boolean;
}) {
  const { user } = useAuth();
  const { messages, repliesAllowed, loading, send } = useModuleConversation(moduleId, studentId);
  const { setRepliesAllowed, updating } = useSetRepliesAllowed(moduleId, studentId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const canSend = isLecturerView || repliesAllowed;

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    const ok = await send(draft);
    if (ok) setDraft("");
    setSending(false);
  };

  return (
    <div className="flex h-full flex-col">
      {isLecturerView && (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <p className="text-[11px] text-muted-foreground">
            {repliesAllowed ? "This student can reply" : "Replies are turned off"}
          </p>
          <button
            type="button"
            disabled={updating}
            onClick={() => void setRepliesAllowed(!repliesAllowed)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-prestige-mid ring-1 ring-border/70 transition-all hover:bg-secondary disabled:opacity-40"
          >
            {repliesAllowed ? (
              <Lock className="h-3 w-3" strokeWidth={1.75} />
            ) : (
              <LockOpen className="h-3 w-3" strokeWidth={1.75} />
            )}
            {repliesAllowed ? "Turn off replies" : "Allow replies"}
          </button>
        </div>
      )}

      <div className="flex-1 space-y-2.5 overflow-y-auto py-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isOwn = m.senderId === user?.id;
            return (
              <div key={m.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    isOwn
                      ? "bg-prestige-deep text-prestige-cream"
                      : "bg-secondary text-foreground/90",
                  )}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {!isLecturerView && !repliesAllowed && (
        <p className="border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          Replies are turned off for this conversation right now.
        </p>
      )}

      {canSend && (
        <div className="flex items-center gap-2 border-t border-border/60 pt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend();
            }}
            placeholder="Write a message…"
            className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50"
          />
          <button
            type="button"
            disabled={!draft.trim() || sending}
            onClick={() => void handleSend()}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-prestige-deep text-prestige-cream transition-transform active:scale-90 disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
