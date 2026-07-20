// The admin console's own shell — a persistent sidebar, deliberately
// distinct from MobileShell's bottom-nav, editorial student-facing look.
// See DEV_LOG.md, Feature 59: this is a genuinely different tool for a
// different audience (a lecturer administering content, not a student
// reading it), styled with its own console-* tokens (styles.css) rather
// than the prestige-* ones everywhere else in this app.
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, BookOpen, Inbox } from "lucide-react";
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
  icon: typeof LayoutDashboard;
  label: string;
  count?: number;
  hot?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/admin" ? pathname === "/admin" : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-[13px] transition-colors ${
        active
          ? "border-console-border bg-console-surface-2 text-console-text"
          : "border-transparent text-console-text-dim hover:bg-console-surface hover:text-console-text"
      }`}
    >
      <Icon
        className={`h-[15px] w-[15px] shrink-0 ${active ? "text-console-accent" : "opacity-85"}`}
        strokeWidth={1.75}
      />
      {label}
      {typeof count === "number" && (
        <span
          className={`ml-auto rounded px-1.5 py-0.5 font-console-mono text-[10px] tabular-nums ${
            hot && count > 0
              ? "bg-console-accent/15 text-console-accent"
              : "bg-white/5 text-console-text-faint"
          }`}
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
    <div className="grid min-h-screen bg-console-bg font-console-sans text-console-text lg:grid-cols-[240px_1fr]">
      <aside className="hidden flex-col gap-7 border-r border-console-border bg-console-bg p-4 lg:flex">
        <div className="flex items-baseline gap-2 px-1.5">
          <span className="rounded border border-console-accent px-1 py-0.5 font-console-mono text-[11px] font-semibold tracking-widest text-console-accent">
            eL
          </span>
          <span className="font-console-mono text-[13px] text-console-text-dim">admin console</span>
        </div>

        <nav className="flex flex-col gap-4">
          <div>
            <p className="px-2.5 pb-1.5 font-console-mono text-[10px] uppercase tracking-widest text-console-text-faint">
              Console
            </p>
            <NavItem to="/admin" icon={LayoutDashboard} label="Overview" />
          </div>
          <div>
            <p className="px-2.5 pb-1.5 font-console-mono text-[10px] uppercase tracking-widest text-console-text-faint">
              Catalog
            </p>
            <div className="flex flex-col gap-0.5">
              <NavItem to="/admin/modules" icon={BookOpen} label="Modules" count={counts.modules} />
            </div>
          </div>
          <div>
            <p className="px-2.5 pb-1.5 font-console-mono text-[10px] uppercase tracking-widest text-console-text-faint">
              Students
            </p>
            <div className="flex flex-col gap-0.5">
              <NavItem
                to="/admin/feedback"
                icon={Inbox}
                label="Feedback inbox"
                count={counts.feedback}
                hot
              />
            </div>
          </div>
        </nav>

        <div className="mt-auto flex items-center gap-2.5 border-t border-console-border pt-2.5">
          <div className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded border border-console-border bg-console-surface-2 font-console-mono text-[11px] font-semibold text-console-accent">
            {initials}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs text-console-text">{fullName}</p>
            <p className="font-console-mono text-[10px] tracking-wide text-console-text-faint">
              LECTURER
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile top bar — the sidebar is desktop-only; a lecturer on a
          phone still gets real nav, just condensed, rather than nothing. */}
      <div className="flex items-center justify-between gap-3 border-b border-console-border px-4 py-3 lg:hidden">
        <span className="font-console-mono text-[13px] text-console-text-dim">admin console</span>
        <nav className="flex items-center gap-1">
          <NavItem to="/admin" icon={LayoutDashboard} label="" />
          <NavItem to="/admin/modules" icon={BookOpen} label="" />
          <NavItem to="/admin/feedback" icon={Inbox} label="" count={counts.feedback} hot />
        </nav>
      </div>

      <main className="min-w-0 px-6 py-7 lg:px-9 lg:py-8">{children}</main>
    </div>
  );
}
