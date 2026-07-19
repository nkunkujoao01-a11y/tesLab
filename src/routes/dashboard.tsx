import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Download, CheckCircle2, Loader2 } from "lucide-react";
import { MobileShell, PageHeader, SectionHeader } from "@/components/MobileShell";
import { LibrarySearchButton } from "@/components/LibrarySearch";
import { formatMb } from "@/lib/mock-data";
import { fetchModules } from "@/lib/modules-api";
import {
  useDownloadModule,
  useDownloadedModuleIds,
  useStorageUsageMb,
} from "@/hooks/use-downloads";
import { useStorageQuota, type StorageQuota } from "@/hooks/use-storage-quota";
import {
  useSummariesGeneratedCount,
  useMostRecentlyReadModuleId,
  useReadMaterialIds,
  useStreakGrid,
  currentStreakDays,
  moduleCompletion,
} from "@/hooks/use-activity";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";

export const Route = createFileRoute("/dashboard")({
  loader: () => fetchModules(),
  head: () => ({
    meta: [
      { title: "Dashboard — eLearn" },
      {
        name: "description",
        content:
          "Your learning dashboard. Continue where you left off, download new material, and see progress across every module.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const modules = Route.useLoaderData();
  const { profile, user } = useAuth();
  const displayName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const initials = (profile?.full_name || user?.email || "?").slice(0, 2).toUpperCase();
  const downloadedIds = useDownloadedModuleIds();
  const { downloadModule, pendingIds } = useDownloadModule();
  const readMaterialIds = useReadMaterialIds();
  const isOnline = useOnlineStatus();

  // "Continuing now" — the module whose material was most recently opened,
  // falling back to the first module for a brand-new student with no
  // reading history yet.
  const recentModuleId = useMostRecentlyReadModuleId();
  const featured = modules.find((m) => m.id === recentModuleId) ?? modules[0];
  const featuredCompletion = moduleCompletion(featured.materials, featured.id, readMaterialIds);

  const pendingDownloads = modules
    .filter((m) => !downloadedIds.has(m.id))
    .map((m) => ({ id: m.id, title: m.title, chapter: m.chapter, sizeMb: m.sizeMb }));
  const modulesDownloadedCount = modules.filter((m) => downloadedIds.has(m.id)).length;
  const usedMb = useStorageUsageMb();
  const storageQuota = useStorageQuota(usedMb);
  const summariesGeneratedCount = useSummariesGeneratedCount();
  const streakGrid = useStreakGrid();
  const streakDays = currentStreakDays(streakGrid);

  return (
    <MobileShell>
      <PageHeader
        eyebrow="Academic dashboard"
        title={`Salute, ${displayName}`}
        action={
          <div className="flex items-center gap-2">
            <LibrarySearchButton
              modules={modules}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-border/70 text-prestige-mid transition-colors hover:text-prestige-deep lg:inline-flex"
            />
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-prestige-deep text-prestige-cream ring-2 ring-prestige-gold/25">
              <span className="font-display text-xs font-semibold">
                {initials}
              </span>
            </div>
          </div>
        }
      />

      <div className="grid gap-8 px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10 lg:px-10 lg:pb-16">
        <div className="min-w-0 space-y-8">
          {/* Stats */}
          <section className="animate-rise grid grid-cols-3 gap-3">
            <StatTile label="Modules" value={String(modulesDownloadedCount).padStart(2, "0")} />
            <StatTile label="Summaries" value={String(summariesGeneratedCount).padStart(2, "0")} />
            <StatTile label="Streak" value={String(streakDays).padStart(2, "0")} />
          </section>

          {/* Featured */}
          <section className="animate-rise">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-1 rounded-2xl border-t border-l border-prestige-gold/40" />
              <div className="relative overflow-hidden rounded-2xl bg-prestige-deep p-6 text-prestige-cream shadow-xl shadow-prestige-deep/20 lg:p-8">
                <div className="mb-10 flex items-start justify-between gap-6">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-prestige-gold">
                      Continuing now
                    </p>
                    <h3 className="font-display text-xl font-medium leading-tight text-balance lg:text-2xl">
                      {featured.title}
                    </h3>
                    <p className="text-xs text-prestige-cream/60">
                      {featured.chapter} · {featured.lecturer}
                    </p>
                  </div>
                  <Link
                    to="/courses/$moduleId"
                    params={{ moduleId: featured.id }}
                    aria-label="Resume module"
                    className="shrink-0 rounded-lg bg-prestige-gold p-2.5 text-prestige-deep transition-transform active:scale-[0.95]"
                  >
                    <Play className="h-4 w-4 fill-current" strokeWidth={2.5} />
                  </Link>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-medium">
                    <span className="text-prestige-cream/60">
                      Materials opened · {featuredCompletion.opened}/{featuredCompletion.total}
                    </span>
                    <span>{Math.round(featuredCompletion.pct * 100)}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-prestige-cream/10">
                    <div
                      className="h-full bg-prestige-gold"
                      style={{ width: `${featuredCompletion.pct * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Available offline */}
          <section className="animate-rise">
            <SectionHeader
              title="Available offline"
              action={
                <Link
                  to="/courses"
                  className="gold-underline text-xs font-medium text-prestige-mid hover:text-prestige-deep"
                >
                  Manage library
                </Link>
              }
            />
            <ul className="space-y-3">
              {pendingDownloads.slice(0, 3).map((item) => {
                const isPending = pendingIds.has(item.id);
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-4 rounded-xl bg-card/60 p-3 ring-1 ring-border/60 transition-colors hover:bg-card"
                  >
                    {/* The row's clickable area (icon/title) and the "Get"
                     * button are siblings, not nested — a <button> inside
                     * a <Link> is invalid HTML that hides the button from
                     * the accessibility tree (see DEV_LOG.md, Feature 18).
                     * The old version relied on preventDefault/
                     * stopPropagation on the button to fake independence;
                     * this way it's structurally independent. */}
                    <Link
                      to="/courses/$moduleId"
                      params={{ moduleId: item.id }}
                      className="flex min-w-0 flex-1 items-center gap-4"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                        <Download className="h-4 w-4" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-prestige-deep">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-prestige-mid">
                          {item.chapter} · {formatMb(item.sizeMb)}
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      disabled={isPending || !isOnline}
                      aria-disabled={!isOnline}
                      aria-label={`Download ${item.title}`}
                      title={!isOnline ? "You're offline — reconnect to download" : undefined}
                      onClick={() => void downloadModule(item.id, item.sizeMb)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-xs font-medium ring-1 ring-border/70 transition-all hover:bg-secondary active:scale-[0.95] disabled:opacity-40 disabled:active:scale-100"
                    >
                      {isPending && <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} />}
                      {!isOnline ? "Offline" : isPending ? "Getting…" : "Get"}
                    </button>
                  </li>
                );
              })}
              {pendingDownloads.length === 0 && (
                <li className="rounded-xl bg-card/60 p-4 text-center ring-1 ring-border/60">
                  <p className="inline-flex items-center gap-2 text-xs font-medium text-prestige-mid">
                    <CheckCircle2 className="h-3.5 w-3.5 text-prestige-gold" strokeWidth={2} />
                    Everything is available offline
                  </p>
                </li>
              )}
            </ul>
          </section>

          {/* Storage — mobile only, desktop uses rail */}
          <section className="lg:hidden">
            <StorageBar usedMb={usedMb} quota={storageQuota} />
          </section>
        </div>

        {/* Desktop side rail */}
        <aside className="hidden lg:sticky lg:top-10 lg:block lg:h-fit lg:space-y-6">
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border/60">
            <p className="eyebrow">Recent modules</p>
            <ul className="mt-4 space-y-3">
              {modules.slice(0, 4).map((m) => {
                const completion = moduleCompletion(m.materials, m.id, readMaterialIds);
                return (
                  <li key={m.id}>
                    <Link
                      to="/courses/$moduleId"
                      params={{ moduleId: m.id }}
                      className="block"
                    >
                      <p className="text-xs uppercase tracking-widest text-prestige-deep/85">
                        {m.code}
                      </p>
                      <p className="mt-0.5 truncate font-display text-sm font-medium text-prestige-deep">
                        {m.title}
                      </p>
                      <div className="mt-2 h-0.5 w-full bg-prestige-deep/10">
                        <div
                          className="h-full bg-prestige-gold"
                          style={{ width: `${completion.pct * 100}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-2xl bg-prestige-deep p-6 text-prestige-cream">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-prestige-gold">
              Offline storage
            </p>
            <p className="mt-2 font-display text-2xl">
              {formatMb(usedMb)}
              <span className="text-sm text-prestige-cream/50">
                {" "}
                / {storageQuota.supported ? formatMb(storageQuota.quotaMb) : "device space"}
              </span>
            </p>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-prestige-cream/10">
              <div
                className="h-full bg-prestige-gold"
                style={{
                  width: `${storageQuota.supported ? Math.min(100, (usedMb / storageQuota.quotaMb) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </MobileShell>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-prestige-deep/[0.04] p-4 ring-1 ring-black/[0.04]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-prestige-mid">
        {label}
      </span>
      <span className="font-display text-xl font-medium text-prestige-deep">
        {value}
      </span>
    </div>
  );
}

function StorageBar({ usedMb, quota }: { usedMb: number; quota: StorageQuota }) {
  const pct = quota.supported ? Math.min(100, (usedMb / quota.quotaMb) * 100) : 0;
  return (
    <div className="mt-2 border-t border-border/60 pt-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-prestige-mid">
          Offline storage
        </span>
        <span className="text-[10px] text-prestige-mid">
          {formatMb(usedMb)} / {quota.supported ? formatMb(quota.quotaMb) : "device space"}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-prestige-deep/[0.06]">
        <div className="h-full bg-prestige-gold/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
