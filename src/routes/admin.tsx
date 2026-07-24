import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AdminShell } from "@/components/AdminShell";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin console — eLearn" }],
  }),
  component: AdminLayout,
});

/** Gate applied once at the layout level — every /admin/* page inherits
 * it, rather than each page re-checking `profile.is_lecturer` the way the
 * old single-page /admin/catalog route had to (see Feature 59). Same
 * access model as before: a manual DB flag, not self-service. */
function AdminLayout() {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!profile?.is_lecturer) {
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
