import { Bot, Download } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useDownloadChatModel } from "@/hooks/use-ai-chat";

/** The on-device chat model download prompt — shared by the general "Ask
 * AI" assistant (Phase I1) and any collection-scoped chat (Phase I2),
 * since both run through the same single chat engine/download (see
 * src/lib/ai-chat.ts) and should show the same honest framing rather
 * than two copies that could drift out of sync. */
export function ChatModelDownloadPrompt() {
  const isOnline = useOnlineStatus();
  const { downloadModel, status, progress, finalizing } = useDownloadChatModel();

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="animate-rise max-w-[440px] rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-prestige-deep/5 text-prestige-mid">
          <Bot className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <p className="mt-4 font-display text-lg text-prestige-deep">On-device study assistant</p>
        <p className="mt-2 text-sm text-muted-foreground">
          A small AI model that downloads once and then answers questions entirely on this device —
          no internet needed afterward. It's genuinely more limited than commercial AI like ChatGPT,
          in exchange for being free, private, and fully offline.
        </p>

        {status === "downloading" ? (
          <div className="mt-6">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-prestige-deep/10">
              <div
                className={`h-full bg-prestige-gold transition-all ${finalizing ? "animate-pulse" : ""}`}
                style={{ width: `${finalizing ? 100 : progress}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {finalizing ? "Finishing up — almost there…" : `Downloading… ${progress}%`}
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={!isOnline}
              title={!isOnline ? "Downloading needs a network connection" : undefined}
              onClick={() => void downloadModel()}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              Download assistant
            </button>
            {status === "error" && (
              <p className="mt-3 text-[11px] text-destructive">
                Download failed. Check your connection and try again.
              </p>
            )}
            {!isOnline && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                You're offline — reconnect to download.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
