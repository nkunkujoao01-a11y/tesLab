import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { GraduationCap, ShieldBan, ShieldCheck, Trash2, History } from "lucide-react";
import { formatRelative } from "@/lib/mock-data";
import { useUserDirectory, useAdminAuditLog, type AuditLogEntry } from "@/hooks/use-super-admin";

export const Route = createFileRoute("/admin/super/audit-log")({
  component: SuperAdminAuditLogPage,
});

const ACTION_META: Record<string, { label: string; icon: typeof History }> = {
  ban_user: { label: "Banned", icon: ShieldBan },
  unban_user: { label: "Unbanned", icon: ShieldCheck },
  delete_user: { label: "Deleted account", icon: Trash2 },
  set_lecturer_role: { label: "Changed lecturer access", icon: GraduationCap },
};

/** set_lecturer_role is the one action whose `details` actually changes
 * its own headline (granted vs. revoked) — every other action's own name
 * is already the full story. */
function describeAction(entry: AuditLogEntry): { label: string; icon: typeof History } {
  const meta = ACTION_META[entry.action] ?? { label: entry.action, icon: History };
  if (entry.action === "set_lecturer_role") {
    const granted = entry.details?.new_is_lecturer === true;
    return {
      label: granted ? "Granted lecturer access" : "Revoked lecturer access",
      icon: meta.icon,
    };
  }
  return meta;
}

/** Best-effort "who"/"whom" — actor_id/target_user_id are raw auth.users
 * ids (see 0044_admin_audit_log.sql's own comment on why there's no FK to
 * join against directly); this looks them up against the same directory
 * the User directory page already loads. A name that's since been deleted
 * (e.g. the actor's own account, or a target deleted in a later,
 * unrelated action) just falls back to a short id instead of blocking the
 * whole log on a missing lookup — the log's job is proving the action
 * happened, not that every account named in it still exists. */
function describePerson(
  userId: string | null,
  byId: Map<string, { fullName: string; email: string }>,
): string {
  if (!userId) return "—";
  const user = byId.get(userId);
  if (user) return user.fullName || user.email || userId.slice(0, 8);
  return `${userId.slice(0, 8)}… (account no longer listed)`;
}

function SuperAdminAuditLogPage() {
  const { users } = useUserDirectory();
  const { entries, loading } = useAdminAuditLog();

  const byId = useMemo(
    () => new Map(users.map((u) => [u.userId, { fullName: u.fullName, email: u.email }])),
    [users],
  );

  return (
    <div className="mx-auto max-w-[900px]">
      <p className="eyebrow">Super admin</p>
      <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-prestige-deep">
        Audit log
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every ban, unban, account deletion, and lecturer-access change taken from this console — the
        most recent 500. Granting super admin access itself isn't recorded here; it stays
        database-only and always has (see the User directory page).
      </p>

      <div className="animate-rise mt-5 overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
        {!loading && entries.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No admin actions recorded yet.
          </p>
        )}
        {entries.map((entry) => {
          const { label, icon: Icon } = describeAction(entry);
          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 border-b border-border/60 px-4 py-3.5 last:border-none"
            >
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-prestige-deep/5 text-prestige-mid">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground/90">
                  <span className="font-medium text-prestige-deep">
                    {describePerson(entry.actorId, byId)}
                  </span>{" "}
                  {label.charAt(0).toLowerCase() + label.slice(1)}
                  {entry.targetUserId && (
                    <>
                      {" "}
                      for{" "}
                      <span className="font-medium text-prestige-deep">
                        {describePerson(entry.targetUserId, byId)}
                      </span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  {formatRelative(entry.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {loading && <p className="mt-4 text-center text-xs text-muted-foreground">Loading…</p>}
    </div>
  );
}
