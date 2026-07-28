import { useEffect } from "react";
import { Bot, Download } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  useDownloadChatModel,
  useChatModelChoice,
  useGeminiNanoAvailability,
  useDownloadGeminiNano,
} from "@/hooks/use-ai-chat";
import { DOWNLOAD_RESILIENCE_NOTE } from "@/lib/resumable-fetch";

// Shared across both branches below — see legal.tsx's "AI features"
// section for the fuller version of this same honesty: on-device AI here
// is a working proof of concept, not a finished product, and how well it
// runs depends heavily on the specific device it's running on.
const PROOF_OF_CONCEPT_NOTE =
  "This is a working proof of concept, not a finished product — it may run smoothly on one device and struggle on another. For anything you need a dependable answer for, connect a free cloud AI key in Settings instead.";

/** The chat-engine-not-ready prompt — shared by the general "Ask AI"
 * assistant (Phase I1) and any collection-scoped chat (Phase I2), since
 * both run through the same single chat engine (see src/lib/ai-chat.ts)
 * and should show the same honest framing rather than two copies that
 * could drift out of sync. Branches on the currently selected model:
 * Gemini Nano (Chrome-managed, no app-level file download — see
 * settings.tsx's own equivalent card) gets its own download flow, distinct
 * from the transformers.js on-device model's. Without this branch, a
 * Gemini-Nano-selected user (the default on desktop, see ai-chat.ts's
 * getDefaultChatModel) would see this prompt's "Download assistant"
 * button call the wrong download function and throw outright — a real
 * bug found from a real device report. */
export function ChatModelDownloadPrompt() {
  const isOnline = useOnlineStatus();
  const [chatModelChoice, setChatModelChoice] = useChatModelChoice();
  const geminiNanoAvailability = useGeminiNanoAvailability();
  const {
    downloadModel: downloadGeminiNano,
    status: geminiNanoStatus,
    progress: geminiNanoProgress,
  } = useDownloadGeminiNano();
  const { downloadModel, status, progress, finalizing, errorMessage } = useDownloadChatModel();

  // Self-heals a selection that's stale or was never actually valid on
  // this device (e.g. persisted before ai-nano.ts's mobile override
  // shipped, or the Prompt API simply isn't enabled in this browser) —
  // this component is reached from five different chat surfaces, not just
  // Settings, so it can't rely on settings.tsx's own equivalent
  // self-heal effect having already run.
  useEffect(() => {
    if (chatModelChoice === "gemini-nano" && geminiNanoAvailability === "unavailable") {
      setChatModelChoice("smollm2");
    }
  }, [chatModelChoice, geminiNanoAvailability, setChatModelChoice]);

  if (chatModelChoice === "gemini-nano" && geminiNanoAvailability !== "unavailable") {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="animate-rise max-w-[440px] rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-prestige-deep/5 text-prestige-mid">
            <Bot className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <p className="mt-4 font-display text-lg text-prestige-deep">Gemini Nano</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Google's on-device model, built into Chrome itself — no file for this app to download.
            Chromium desktop only, no Android or iOS support.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">{PROOF_OF_CONCEPT_NOTE}</p>

          {geminiNanoAvailability === null ? (
            <p className="mt-6 text-[11px] text-muted-foreground">Checking this device…</p>
          ) : geminiNanoStatus === "downloading" ? (
            <div className="mt-6">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-prestige-deep/10">
                <div
                  className="h-full bg-prestige-gold transition-all"
                  style={{ width: `${geminiNanoProgress}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Downloading via Chrome… {geminiNanoProgress}%
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground">{DOWNLOAD_RESILIENCE_NOTE}</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={!isOnline}
                title={!isOnline ? "Downloading needs a network connection" : undefined}
                onClick={() => void downloadGeminiNano()}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                Download Gemini Nano
              </button>
              {geminiNanoStatus === "error" && (
                <p className="mt-3 text-[11px] text-destructive">
                  Download failed. Check your connection and try again.
                </p>
              )}
              {!isOnline && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  You're offline. Reconnect to download.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="animate-rise max-w-[440px] rounded-2xl bg-card p-8 text-center ring-1 ring-border/60">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-prestige-deep/5 text-prestige-mid">
          <Bot className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <p className="mt-4 font-display text-lg text-prestige-deep">On-device study assistant</p>
        <p className="mt-2 text-sm text-muted-foreground">
          A small AI model that downloads once and then answers questions entirely on this device,
          no internet needed afterward. It's genuinely more limited than commercial AI like ChatGPT,
          in exchange for being free, private, and fully offline.
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">{PROOF_OF_CONCEPT_NOTE}</p>

        {status === "downloading" ? (
          <div className="mt-6">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-prestige-deep/10">
              <div
                className={`h-full bg-prestige-gold transition-all ${finalizing ? "animate-pulse" : ""}`}
                style={{ width: `${finalizing ? 100 : progress}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {finalizing
                ? progress === 0
                  ? "Preparing your download… this initial step can take up to 20 seconds before progress shows."
                  : "Finishing up, almost there…"
                : `Downloading… ${progress}%`}
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground">{DOWNLOAD_RESILIENCE_NOTE}</p>
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
                {errorMessage ?? "Download failed. Check your connection and try again."}
              </p>
            )}
            {!isOnline && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                You're offline. Reconnect to download.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
