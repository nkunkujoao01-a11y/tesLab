import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  BookOpen,
  BarChart3,
  User,
  WifiOff,
  LogIn,
  TriangleAlert,
  Bot,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useStorageUsageMb } from "@/hooks/use-downloads";
import { useStorageQuota, isStorageLow } from "@/hooks/use-storage-quota";
import { useAuth } from "@/hooks/use-auth";
import { formatMb } from "@/lib/mock-data";
import { ShellSkeleton } from "@/components/Skeleton";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  match?: (path: string) => boolean;
};

// Summaries dropped from here (was its own bottom-nav slot) after
// real-device testing reported 6 items feeling cramped — it's reachable
// from Library now instead (see courses.index.tsx's own link card, same
// pattern "My documents" already used), since a summary is always
// generated from something opened in Library anyway.
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  {
    to: "/courses",
    label: "Library",
    icon: BookOpen,
    match: (p) => p.startsWith("/courses") || p === "/summaries",
  },
  { to: "/assistant", label: "Ask AI", icon: Bot },
  { to: "/progress", label: "Progress", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: User },
];

export function MobileShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isOnline = useOnlineStatus();
  const usedMb = useStorageUsageMb();
  const storageQuota = useStorageQuota(usedMb);
  const storagePct = storageQuota.supported
    ? Math.min(100, (usedMb / storageQuota.quotaMb) * 100)
    : 0;
  const storageLow = isStorageLow(storageQuota);
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <ShellSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-prestige-deep/5 text-prestige-mid">
          <LogIn className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 font-display text-xl font-medium text-prestige-deep">
          Sign in to continue
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
          Your downloads, summaries, and progress are waiting for you.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-5 py-2.5 text-sm font-medium text-prestige-cream transition-transform active:scale-[0.97]"
        >
          <LogIn className="h-4 w-4" strokeWidth={1.75} />
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-card/60 backdrop-blur-sm lg:flex">
        <div className="px-6 pt-10 pb-8">
          <Link to="/dashboard" className="block">
            <p className="eyebrow">Namibia University of Science and Technology</p>
            <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">
              eLearn
              <span className="ml-1 inline-block h-1.5 w-1.5 translate-y-[-6px] rounded-full bg-prestige-gold" />
            </h1>
          </Link>
        </div>
        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active = item.match ? item.match(path) : path === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-prestige-deep text-prestige-cream"
                        : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-prestige-gold" : "",
                      )}
                      strokeWidth={1.75}
                    />
                    <span>{item.label}</span>
                    {active && (
                      <span className="ml-auto h-1 w-1 rounded-full bg-prestige-gold" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-border/60 px-6 py-5">
          <p className="eyebrow">Offline library</p>
          <p className="mt-1 font-display text-sm text-foreground">
            {formatMb(usedMb)}{" "}
            <span className="text-muted-foreground">
              / {storageQuota.supported ? formatMb(storageQuota.quotaMb) : "device space"}
            </span>
          </p>
          {storageLow && (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-destructive">
              Device storage low
            </p>
          )}
          <div className="mt-2 h-0.5 w-full bg-prestige-deep/10">
            <div
              className={cn("h-full", storageLow ? "bg-destructive" : "bg-prestige-gold")}
              style={{ width: `${storagePct}%` }}
            />
          </div>
        </div>
      </aside>

      {/* Content column */}
      {/* w-full + lg:ml-64 (the fixed sidebar's width) without shrinking
       * the content itself adds up to 100% + 256px — real horizontal
       * overflow at every lg:+ breakpoint, found via an automated
       * viewport-size sweep (see DEV_LOG.md, Feature 24). lg:w-[calc(100%-16rem)]
       * reserves the sidebar's space instead of just offsetting into it. */}
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col pb-24 lg:ml-64 lg:w-[calc(100%-16rem)] lg:max-w-none lg:pb-0">
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-prestige-deep px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-prestige-cream">
            <WifiOff className="h-3.5 w-3.5 text-prestige-gold" strokeWidth={1.75} />
            Offline mode — showing downloaded content
          </div>
        )}
        {storageLow && (
          <Link
            to="/profile"
            className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-destructive-foreground"
          >
            <TriangleAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
            Low on device storage — {formatMb(storageQuota.availableMb)} left. Tap to review downloads.
          </Link>
        )}
        <main className="flex-1">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      {/* Text labels collide/run together below ~380px with too many items
       * (found via a real viewport sweep down to 320px, the budget-Android
       * width this app's own NFRs target — not assumed fine because it
       * looked ok at one desktop-resized-down width). Icon-only under that
       * breakpoint is the standard fix (same pattern as most mobile apps'
       * bottom navs) rather than shrinking text further, which would hurt
       * legibility instead of fixing the crowding. `aria-label` keeps the
       * icon-only rows accessible even though the visible text is hidden.
       * grid-cols-6 must match NAV.length — a real bug found when Summaries
       * was dropped from 6 items to 5 without updating this: the grid kept
       * reserving an empty extra column, so the real buttons stayed
       * squeezed into part of the row instead of actually spreading across
       * the full width, which is exactly what read as "too close together"
       * on a real device even after the item count changed. (Settings was
       * added back to 6 items — this comment's own history is the
       * reminder to check this again next time NAV's length changes.) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid max-w-[440px] grid-cols-6 gap-x-2 px-3 py-3 min-[380px]:gap-x-3 min-[380px]:px-5">
          {NAV.map((item) => {
            const active = item.match ? item.match(path) : path === item.to;
            return (
              <li key={item.to} className="flex justify-center">
                <Link
                  to={item.to}
                  aria-label={item.label}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-[0.94]",
                    active && "bg-prestige-deep/10",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-prestige-deep" : "text-prestige-deep/60",
                    )}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  <span
                    className={cn(
                      "hidden text-[9px] font-semibold uppercase tracking-widest min-[380px]:block",
                      active ? "text-prestige-deep" : "text-prestige-deep/60",
                    )}
                  >
                    {item.label}
                  </span>
                  {/* A color-only difference between active/inactive read as
                   * too subtle on a real device — this dot, plus the pill
                   * background and bolder icon stroke above, give three
                   * independent, unambiguous signals for which tab is
                   * active, not just one. */}
                  <span
                    className={cn(
                      "h-1 w-1 rounded-full transition-opacity",
                      active ? "bg-prestige-gold opacity-100" : "opacity-0",
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-6 pt-10 pb-6 lg:px-10 lg:pt-14">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-balance text-prestige-deep lg:text-3xl">
          {title}
        </h1>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="font-display text-sm font-semibold text-prestige-deep">
        {title}
      </h2>
      {action}
    </div>
  );
}
