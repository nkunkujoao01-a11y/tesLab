// eLearn: server-only privileged auth-admin actions for the super admin
// console. Ban/unban and delete go through the real Supabase Admin API
// (not raw SQL against auth.users) — the properly-supported,
// transactionally-correct path; a raw delete could leave orphaned rows in
// other auth.* tables Supabase manages internally that aren't part of
// this app's own FK graph. Structured identically to moodle-server.ts:
// every handler here takes the caller's own accessToken, verifies the
// caller's own profiles.is_super_admin via a user-scoped anon-key client
// — never trust a client-passed boolean — and only then builds a
// service-role client to perform the privileged action. This check is the
// real authorization boundary: a hostile client could otherwise call
// these functions directly with an arbitrary targetUserId.
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Typed locally rather than added to supabase.ts's shared Database type —
// same reasoning as moodle-server.ts's identical comment: this is the
// only place that ever needs is_super_admin read back this way.
type ProfilesTable = {
  profiles: {
    Row: { id: string; is_super_admin: boolean };
    Insert: never;
    Update: never;
    Relationships: [];
  };
};

// Typed locally for the same reason as ProfilesTable above — see
// 0044_admin_audit_log.sql's own comment for why this table has no
// client grants at all (service-role inserts only) and no FK on
// actor_id/target_user_id.
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

/** Verifies the caller's own token asserts a real, current super admin —
 * never trust a client-passed boolean — and returns the caller's own id
 * alongside that verdict so the audit-log insert below can record who
 * actually took the action, not just that "a" super admin did. */
async function verifyCallerIsSuperAdmin(
  accessToken: string,
): Promise<{ authorized: boolean; callerId: string | null }> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY on the server");
    return { authorized: false, callerId: null };
  }
  const userScopedClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  }) as unknown as SupabaseClient<{
    public: {
      Tables: ProfilesTable;
      Views: Record<string, never>;
      Functions: Record<string, never>;
    };
  }>;
  const {
    data: { user: callerUser },
  } = await userScopedClient.auth.getUser(accessToken);
  if (!callerUser) return { authorized: false, callerId: null };
  const { data, error } = await userScopedClient
    .from("profiles")
    .select("is_super_admin")
    .eq("id", callerUser.id)
    .maybeSingle();
  if (error || !data) return { authorized: false, callerId: callerUser.id };
  return { authorized: data.is_super_admin === true, callerId: callerUser.id };
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

/** Best-effort audit insert after a privileged action already succeeded —
 * see 0044_admin_audit_log.sql. Never lets a logging failure undo or mask
 * an already-completed ban/delete; only logged, same degrade-gracefully
 * discipline as the rest of this file (and moodle-server.ts). */
async function recordAdminAction(
  admin: NonNullable<ReturnType<typeof serviceRoleClient>>,
  actorId: string,
  action: string,
  targetUserId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin
    .from("admin_audit_log")
    .insert({ actor_id: actorId, action, target_user_id: targetUserId, details });
  if (error) console.error("Failed to record admin audit log entry", error);
}

type SetBannedInput = { targetUserId: string; banned: boolean; accessToken: string };
type SetBannedResult = { ok: true } | { ok: false; reason: "not_authorized" | "unexpected" };

/** "876000h" (~100 years) is the community-standard "effectively
 * permanent" ban duration for GoTrue, which has no true infinite
 * sentinel; "none" un-bans. */
export const setUserBanned = createServerFn({ method: "POST" })
  .validator((data: SetBannedInput) => data)
  .handler(async ({ data }): Promise<SetBannedResult> => {
    const { authorized, callerId } = await verifyCallerIsSuperAdmin(data.accessToken);
    if (!authorized || !callerId) {
      return { ok: false, reason: "not_authorized" };
    }
    const admin = serviceRoleClient();
    if (!admin) return { ok: false, reason: "unexpected" };
    const { error } = await admin.auth.admin.updateUserById(data.targetUserId, {
      ban_duration: data.banned ? "876000h" : "none",
    });
    if (error) {
      console.error("Failed to set user ban state", error);
      return { ok: false, reason: "unexpected" };
    }
    // Awaited, not fire-and-forget — a serverless invocation can be torn
    // down the instant the response is sent, which would silently drop an
    // un-awaited insert.
    await recordAdminAction(
      admin,
      callerId,
      data.banned ? "ban_user" : "unban_user",
      data.targetUserId,
    );
    return { ok: true };
  });

type DeleteUserInput = { targetUserId: string; accessToken: string };
type DeleteUserResult = { ok: true } | { ok: false; reason: "not_authorized" | "unexpected" };

/** Cascades through the existing `on delete cascade` FKs hanging off
 * profiles/auth.users — irreversible, so the UI confirms before ever
 * calling this. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .validator((data: DeleteUserInput) => data)
  .handler(async ({ data }): Promise<DeleteUserResult> => {
    const { authorized, callerId } = await verifyCallerIsSuperAdmin(data.accessToken);
    if (!authorized || !callerId) {
      return { ok: false, reason: "not_authorized" };
    }
    const admin = serviceRoleClient();
    if (!admin) return { ok: false, reason: "unexpected" };
    const { error } = await admin.auth.admin.deleteUser(data.targetUserId);
    if (error) {
      console.error("Failed to delete user account", error);
      return { ok: false, reason: "unexpected" };
    }
    await recordAdminAction(admin, callerId, "delete_user", data.targetUserId);
    return { ok: true };
  });
