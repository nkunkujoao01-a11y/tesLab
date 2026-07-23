import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  Download,
  Brain,
  CircleCheck,
  TriangleAlert,
  CloudCog,
  GraduationCap,
  ArrowUpRight,
  Unlink,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileShell, PageHeader } from "@/components/MobileShell";
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
  useAIModelStatus,
  useDownloadAIModel,
  useAIModelOfflineCapable,
} from "@/hooks/use-ai-model";
import {
  useChatModelStatus,
  useDownloadChatModel,
  useChatModelChoice,
  useChatModelCachedStatus,
  useChatModelOfflineCapable,
  useStaleAiOperationWarning,
} from "@/hooks/use-ai-chat";
import { CHAT_MODELS, type ChatModelChoice } from "@/lib/ai-chat";
import { useCloudAiKey, useCloudAiEnabled, useCloudAiQuota } from "@/hooks/use-cloud-ai";
import { useMoodleConnection } from "@/hooks/use-moodle";
import { Switch } from "@/components/ui/switch";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useClearCache } from "@/hooks/use-clear-cache";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "AI settings — eLearn" },
      { name: "description", content: "Manage on-device AI models and your free cloud AI key." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const staleAiOperation = useStaleAiOperationWarning();
  const modelStatus = useAIModelStatus();
  const modelOfflineCapable = useAIModelOfflineCapable();
  const { downloadModel, status: downloadStatus, progress, finalizing } = useDownloadAIModel();
  const chatModelStatus = useChatModelStatus();
  const chatModelOfflineCapable = useChatModelOfflineCapable();
  const [chatModelChoice, setChatModelChoice] = useChatModelChoice();
  const {
    downloadModel: downloadChatModel,
    status: chatDownloadStatus,
    progress: chatProgress,
    finalizing: chatFinalizing,
  } = useDownloadChatModel();
  const smollm2Cached = useChatModelCachedStatus("smollm2");
  const gemma3Cached = useChatModelCachedStatus("gemma3-1b");
  const chatModelCachedByChoice: Record<ChatModelChoice, boolean | null> = {
    smollm2: smollm2Cached,
    "gemma3-1b": gemma3Cached,
  };
  const isOnline = useOnlineStatus();
  const { connected, connecting, connect, disconnect } = useCloudAiKey();
  const [cloudEnabled, setCloudEnabled] = useCloudAiEnabled();
  const cloudQuota = useCloudAiQuota();
  const [keyInput, setKeyInput] = useState("");
  const moodle = useMoodleConnection();
  const [moodleStudentNumber, setMoodleStudentNumber] = useState("");
  const [moodlePassword, setMoodlePassword] = useState("");
  const { clearCacheAndReload, clearing } = useClearCache();

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await connect(keyInput);
    if (ok) setKeyInput("");
  };

  const handleMoodleConnect = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await moodle.connect(moodleStudentNumber, moodlePassword);
    if (ok) {
      setMoodleStudentNumber("");
      setMoodlePassword("");
    }
  };

  return (
    <MobileShell>
      <PageHeader eyebrow="AI settings" title="On-device models & free cloud AI" />

      <div className="space-y-8 px-6 pb-16 lg:max-w-[680px] lg:px-10">
        {/* A genuine crash mid-download/generation can't be caught as a
         * normal error (see ai-crash-breadcrumb.ts) — this is a
         * deliberately low-confidence, one-time signal for that, shown
         * here since this is where model management lives, not proof a
         * crash definitely happened (closing the tab on purpose mid-
         * operation leaves the same trace). */}
        {staleAiOperation && (
          <div className="animate-rise flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <p>
              The AI didn't finish {staleAiOperation.op === "load" ? "loading" : "generating"}{" "}
              {staleAiOperation.modelLabel} last time — this can happen if the app closed or
              crashed. If that keeps happening, try a smaller model below.
            </p>
          </div>
        )}

        {/* Cloud AI (BYOK) */}
        <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <CloudCog className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-prestige-deep">Free cloud AI</p>
              <p className="text-[11px] text-muted-foreground">
                Better quizzes, flashcards, notes, and summaries when you're online — uses your own
                free Google AI key, never a shared one, so it stays free no matter how many students
                use it.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {connected === undefined ? null : connected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-prestige-mid">
                    <CircleCheck className="h-4 w-4 text-prestige-gold" strokeWidth={1.75} />
                    Connected
                  </div>
                  <button
                    type="button"
                    onClick={() => void disconnect()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-destructive ring-1 ring-destructive/30 transition-colors hover:bg-destructive/5"
                  >
                    <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Disconnect
                  </button>
                </div>

                {/* Separate from "connected" — a saved key alone used to
                 * mean "always used when online," with no way to opt back
                 * out to on-device-only without disconnecting the key
                 * entirely (and losing it, since it's never shown again). */}
                <label className="flex items-center justify-between gap-4 rounded-xl bg-secondary/60 px-3.5 py-3">
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-prestige-deep">
                      Use automatically when online
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Quizzes, flashcards, notes, and summaries prefer the cloud AI while this is on
                      and you're online; otherwise the on-device AI handles them.
                    </span>
                  </span>
                  <Switch
                    checked={cloudEnabled}
                    onCheckedChange={setCloudEnabled}
                    className="shrink-0 data-[state=checked]:bg-prestige-deep"
                  />
                </label>

                <p className="text-[11px] text-muted-foreground">
                  {cloudQuota.used} of {cloudQuota.limit} free AI generations used today &middot;
                  resets at midnight. Once reached, generation falls back to on-device
                  automatically.
                </p>
              </div>
            ) : (
              <form onSubmit={(e) => void handleConnect(e)} className="space-y-3">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-prestige-deep underline decoration-prestige-gold underline-offset-4"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                  1. Get a free key from Google AI Studio
                </a>
                <details className="group text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium text-prestige-deep/70 hover:text-prestige-deep">
                    Exactly what you'll see on that page
                  </summary>
                  <ol className="mt-1.5 list-decimal space-y-2 pl-4">
                    <li>
                      <span className="font-medium text-foreground">"Welcome to AI Studio"</span> —
                      tick the agreement checkbox (you're a developer using the free API — this is
                      normal, not a paid signup) and click{" "}
                      <span className="font-medium text-foreground">Continue</span>. The email
                      updates checkbox is optional, skip it if you want.
                    </li>
                    <li>
                      Top right of the page, click{" "}
                      <span className="font-medium text-foreground">+ Create API key</span>.
                    </li>
                    <li>
                      A "Create a new key" popup appears — type any name (e.g.{" "}
                      <span className="font-medium text-foreground">Gemini API Key</span>), leave
                      the project as{" "}
                      <span className="font-medium text-foreground">Default Gemini Project</span>{" "}
                      unless you already have one, then click{" "}
                      <span className="font-medium text-foreground">Create key</span>.
                    </li>
                    <li>
                      A second popup shows your new key. Click the small copy icon next to it (or
                      select and copy the text starting with{" "}
                      <span className="font-medium text-foreground">AQ.</span> or{" "}
                      <span className="font-medium text-foreground">AIza</span>) — then come back to
                      this page and paste it below.
                    </li>
                  </ol>
                </details>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="2. Paste your key here"
                    className="h-10 flex-1 rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50"
                  />
                  <button
                    type="submit"
                    disabled={connecting || !keyInput.trim() || !isOnline}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
                  >
                    {connecting ? "Connecting…" : "Connect"}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {!isOnline
                    ? "You're offline — reconnect to save your key."
                    : "Free, no credit card. Your key is encrypted and only ever usable by your own account."}
                </p>
              </form>
            )}
          </div>
        </section>

        {/* NUST eLearning (Moodle) connection */}
        <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-prestige-deep">NUST eLearning</p>
              <p className="text-[11px] text-muted-foreground">
                Pull in your real courses, materials, and grades from elearning.nust.na — your
                password is sent once to connect and never stored, only a revocable access token is.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {!moodle.loaded ? null : moodle.connected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-prestige-mid">
                    <CircleCheck className="h-4 w-4 text-prestige-gold" strokeWidth={1.75} />
                    Connected{moodle.fullName ? ` as ${moodle.fullName}` : ""}
                  </div>
                  <button
                    type="button"
                    onClick={() => void moodle.disconnect()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-destructive ring-1 ring-destructive/30 transition-colors hover:bg-destructive/5"
                  >
                    <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Disconnect
                  </button>
                </div>

                {moodle.needsReconnect && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    <p>
                      Your NUST eLearning connection needs to be reconnected — your access token was
                      revoked or expired. Disconnect, then connect again below.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  {moodle.lastSyncAt
                    ? `Last synced ${new Date(moodle.lastSyncAt).toLocaleString()}`
                    : "Not synced yet — your courses will appear after the first sync."}
                </p>
              </div>
            ) : (
              <form onSubmit={(e) => void handleMoodleConnect(e)} className="space-y-3">
                <div className="flex flex-col gap-2">
                  <input
                    value={moodleStudentNumber}
                    onChange={(e) => setMoodleStudentNumber(e.target.value)}
                    placeholder="Student number"
                    autoComplete="username"
                    className="h-10 flex-1 rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50"
                  />
                  <input
                    type="password"
                    value={moodlePassword}
                    onChange={(e) => setMoodlePassword(e.target.value)}
                    placeholder="NUST eLearning password"
                    autoComplete="current-password"
                    className="h-10 flex-1 rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50"
                  />
                  <button
                    type="submit"
                    disabled={
                      moodle.connecting ||
                      !moodleStudentNumber.trim() ||
                      !moodlePassword ||
                      !isOnline
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40"
                  >
                    {moodle.connecting ? "Connecting…" : "Connect"}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {!isOnline
                    ? "You're offline — reconnect to connect your account."
                    : "Same login you use at elearning.nust.na. Sent once to connect, never stored."}
                </p>
              </form>
            )}
          </div>
        </section>

        {/* AI summarization model */}
        <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <Brain className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-prestige-deep">
                On-device summarization model
              </p>
              <p className="text-[11px] text-muted-foreground">
                On-device T5 model &middot; ~155 MB &middot; runs fully offline once downloaded
              </p>
            </div>
          </div>

          <div className="mt-4">
            {modelStatus === "ready" ? (
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-prestige-mid">
                  <CircleCheck className="h-4 w-4 text-prestige-gold" strokeWidth={1.75} />
                  Downloaded &middot; used automatically when offline or without cloud AI connected
                </div>
                {!modelOfflineCapable && (
                  <div className="animate-rise mt-3 flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    <p>
                      This device couldn't save the model for offline reuse — it works right now,
                      but may need to redownload after you leave while offline.
                    </p>
                  </div>
                )}
              </div>
            ) : downloadStatus === "downloading" ? (
              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-prestige-deep/10">
                  <div
                    className={cn(
                      "h-full bg-prestige-gold transition-all",
                      finalizing && "animate-pulse",
                    )}
                    style={{ width: `${finalizing ? 100 : progress}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {finalizing ? "Finishing up — almost there…" : `Downloading… ${progress}%`}
                </p>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  disabled={!isOnline}
                  aria-disabled={!isOnline}
                  title={!isOnline ? "Downloading the model needs a network connection" : undefined}
                  onClick={() => void downloadModel()}
                  className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Download model
                </button>
                {downloadStatus === "error" && (
                  <p className="mt-2 text-[11px] text-destructive">
                    Download failed. Check your connection and try again.
                  </p>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {!isOnline
                    ? "You're offline — reconnect to download the model."
                    : "Until downloaded, summaries use a fast built-in fallback — no download required."}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* AI chat model (Feature 47) — a genuinely separate download from
            the summarizer above: this is what powers Ask AI and quiz
            generation. Two selectable models, not one, so upgrading to a
            larger, more capable model is opt-in rather than forced on
            everyone regardless of connection/storage. */}
        <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <Brain className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-prestige-deep">On-device Ask AI chat model</p>
              <p className="text-[11px] text-muted-foreground">
                Powers Ask AI and quiz generation &middot; runs fully offline once downloaded
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {(Object.keys(CHAT_MODELS) as ChatModelChoice[]).map((choice) => {
              const info = CHAT_MODELS[choice];
              const selected = chatModelChoice === choice;
              const cached = chatModelCachedByChoice[choice];
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setChatModelChoice(choice)}
                  className={cn(
                    "w-full rounded-lg p-3 text-left ring-1 transition-colors",
                    selected
                      ? "bg-prestige-deep/5 ring-prestige-deep/30"
                      : "ring-border/70 hover:bg-secondary",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-prestige-deep">{info.label}</p>
                    <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                      ~{info.approxSizeMb} MB
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{info.description}</p>
                  {cached && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-prestige-mid">
                      <CircleCheck className="h-3 w-3 text-prestige-gold" strokeWidth={1.75} />
                      Downloaded on this device
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {chatModelStatus === "ready" ? (
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-prestige-mid">
                  <CircleCheck className="h-4 w-4 text-prestige-gold" strokeWidth={1.75} />
                  {CHAT_MODELS[chatModelChoice].label} downloaded &middot; used automatically
                </div>
                {!chatModelOfflineCapable && (
                  <div className="animate-rise mt-3 flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    <p>
                      This device couldn't save the assistant for offline reuse — it works right
                      now, but may need to redownload after you leave while offline.
                    </p>
                  </div>
                )}
              </div>
            ) : chatDownloadStatus === "downloading" ? (
              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-prestige-deep/10">
                  <div
                    className={cn(
                      "h-full bg-prestige-gold transition-all",
                      chatFinalizing && "animate-pulse",
                    )}
                    style={{ width: `${chatFinalizing ? 100 : chatProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {chatFinalizing
                    ? "Finishing up — almost there…"
                    : `Downloading ${CHAT_MODELS[chatModelChoice].label}… ${chatProgress}%`}
                </p>
              </div>
            ) : (
              <div>
                {chatModelChoice === "gemma3-1b" ? (
                  // Gemma 3 1B has real, unresolved crash reports from
                  // real-device testing — the download itself has taken a
                  // whole device down before, not just failed cleanly.
                  // Still offered (a valid choice for someone with a
                  // capable device), but gated behind an explicit
                  // confirmation every time rather than one tap, with a
                  // one-click de-escalation to the smaller model that's
                  // never had this problem.
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        disabled={!isOnline}
                        aria-disabled={!isOnline}
                        title={
                          !isOnline ? "Downloading the model needs a network connection" : undefined
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
                      >
                        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Download {CHAT_MODELS[chatModelChoice].label}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Download Gemma 3 (1B)?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This model has caused some devices to crash during download — closing
                          other tabs/apps first may help. If it happens to you, SmolLM2 is smaller
                          and hasn't had this problem.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setChatModelChoice("smollm2")}>
                          Use SmolLM2 instead
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => void downloadChatModel()}>
                          Continue anyway
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <button
                    type="button"
                    disabled={!isOnline}
                    aria-disabled={!isOnline}
                    title={
                      !isOnline ? "Downloading the model needs a network connection" : undefined
                    }
                    onClick={() => void downloadChatModel()}
                    className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Download {CHAT_MODELS[chatModelChoice].label}
                  </button>
                )}
                {chatDownloadStatus === "error" && (
                  <p className="mt-2 text-[11px] text-destructive">
                    Download failed. Check your connection and try again.
                  </p>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {!isOnline
                    ? "You're offline — reconnect to download the model."
                    : "Until downloaded, Ask AI and on-device quiz generation aren't available."}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
              <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-prestige-deep">Clear cache &amp; reload</p>
              <p className="text-[11px] text-muted-foreground">
                Fixes a broken/unstyled page after an update — re-downloads everything fresh. Your
                downloads, progress, and account aren't affected.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={clearing}
            onClick={() => void clearCacheAndReload()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-prestige-deep ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.97] disabled:opacity-40"
          >
            <RotateCcw
              className={cn("h-3.5 w-3.5", clearing && "animate-spin")}
              strokeWidth={1.75}
            />
            {clearing ? "Clearing…" : "Clear cache & reload"}
          </button>
        </section>
      </div>
    </MobileShell>
  );
}
