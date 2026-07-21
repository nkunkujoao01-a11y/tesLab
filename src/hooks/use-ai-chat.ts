import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";
import { deviceDb, getUserDb, type AssistantMessage } from "@/lib/db";
import { notifyIfPermitted } from "@/hooks/use-permissions";
import {
  loadChatModel,
  askChatModel,
  isModelCachedForOffline,
  getSelectedChatModel,
  setSelectedChatModel,
  DEFAULT_CHAT_MODEL,
  type ModelProgress,
  type ChatTurn,
  type ChatModelChoice,
} from "@/lib/ai-chat";
import { useAuth } from "@/hooks/use-auth";
import {
  checkAndConsumeStaleAiBreadcrumb,
  type StaleAiBreadcrumb,
} from "@/lib/ai-crash-breadcrumb";

const SETTING_KEY = "ai_chat_model_downloaded";
// Separate from SETTING_KEY: whether the download actually persisted for
// reuse, not just whether it completed this session — see
// isModelCachedForOffline's own comment for why these can genuinely
// differ.
const OFFLINE_CACHED_KEY = "ai_chat_model_offline_cached";

/** These two flags describe the *currently selected* model (see
 * useChatModelChoice, Feature 47) — SmolLM2 and Gemma 3 are independent
 * downloads, each with its own real Cache Storage entry, but this app
 * only ever runs one at a time, so a single pair of "is it ready" flags
 * is enough as long as they're kept in sync with whichever model is
 * selected. That resync happens once, right when the selection changes
 * (see useChatModelChoice's setter) — everywhere else in the app that
 * already reads these two flags via useChatModelStatus/
 * useChatModelOfflineCapable keeps working unmodified. */
async function syncModelStatusFlags(choice: ChatModelChoice): Promise<void> {
  const cached = await isModelCachedForOffline(choice);
  await deviceDb.appSettings.put({ key: SETTING_KEY, value: cached ? "true" : "false" });
  await deviceDb.appSettings.put({
    key: OFFLINE_CACHED_KEY,
    value: cached ? "true" : "false",
  });
}

/** The chat model the user has selected in Profile > AI Settings, and a
 * setter that also re-syncs the shared "is it ready" flags (see
 * syncModelStatusFlags) so switching models never leaves a stale
 * "Downloaded" status pointing at the model that's no longer selected. */
export function useChatModelChoice(): [ChatModelChoice, (choice: ChatModelChoice) => void] {
  const [choice, setChoiceState] = useState<ChatModelChoice>(DEFAULT_CHAT_MODEL);

  useEffect(() => {
    let cancelled = false;
    void getSelectedChatModel().then((c) => {
      if (!cancelled) setChoiceState(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setChoice = useCallback((next: ChatModelChoice) => {
    setChoiceState(next);
    void (async () => {
      await setSelectedChatModel(next);
      await syncModelStatusFlags(next);
    })();
  }, []);

  return [choice, setChoice];
}

/** Whether a specific model (not necessarily the currently selected one)
 * is already cached for offline use — checked directly against Cache
 * Storage each time, since this is what lets the Profile picker show a
 * real "Downloaded" chip on *either* option, not just the active one. */
export function useChatModelCachedStatus(choice: ChatModelChoice): boolean | null {
  const [cached, setCached] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCached(null);
    void isModelCachedForOffline(choice).then((c) => {
      if (!cancelled) setCached(c);
    });
    return () => {
      cancelled = true;
    };
  }, [choice]);

  return cached;
}

export type ChatModelStatus = "not-downloaded" | "downloading" | "ready" | "error";

/** Same pattern as useAIModelStatus (use-ai-model.ts) — a separate
 * IndexedDB key, since this is a genuinely separate model/download from
 * the summarizer, not a shared flag. */
export function useChatModelStatus(): ChatModelStatus {
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const sub = liveQuery(() => deviceDb.appSettings.get(SETTING_KEY)).subscribe({
      next: (row) => setDownloaded(row?.value === "true"),
      error: (err) => console.error("Failed to read chat model status", err),
    });
    return () => sub.unsubscribe();
  }, []);

  return downloaded ? "ready" : "not-downloaded";
}

/** Whether the model is actually cached for reuse without a network
 * connection — distinct from useChatModelStatus, which only means "the
 * download completed this session." See isModelCachedForOffline. */
export function useChatModelOfflineCapable(): boolean {
  const [cached, setCached] = useState(false);

  useEffect(() => {
    const sub = liveQuery(() => deviceDb.appSettings.get(OFFLINE_CACHED_KEY)).subscribe({
      next: (row) => setCached(row?.value === "true"),
      error: (err) => console.error("Failed to read chat model offline-cache status", err),
    });
    return () => sub.unsubscribe();
  }, []);

  return cached;
}

// Same "finishing up" stall-detection as useDownloadAIModel (use-ai-model.ts,
// Feature 31) — a small chat model still has to build its graph and run a
// warm-up pass after the last byte lands, with no progress events of its
// own, and that silent gap is exactly what previously read as "broken".
// Applying the fix here from the start rather than re-discovering it.
const FINALIZING_THRESHOLD = 90;
const STALL_MS = 4000;

export function useDownloadChatModel() {
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
    try {
      const totals = new Map<string, number>();
      const loaded = new Map<string, number>();
      await loadChatModel((p: ModelProgress) => {
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
      const offlineCached = await isModelCachedForOffline();
      await deviceDb.appSettings.put({ key: SETTING_KEY, value: "true" });
      await deviceDb.appSettings.put({
        key: OFFLINE_CACHED_KEY,
        value: offlineCached ? "true" : "false",
      });
      setProgress(100);
      setStatus("idle");
      notifyIfPermitted("Study assistant ready", "You can start asking it questions now.");
    } catch (err) {
      console.error("Failed to download chat model", err);
      setStatus("error");
    } finally {
      clearTimeout(stallTimer);
    }
  }, []);

  return { downloadModel, status, progress, finalizing };
}

/** Every message in the signed-in user's assistant conversation, oldest
 * first — one ongoing thread, not multiple named chats (kept simple for a
 * first pass; see DEV_LOG.md, Feature 34). */
export function useAssistantMessages(): AssistantMessage[] {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }
    const db = getUserDb(user.id);
    const sub = liveQuery(() => db.assistantMessages.orderBy("timestamp").toArray()).subscribe({
      next: setMessages,
      error: (err) => console.error("Failed to read assistant messages", err),
    });
    return () => sub.unsubscribe();
  }, [user]);

  return messages;
}

const SYSTEM_PROMPT =
  "You are a helpful study assistant for university students. Answer clearly and concisely.";

// A small on-device model has a limited practical context window and gets
// slower with every extra token — cap how much history rides along on
// each turn rather than sending the whole conversation forever.
const MAX_HISTORY_MESSAGES = 10;

export function useSendAssistantMessage() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!user || !trimmed || sending) return;
      const db = getUserDb(user.id);
      const now = Date.now();
      await db.assistantMessages.put({
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: now,
      });

      setSending(true);
      setStreamingText("");
      try {
        const history = await db.assistantMessages.orderBy("timestamp").toArray();
        const recent = history.slice(-MAX_HISTORY_MESSAGES);
        const turns: ChatTurn[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...recent.map((m) => ({ role: m.role, content: m.content }) as ChatTurn),
        ];
        const response = await askChatModel(turns, (piece) =>
          setStreamingText((prev) => prev + piece),
        );
        await db.assistantMessages.put({
          id: crypto.randomUUID(),
          role: "assistant",
          content: response,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("Assistant failed to respond", err);
        toast.error("The assistant couldn't respond. Try again.");
      } finally {
        setSending(false);
        setStreamingText("");
      }
    },
    [user, sending],
  );

  return { sendMessage, sending, streamingText };
}

/** Checks, once, for a stale AI-operation breadcrumb left over from a
 * previous session (see ai-crash-breadcrumb.ts) — consistent with, but not
 * proof of, the process having crashed mid-download/generation last time.
 * Consumed (deleted) the moment it's read, so this only ever surfaces
 * once, whether or not the caller ends up showing anything for it. */
export function useStaleAiOperationWarning(): StaleAiBreadcrumb | null {
  const [breadcrumb, setBreadcrumb] = useState<StaleAiBreadcrumb | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkAndConsumeStaleAiBreadcrumb().then((b) => {
      if (!cancelled) setBreadcrumb(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return breadcrumb;
}

export function useClearAssistantConversation() {
  const { user } = useAuth();

  const clearConversation = useCallback(async () => {
    if (!user) return;
    await getUserDb(user.id).assistantMessages.clear();
  }, [user]);

  return { clearConversation };
}
