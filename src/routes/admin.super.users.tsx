import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GraduationCap, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import { formatRelative } from "@/lib/mock-data";
import {
  useUserDirectory,
  useSuperAdminActions,
  type DirectoryUser,
} from "@/hooks/use-super-admin";
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

export const Route = createFileRoute("/admin/super/users")({
  component: SuperAdminUsersPage,
});

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-prestige-deep/20 focus:ring-2";

function UserRow({
  user,
  onSetLecturer,
  onSetBanned,
  onDelete,
  mutating,
}: {
  user: DirectoryUser;
  onSetLecturer: (next: boolean) => void;
  onSetBanned: (next: boolean) => void;
  onDelete: () => void;
  mutating: boolean;
}) {
  const banned = !!user.bannedUntil && new Date(user.bannedUntil).getTime() > Date.now();

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 last:border-none">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-prestige-deep">
          {user.fullName}
          {user.isSuperAdmin && (
            <span className="ml-1.5 rounded-full bg-prestige-gold/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-prestige-mid">
              Super admin
            </span>
          )}
          {banned && (
            <span className="ml-1.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-destructive">
              Banned
            </span>
          )}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
        <p className="mt-0.5 text-[10.5px] text-muted-foreground">
          Last signed in {user.lastSignInAt ? formatRelative(user.lastSignInAt) : "never"} · joined{" "}
          {formatRelative(user.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          disabled={mutating || user.isSuperAdmin}
          onClick={() => onSetLecturer(!user.isLecturer)}
          title={user.isSuperAdmin ? "Super admins already have full access" : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.75} />
          {user.isLecturer ? "Revoke lecturer" : "Make lecturer"}
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={mutating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <ShieldBan className="h-3.5 w-3.5" strokeWidth={1.75} />
              {banned ? "Unban" : "Ban"}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {banned ? "Unban" : "Ban"} {user.fullName}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {banned
                  ? "This restores their ability to sign in."
                  : "This immediately blocks their account from signing in or refreshing an existing session. Reversible — you can unban them at any time."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onSetBanned(!banned)}>
                {banned ? "Unban" : "Ban"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={mutating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Delete
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {user.fullName}'s account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes their account, profile, and everything linked to it —
                materials read, grades, feedback, messages. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function SuperAdminUsersPage() {
  const { users, loading, refetch } = useUserDirectory();
  const { setLecturerRole, setBanned, deleteUser, mutating } = useSuperAdminActions();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <div className="mx-auto max-w-[900px]">
      <p className="eyebrow">Super admin</p>
      <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-prestige-deep">
        User directory
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {users.length} account{users.length === 1 ? "" : "s"}. Granting super admin access itself
        stays database-only — there's no in-app control for that.
      </p>

      <div className="mt-5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className={FIELD_CLASS}
        />
      </div>

      <div className="animate-rise mt-5 overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
        {!loading && filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            {users.length === 0 ? "No accounts found." : "No accounts match that search."}
          </p>
        )}
        {filtered.map((user) => (
          <UserRow
            key={user.userId}
            user={user}
            mutating={mutating}
            onSetLecturer={async (next) => {
              if (await setLecturerRole(user.userId, next)) refetch();
            }}
            onSetBanned={async (next) => {
              if (await setBanned(user.userId, next)) refetch();
            }}
            onDelete={async () => {
              if (await deleteUser(user.userId)) refetch();
            }}
          />
        ))}
      </div>

      {loading && <p className="mt-4 text-center text-xs text-muted-foreground">Loading…</p>}
    </div>
  );
}
