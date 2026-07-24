// The admin console's own shell — a persistent sidebar (a lecturer
// administering content works differently from a student reading it, so
// the nav itself stays admin-specific), but restyled onto the exact same
// prestige-* design language and component shapes as MobileShell — same
// sidebar structure, same card/border/eyebrow conventions, same
// font-display headings — per explicit request: this used to be a
// deliberately distinct dark "developer console" look (its own former
// console-* token set, see DEV_LOG.md Feature 59), which read as a
// completely different, disconnected app from the student side.
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Inbox,
  ShieldCheck,
  UsersRound,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

type NavCounts = { modules: number; feedback: number };

function useNavCounts(): NavCounts {
  const [counts, setCounts] = useState<NavCounts>({ modules: 0, feedback: 0 });
  useEffect(() => {
    void (async () => {
      const [modulesRes, feedbackRes] = await Promise.all([
        supabase.from("modules").select("id", { count: "exact", head: true }),
        supabase.from("feedback").select("id", { count: "exact", head: true }),
      ]);
      setCounts({ modules: modulesRes.count ?? 0, feedback: feedbackRes.count ?? 0 });
    })();
  }, []);
  return counts;
}

function NavItem({
  to,
  icon: Icon,
  label,
  count,
  hot,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  hot?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/admin" ? pathname === "/admin" : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-prestige-deep text-prestige-cream"
          : "text-foreground/80 hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "text-prestige-gold")} strokeWidth={1.75} />
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active
              ? "bg-prestige-cream/15 text-prestige-cream"
              : hot && count > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const counts = useNavCounts();
  const fullName = profile?.full_name || "Lecturer";
  const initials = fullName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar — same fixed-width, same visual treatment as
          MobileShell's own (bg-card/60 backdrop-blur-sm), just its own
          nav items. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-card/60 backdrop-blur-sm lg:flex">
        <div className="px-6 pt-10 pb-8">
          <Link to="/admin" className="block">
            <p className="eyebrow">Namibia University of Science and Technology</p>
            <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">
              eLearn
              <span className="ml-1 inline-block h-1.5 w-1.5 translate-y-[-6px] rounded-full bg-prestige-gold" />
            </h1>
            <p className="mt-0.5 text-xs font-medium text-prestige-mid">Admin console</p>
          </Link>
        </div>

        <nav className="flex-1 space-y-6 px-3">
          <div>
            <p className="eyebrow px-3 pb-1.5">Console</p>
            <NavItem to="/admin" icon={LayoutDashboard} label="Overview" />
          </div>
          <div>
            <p className="eyebrow px-3 pb-1.5">Catalog</p>
            <div className="space-y-0.5">
              <NavItem to="/admin/modules" icon={BookOpen} label="Modules" count={counts.modules} />
            </div>
          </div>
          <div>
            <p className="eyebrow px-3 pb-1.5">Students</p>
            <div className="space-y-0.5">
              <NavItem
                to="/admin/feedback"
                icon={Inbox}
                label="Feedback inbox"
                count={counts.feedback}
                hot
              />
            </div>
          </div>
          {profile?.is_super_admin && (
            <div>
              <p className="eyebrow px-3 pb-1.5">Super admin</p>
              <div className="space-y-0.5">
                <NavItem to="/admin/super" icon={ShieldCheck} label="Overview" />
                <NavItem to="/admin/super/users" icon={UsersRound} label="User directory" />
                <NavItem to="/admin/super/research" icon={ClipboardList} label="Research data" />
              </div>
            </div>
          )}
        </nav>

        <div className="flex items-center gap-3 border-t border-border/60 px-6 py-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prestige-deep font-display text-xs font-semibold text-prestige-cream">
            {initials}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-prestige-deep">{fullName}</p>
            <p className="eyebrow">{profile?.is_super_admin ? "Super admin" : "Lecturer"}</p>
          </div>
        </div>
      </aside>

      {/* Mobile top bar — the sidebar is desktop-only; a lecturer on a
          phone still gets real nav, just condensed, rather than nothing. */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/60 px-4 py-3 backdrop-blur-sm lg:hidden">
        <div>
          <p className="font-display text-base font-medium tracking-tight text-prestige-deep">
            eLearn
          </p>
          <p className="text-[10px] font-medium text-prestige-mid">Admin console</p>
        </div>
        <nav className="flex items-center gap-1">
          <NavItem to="/admin" icon={LayoutDashboard} label="" />
          <NavItem to="/admin/modules" icon={BookOpen} label="" />
          <NavItem to="/admin/feedback" icon={Inbox} label="" count={counts.feedback} hot />
          {profile?.is_super_admin && (
            <>
              <NavItem to="/admin/super" icon={ShieldCheck} label="" />
              <NavItem to="/admin/super/users" icon={UsersRound} label="" />
              <NavItem to="/admin/super/research" icon={ClipboardList} label="" />
            </>
          )}
        </nav>
      </div>

      <main className="min-w-0 px-6 py-7 lg:ml-64 lg:px-9 lg:py-8">{children}</main>
    </div>
  );
}
