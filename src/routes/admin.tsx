import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AdminShell } from "@/components/AdminShell";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin console - eLearn" }],
  }),
  component: AdminLayout,
});

/** Gate applied once at the layout level — every /admin/* page inherits
 * it, rather than each page re-checking `profile.is_lecturer` the way the
 * old single-page /admin/catalog route had to (see Feature 59). Same
 * access model as before: a manual DB flag, not self-service.
 *
 * Security-audit hardening: waits for `profileVerified` (a genuine live
 * server fetch, not the offline/cold-start cache read — see use-auth.tsx)
 * before trusting `is_lecturer`/`is_super_admin` either way. A student
 * could edit their own cached profile in devtools IndexedDB to say
 * is_lecturer: true — that was already harmless (every real admin
 * read/write is independently RLS-enforced server-side regardless of
 * what this client thinks), but it could briefly flash the admin shell
 * UI before the real fetch corrected it. Requiring a verified fetch
 * first closes that off too, at the cost of admin access needing a live
 * connection at least once per session — reasonable, since this console
 * is inherently online-only anyway (managing shared catalog/student
 * data). */
function AdminLayout() {
  const { profile, profileVerified, loading } = useAuth();

  if (loading || !profileVerified) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!profile?.is_lecturer && !profile?.is_super_admin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <div className="max-w-[36ch] text-center">
          <p className="font-display text-lg font-medium text-prestige-deep">
            Lecturer access only
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account isn't set up to administer content. Ask whoever administers this project's
            database to enable it for you.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-prestige-deep px-4 py-2.5 text-xs font-semibold text-prestige-cream transition-transform active:scale-[0.97]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
