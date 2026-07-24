import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { deviceDb } from "@/lib/db";
import {
  loadSummarizerModel,
  isSummarizerCachedForOffline,
  type ModelProgress,
} from "@/lib/ai-model";
import { notifyIfPermitted } from "@/hooks/use-permissions";
import { acquireWakeLock, releaseWakeLock } from "@/lib/wake-lock";

const SETTING_KEY = "ai_model_downloaded";
// Separate from SETTING_KEY: whether the download actually persisted for
// reuse, not just whether it completed this session — mirrors
// use-ai-chat.ts's identical pair for the chat model; see
// isSummarizerCachedForOffline's own comment for why these can genuinely
// differ (a caught, non-fatal Cache API failure).
const OFFLINE_CACHED_KEY = "ai_model_offline_cached";

/** Whether the summarizer is actually cached for reuse without a network
 * connection — distinct from useAIModelStatus, which only means "the
 * download completed this session." Mirrors
 * use-ai-chat.ts's useChatModelOfflineCapable. */
export function useAIModelOfflineCapable(): boolean {
  const [cached, setCached] = useState(false);

  useEffect(() => {
    const sub = liveQuery(() => deviceDb.appSettings.get(OFFLINE_CACHED_KEY)).subscribe({
      next: (row) => setCached(row?.value === "true"),
      error: (err) => console.error("Failed to read AI model offline-cache status", err),
    });
    return () => sub.unsubscribe();
  }, []);

  return cached;
}

export type ModelStatus = "not-downloaded" | "downloading" | "ready" | "error";

/** Whether the neural model has previously finished downloading on this
 * device — read from IndexedDB so the UI can show "Downloaded" without
 * instantiating the (heavy) model pipeline just to check. */
export function useAIModelStatus(): ModelStatus {
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const sub = liveQuery(() => deviceDb.appSettings.get(SETTING_KEY)).subscribe({
      next: (row) => setDownloaded(row?.value === "true"),
      error: (err) => console.error("Failed to read AI model status", err),
    });
    return () => sub.unsubscribe();
  }, []);

  return downloaded ? "ready" : "not-downloaded";
}

// How long the byte-progress can sit unchanged, once it's already nearly
// done, before the UI stops trusting it and switches to a "finishing up"
// message instead. Only armed once progress reaches FINALIZING_THRESHOLD —
// a slow-but-still-trickling early download (the "poor network" case this
// whole feature exists for) naturally has gaps between chunk-arrival events
// too, and flipping to "finishing up" mid-download on a normal slow
// connection would be actively misleading, not helpful. The real gap this
// targets is different: transformers.js still has to build the model graph
// and run a warm-up pass *after* every byte is already downloaded, with no
// progress events of its own, and that measured ~70s with zero visible
// change in practice (see DEV_LOG.md, Feature 31) — long enough that a
// real user reported the download as broken when it was actually still
// working the whole time.
const FINALIZING_THRESHOLD = 90;
const STALL_MS = 4000;

export function useDownloadAIModel() {
  const [status, setStatus] = useState<"idle" | "downloading" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [finalizing, setFinalizing] = useState(false);

  const downloadModel = useCallback(async () => {
    setStatus("downloading");
    setProgress(0);
    setFinalizing(false);
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const armStallTimer = (currentProgress: number) => {
      clearTimeout(stallTimer);
      if (currentProgress < FINALIZING_THRESHOLD) return;
      stallTimer = setTimeout(() => setFinalizing(true), STALL_MS);
    };
    // Best-effort only — see wake-lock.ts for exactly what this does and
    // doesn't protect against (screen-off while foregrounded, not
    // backgrounding/app-switching).
    const wakeLock = await acquireWakeLock();
    try {
      // transformers.js reports per-file progress; multiple files (tokenizer,
      // encoder, decoder) download in parallel, so track a simple overall
      // percentage rather than trying to weight each file separately.
      const totals = new Map<string, number>();
      const loaded = new Map<string, number>();
      await loadSummarizerModel((p: ModelProgress) => {
        if (p.status === "progress" && p.file && typeof p.total === "number") {
          totals.set(p.file, p.total);
          loaded.set(p.file, p.loaded ?? 0);
          const totalSum = [...totals.values()].reduce((a, b) => a + b, 0);
          const loadedSum = [...loaded.values()].reduce((a, b) => a + b, 0);
          const pct = totalSum > 0 ? Math.min(100, Math.round((loadedSum / totalSum) * 100)) : 0;
          setProgress(pct);
          setFinalizing(false);
          armStallTimer(pct);
        }
      });
      const offlineCached = await isSummarizerCachedForOffline();
      await deviceDb.appSettings.put({ key: SETTING_KEY, value: "true" });
      await deviceDb.appSettings.put({
        key: OFFLINE_CACHED_KEY,
        value: offlineCached ? "true" : "false",
      });
      setProgress(100);
      setStatus("idle");
      notifyIfPermitted(
        "Summarization model ready",
        "It'll be used automatically for new summaries.",
      );
    } catch (err) {
      console.error("Failed to download AI model", err);
      setStatus("error");
    } finally {
      clearTimeout(stallTimer);
      void releaseWakeLock(wakeLock);
    }
  }, []);

  return { downloadModel, status, progress, finalizing };
}
