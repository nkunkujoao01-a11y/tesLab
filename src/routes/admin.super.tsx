import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/super")({
  head: () => ({
    meta: [{ title: "Super admin — eLearn" }],
  }),
  component: SuperAdminLayout,
});

/** A second, strictly narrower gate on top of admin.tsx's own — that
 * outer gate already ran and let this account into the shared /admin
 * shell (is_lecturer OR is_super_admin). This one checks is_super_admin
 * specifically, so an ordinary lecturer (is_super_admin literally false)
 * is correctly excluded even though they now satisfy is_lecturer() the
 * same way a super admin does (see 0035_super_admin_role.sql). Renders
 * inline rather than a full-screen takeover — this is already inside
 * AdminShell from the parent layout. */
function SuperAdminLayout() {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-[40vh]" />;
  }

  if (!profile?.is_super_admin) {
    return (
      <div className="mx-auto max-w-[560px] py-12 text-center">
        <p className="text-sm text-muted-foreground">
          This section is restricted to super admin accounts.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
