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

async function verifyCallerIsSuperAdmin(accessToken: string): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY on the server");
    return false;
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
  if (!callerUser) return false;
  const { data, error } = await userScopedClient
    .from("profiles")
    .select("is_super_admin")
    .eq("id", callerUser.id)
    .maybeSingle();
  if (error || !data) return false;
  return data.is_super_admin === true;
}

function serviceRoleClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY on the server");
    return null;
  }
  return createClient(url, serviceRoleKey);
}

type SetBannedInput = { targetUserId: string; banned: boolean; accessToken: string };
type SetBannedResult = { ok: true } | { ok: false; reason: "not_authorized" | "unexpected" };

/** "876000h" (~100 years) is the community-standard "effectively
 * permanent" ban duration for GoTrue, which has no true infinite
 * sentinel; "none" un-bans. */
export const setUserBanned = createServerFn({ method: "POST" })
  .validator((data: SetBannedInput) => data)
  .handler(async ({ data }): Promise<SetBannedResult> => {
    if (!(await verifyCallerIsSuperAdmin(data.accessToken))) {
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
    if (!(await verifyCallerIsSuperAdmin(data.accessToken))) {
      return { ok: false, reason: "not_authorized" };
    }
    const admin = serviceRoleClient();
    if (!admin) return { ok: false, reason: "unexpected" };
    const { error } = await admin.auth.admin.deleteUser(data.targetUserId);
    if (error) {
      console.error("Failed to delete user account", error);
      return { ok: false, reason: "unexpected" };
    }
    return { ok: true };
  });
