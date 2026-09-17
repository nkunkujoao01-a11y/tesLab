// eLearn: self-service account deletion — a signed-in user permanently
// deleting their own account. Distinct from admin-server.ts's
// deleteUserAccount: that one requires the caller to be a super admin
// acting on someone else's account, verified via that caller's own
// profiles.is_super_admin. This function has no targetUserId at all — it
// only ever deletes the account the caller's own accessToken resolves to
// (via Supabase's own getUser(), never a client-passed id), so there is
// no privileged check to make and no path by which a client could use
// this to delete anyone but themselves.
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Typed locally rather than added to supabase.ts's shared Database type —
// same reasoning as admin-server.ts's identical comment: this is the only
// other place that ever writes to admin_audit_log.
type AdminAuditLogTable = {
  admin_audit_log: {
    Row: {
      id: string;
      actor_id: string;
      action: string;
      target_user_id: string | null;
      details: Record<string, unknown> | null;
      created_at: string;
    };
    Insert: {
      actor_id: string;
      action: string;
      target_user_id?: string | null;
      details?: Record<string, unknown> | null;
    };
    Update: never;
    Relationships: [];
  };
};

/** Resolves the accessToken to the real account it belongs to, server-side
 * — never trusts a client-passed id for who's being deleted. */
async function verifiedCallerId(accessToken: string): Promise<string | null> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY on the server");
    return null;
  }
  const userScopedClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const {
    data: { user: callerUser },
  } = await userScopedClient.auth.getUser(accessToken);
  return callerUser?.id ?? null;
}

function serviceRoleClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY on the server");
    return null;
  }
  return createClient(url, serviceRoleKey) as unknown as SupabaseClient<{
    public: {
      Tables: AdminAuditLogTable;
      Views: Record<string, never>;
      Functions: Record<string, never>;
    };
  }>;
}

type DeleteOwnAccountInput = { accessToken: string };
type DeleteOwnAccountResult = { ok: true } | { ok: false; reason: "not_authorized" | "unexpected" };

/** Cascades through the same `on delete cascade` FKs hanging off
 * profiles/auth.users that admin-server.ts's deleteUserAccount does —
 * irreversible, so the UI requires a typed confirmation before ever
 * calling this. */
export const deleteOwnAccount = createServerFn({ method: "POST" })
  .validator((data: DeleteOwnAccountInput) => data)
  .handler(async ({ data }): Promise<DeleteOwnAccountResult> => {
    const callerId = await verifiedCallerId(data.accessToken);
    if (!callerId) {
      return { ok: false, reason: "not_authorized" };
    }
    const admin = serviceRoleClient();
    if (!admin) return { ok: false, reason: "unexpected" };
    const { error } = await admin.auth.admin.deleteUser(callerId);
    if (error) {
      console.error("Failed to delete own account", error);
      return { ok: false, reason: "unexpected" };
    }
    // Best-effort — never lets a logging failure mask an already-completed
    // deletion, same discipline as admin-server.ts's recordAdminAction.
    const { error: auditError } = await admin
      .from("admin_audit_log")
      .insert({ actor_id: callerId, action: "self_delete_account", target_user_id: callerId });
    if (auditError) console.error("Failed to record self-delete audit log entry", auditError);
    return { ok: true };
  });
