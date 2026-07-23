import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  LogOut,
  CircleCheck,
  TriangleAlert,
  Loader2,
  RefreshCw,
  HardDrive,
  Bell,
  BookPlus,
  Settings as SettingsIcon,
  MessageSquareText,
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { formatMb, formatRelative } from "@/lib/mock-data";
import {
  useStorageUsageMb,
  useStorageByKind,
  useDownloadedMaterialIds,
} from "@/hooks/use-downloads";
import { useStorageQuota, isStorageLow } from "@/hooks/use-storage-quota";
import { useAuth } from "@/hooks/use-auth";
import { useSummariesStorageMb } from "@/hooks/use-summaries";
import { useLastSyncedAt, useManualSync } from "@/hooks/use-sync";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { usePersistentStorage, useNotificationPermission } from "@/hooks/use-permissions";
import {
  useSubmitFeedback,
  makeFeedbackImage,
  MAX_FEEDBACK_IMAGES,
  MAX_IMAGE_MB,
  type FeedbackImage,
} from "@/hooks/use-feedback";

// Known material kinds (see supabase/migrations/0001_init.sql), in the
// order they're displayed. Any downloaded material whose kind doesn't
// match one of these (or predates Feature 17, which added kind tracking)
// is grouped under useStorageByKind()'s "other" bucket instead.
const KIND_LABELS: Record<string, string> = {
  slides: "Slides",
  reading: "Readings",
  handout: "Handouts",
  notes: "Notes",
  // A real bucket for uploaded personal documents' original files (see
  // PersonalDocumentFile) — not a catalog material kind, but still real,
  // named storage use rather than falling into "other".
  document: "My documents",
};

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — eLearn" },
      {
        name: "description",
        content: "Manage downloads and your account.",
      },
    ],
  }),
  component: Profile,
});

function Profile() {
  const usedMb = useStorageUsageMb();
  const storageQuota = useStorageQuota(usedMb);
  const pct = storageQuota.supported ? Math.min(100, (usedMb / storageQuota.quotaMb) * 100) : 0;
  const storageLow = isStorageLow(storageQuota);
  const byKind = useStorageByKind();
  const summariesMb = useSummariesStorageMb();
  const otherMb = byKind.other ?? 0;
  const downloadedMaterialCount = useDownloadedMaterialIds().size;
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  // The synthetic email a NUST-number login creates (moodle-server.ts's
  // studentNumberToEmail) is an internal implementation detail — a real
  // student never sees or chooses it, so it must never surface as their
  // displayed name. profile.full_name is already set from their real
  // Moodle name for that login path (see loginWithNustCredentials's own
  // metadata), so this fallback should rarely even trigger for it, but
  // guarding here too costs nothing and covers any edge case where the
  // profile row hasn't caught up yet.
  const isSyntheticNustEmail = (email: string | undefined) =>
    !!email && email.endsWith("@nust-student.invalid");
  const fullName =
    profile?.full_name ||
    (!isSyntheticNustEmail(user?.email) ? user?.email : undefined) ||
    "Student";
  const university = profile?.university || "Namibia University of Science and Technology";
  // No email fallback here at all — an email address was never a sensible
  // stand-in for "program," synthetic or real; simply nothing shows
  // instead of a confusing raw email under the student's name.
  const program = profile?.program || "";
  const [signingOut, setSigningOut] = useState(false);
  const lastSyncedAt = useLastSyncedAt();
  const { sync, syncing } = useManualSync();
  const isOnline = useOnlineStatus();
  const persistentStorage = usePersistentStorage();
  const notificationPermission = useNotificationPermission();
  const { submitFeedback, submitting: submittingFeedback } = useSubmitFeedback();
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackImages, setFeedbackImages] = useState<FeedbackImage[]>([]);
  const feedbackImageInputRef = useRef<HTMLInputElement>(null);

  const handleAddFeedbackImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_FEEDBACK_IMAGES - feedbackImages.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_FEEDBACK_IMAGES} images.`);
      return;
    }
    const oversized = files.find((f) => f.size > MAX_IMAGE_MB * 1024 * 1024);
    if (oversized) {
      toast.error(`${oversized.name} is too large — the limit is ${MAX_IMAGE_MB} MB per image.`);
      return;
    }
    setFeedbackImages((prev) => [...prev, ...files.slice(0, room).map(makeFeedbackImage)]);
  };

  const removeFeedbackImage = (id: string) => {
    setFeedbackImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleSubmitFeedback = async () => {
    const ok = await submitFeedback(feedbackMessage, feedbackImages);
    if (ok) {
      feedbackImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setFeedbackMessage("");
      setFeedbackImages([]);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      void navigate({ to: "/login" });
    } catch (err) {
      console.error("Failed to sign out", err);
      toast.error("Couldn't sign out. Check your connection and try again.");
      setSigningOut(false);
    }
  };

  return (
    <MobileShell>
      <PageHeader eyebrow="Account" title="Your library, your record" />

      <div className="grid gap-8 px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 lg:px-10 lg:pb-16">
        <div className="space-y-8">
          {/* Identity card */}
          <section className="animate-rise flex items-center gap-4 rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-prestige-deep font-display text-lg text-prestige-cream ring-2 ring-prestige-gold/30">
              {fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="eyebrow">{university}</p>
              <p className="mt-1 truncate font-display text-xl font-medium text-prestige-deep">
                {fullName}
              </p>
              {program && <p className="text-xs text-muted-foreground">{program}</p>}
            </div>
          </section>

          {/* Sync */}
          <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                  <RefreshCw
                    className={cn("h-4 w-4", syncing && "animate-spin")}
                    strokeWidth={1.75}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-prestige-deep">Progress sync</p>
                  <p className="text-[11px] text-muted-foreground">
                    {!isOnline
                      ? "Offline — reconnect to sync"
                      : syncing
                        ? "Syncing…"
                        : lastSyncedAt
                          ? `Last synced ${formatRelative(new Date(lastSyncedAt).toISOString())}`
                          : "Not synced yet"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={syncing || !isOnline}
                aria-disabled={!isOnline}
                title={!isOnline ? "Sync needs a network connection" : undefined}
                onClick={() => void sync()}
                className="shrink-0 rounded-lg bg-background px-3 py-1.5 text-xs font-medium ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.95] disabled:opacity-40 disabled:active:scale-100"
              >
                Sync now
              </button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Reading history, activity, and AI summaries sync automatically when you sign in or
              come back online — downloaded content itself stays on this device.
            </p>
          </section>

          {/* Device permissions */}
          <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
            <p className="text-sm font-medium text-prestige-deep">Device permissions</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                    <HardDrive className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-prestige-deep">Persistent storage</p>
                    <p className="text-[11px] text-muted-foreground">
                      {!persistentStorage.supported
                        ? "Not supported on this browser"
                        : persistentStorage.persisted
                          ? "Granted — downloads won't be cleared under storage pressure"
                          : "Keeps downloaded modules and AI models from being auto-cleared"}
                    </p>
                  </div>
                </div>
                {persistentStorage.supported && !persistentStorage.persisted && (
                  <button
                    type="button"
                    disabled={persistentStorage.requesting}
                    onClick={() => void persistentStorage.requestPersist()}
                    className="shrink-0 rounded-lg bg-background px-3 py-1.5 text-xs font-medium ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.95] disabled:opacity-40"
                  >
                    {persistentStorage.requesting ? "Requesting…" : "Enable"}
                  </button>
                )}
                {persistentStorage.persisted && (
                  <CircleCheck className="h-4 w-4 shrink-0 text-prestige-gold" strokeWidth={1.75} />
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                    <Bell className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-prestige-deep">Notifications</p>
                    <p className="text-[11px] text-muted-foreground">
                      {notificationPermission.permission === "unsupported"
                        ? "Not supported on this browser"
                        : notificationPermission.permission === "denied"
                          ? "Blocked — re-enable in your browser's site settings"
                          : notificationPermission.permission === "granted"
                            ? "Granted — you'll be told when a model finishes downloading"
                            : "Get notified when an AI model finishes downloading in the background"}
                    </p>
                  </div>
                </div>
                {notificationPermission.permission === "default" && (
                  <button
                    type="button"
                    disabled={notificationPermission.requesting}
                    onClick={() => void notificationPermission.requestPermission()}
                    className="shrink-0 rounded-lg bg-background px-3 py-1.5 text-xs font-medium ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.95] disabled:opacity-40"
                  >
                    {notificationPermission.requesting ? "Requesting…" : "Enable"}
                  </button>
                )}
                {notificationPermission.permission === "granted" && (
                  <CircleCheck className="h-4 w-4 shrink-0 text-prestige-gold" strokeWidth={1.75} />
                )}
              </div>
            </div>
          </section>

          {/* Send feedback */}
          <section className="animate-rise rounded-2xl bg-card p-6 ring-1 ring-border/60 lg:p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-prestige-deep">Send feedback</p>
                <p className="text-[11px] text-muted-foreground">
                  Report a problem or suggest an improvement — screenshots help
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="What happened, or what would you like to see?"
                rows={4}
                className="w-full resize-none rounded-lg border border-border/70 bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prestige-gold/50"
              />

              {feedbackImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {feedbackImages.map((img) => (
                    <div key={img.id} className="relative h-16 w-16 shrink-0">
                      <img
                        src={img.previewUrl}
                        alt=""
                        className="h-full w-full rounded-lg object-cover ring-1 ring-border/70"
                      />
                      <button
                        type="button"
                        onClick={() => removeFeedbackImage(img.id)}
                        aria-label="Remove image"
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-prestige-deep text-prestige-cream shadow"
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div>
                  <input
                    ref={feedbackImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAddFeedbackImages}
                  />
                  <button
                    type="button"
                    disabled={feedbackImages.length >= MAX_FEEDBACK_IMAGES}
                    onClick={() => feedbackImageInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-prestige-mid ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.95] disabled:opacity-40"
                  >
                    <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Add screenshot
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!isOnline || !feedbackMessage.trim() || submittingFeedback}
                  aria-disabled={!isOnline}
                  title={!isOnline ? "Sending feedback needs a network connection" : undefined}
                  onClick={() => void handleSubmitFeedback()}
                  className="inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-all active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
                >
                  {submittingFeedback ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                  ) : null}
                  {submittingFeedback ? "Sending…" : "Send"}
                </button>
              </div>
              {!isOnline && (
                <p className="text-[11px] text-muted-foreground">
                  You're offline — reconnect to send feedback.
                </p>
              )}
            </div>
          </section>

          {/* Settings list */}
          <section className="animate-rise overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
            <ul className="divide-y divide-border/60">
              {profile?.is_lecturer && (
                <li>
                  <Link
                    to="/admin"
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                      <BookPlus className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-prestige-deep">Admin console</p>
                      <p className="text-[11px] text-muted-foreground">Lecturer tools</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-prestige-gold" strokeWidth={2} />
                  </Link>
                </li>
              )}
              <li>
                <Link
                  to="/settings"
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                    <SettingsIcon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-prestige-deep">AI settings</p>
                    <p className="text-[11px] text-muted-foreground">
                      On-device models &amp; free cloud AI
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-prestige-gold" strokeWidth={2} />
                </Link>
              </li>
              <li>
                <Link
                  to="/courses"
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                    <Download className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-prestige-deep">Downloads</p>
                    <p className="text-[11px] text-muted-foreground">
                      {downloadedMaterialCount} {downloadedMaterialCount === 1 ? "item" : "items"}{" "}
                      &middot; {formatMb(usedMb)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-prestige-gold" strokeWidth={2} />
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/40 disabled:opacity-60"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                    {signingOut ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <LogOut className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </div>
                  <p className="text-sm font-medium text-prestige-deep">
                    {signingOut ? "Signing out…" : "Sign out"}
                  </p>
                  <ChevronRight className="h-4 w-4 text-prestige-gold" strokeWidth={2} />
                </button>
              </li>
            </ul>
          </section>
        </div>

        {/* Storage rail */}
        <aside className="animate-rise h-fit rounded-2xl bg-prestige-deep p-6 text-prestige-cream lg:sticky lg:top-10 lg:p-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-gold">
            Offline storage
          </p>
          <p className="mt-4 font-display text-4xl">{formatMb(usedMb)}</p>
          <p className="text-xs text-prestige-cream/50">
            of {storageQuota.supported ? formatMb(storageQuota.quotaMb) : "device space"} used
          </p>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-prestige-cream/10">
            <div
              className={cn("h-full", storageLow ? "bg-destructive" : "bg-prestige-gold")}
              style={{ width: `${pct}%` }}
            />
          </div>
          {storageLow && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/15 p-3 text-[11px] text-prestige-cream">
              <TriangleAlert
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
                strokeWidth={1.75}
              />
              <p>
                Only {formatMb(storageQuota.availableMb)} of real device storage left.{" "}
                <Link to="/courses" className="gold-underline font-medium">
                  Remove some downloads
                </Link>{" "}
                to free up space before your next download.
              </p>
            </div>
          )}
          <div className="mt-6 grid grid-cols-2 gap-4 text-[11px]">
            {Object.entries(KIND_LABELS).map(([kind, label]) => (
              <div key={kind}>
                <p className="uppercase tracking-widest text-prestige-cream/50">{label}</p>
                <p className="mt-1 font-display text-base">{formatMb(byKind[kind] ?? 0)}</p>
              </div>
            ))}
            <div>
              <p className="uppercase tracking-widest text-prestige-cream/50">Summaries</p>
              <p className="mt-1 font-display text-base">{formatMb(summariesMb)}</p>
            </div>
            {otherMb > 0 && (
              <div>
                <p className="uppercase tracking-widest text-prestige-cream/50">Other</p>
                <p className="mt-1 font-display text-base">{formatMb(otherMb)}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </MobileShell>
  );
}
