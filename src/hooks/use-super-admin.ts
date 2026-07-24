// Directory + role/ban/delete actions for the super admin console. See
// 0035_super_admin_role.sql/0037_super_admin_rpcs.sql for the RLS/RPC
// side this depends on.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setUserBanned, deleteUserAccount } from "@/lib/admin-server";

// Typed locally rather than added to supabase.ts's shared Database type —
// same reasoning as moodle-server.ts/ai-cloud.ts's identical comment:
// these two RPCs are only ever called from this one file.
type SuperAdminFunctions = {
  get_all_users_admin_info: {
    Args: Record<string, never>;
    Returns: {
      id: string;
      email: string | null;
      created_at: string;
      last_sign_in_at: string | null;
      banned_until: string | null;
    }[];
  };
  admin_set_lecturer_role: {
    Args: { target_user_id: string; new_is_lecturer: boolean };
    Returns: void;
  };
};
const rpcClient = supabase as unknown as SupabaseClient<{
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: SuperAdminFunctions;
  };
}>;

export type DirectoryUser = {
  userId: string;
  email: string;
  fullName: string;
  isLecturer: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  bannedUntil: string | null;
};

/** Merges get_all_users_admin_info() (auth.users info — email/last
 * sign-in/ban state, only ever real for an actual super admin, empty for
 * anyone else per that RPC's own is_super_admin() gate) with a plain
 * profiles select (already readable — a super admin passes is_lecturer()
 * too, see 0035) rather than duplicating profile fields inside the RPC.
 * Same by-id-map join shape use-moodle-course-match.ts already uses. */
export function useUserDirectory(): {
  users: DirectoryUser[];
  loading: boolean;
  refetch: () => void;
} {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      rpcClient.rpc("get_all_users_admin_info"),
      supabase.from("profiles").select("id, full_name, is_lecturer, is_super_admin"),
    ]).then(([authRes, profilesRes]) => {
      if (cancelled) return;
      if (authRes.error) console.error("Failed to load user directory", authRes.error);
      if (profilesRes.error)
        console.error("Failed to load profiles for directory", profilesRes.error);
      const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      setUsers(
        (authRes.data ?? []).map((u) => {
          const p = profileById.get(u.id);
          return {
            userId: u.id,
            email: u.email ?? "",
            fullName: p?.full_name ?? "Unknown",
            isLecturer: p?.is_lecturer ?? false,
            isSuperAdmin: p?.is_super_admin ?? false,
            createdAt: u.created_at,
            lastSignInAt: u.last_sign_in_at,
            bannedUntil: u.banned_until,
          };
        }),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { users, loading, refetch };
}

async function currentAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** The three account-lifecycle actions a super admin can take on another
 * account. No "grant super admin" action exists here — that stays
 * dashboard-only, deliberately (see 0037_super_admin_rpcs.sql's own
 * comment on admin_set_lecturer_role). */
export function useSuperAdminActions() {
  const [mutating, setMutating] = useState(false);

  const setLecturerRole = useCallback(async (targetUserId: string, newIsLecturer: boolean) => {
    setMutating(true);
    try {
      const { error } = await rpcClient.rpc("admin_set_lecturer_role", {
        target_user_id: targetUserId,
        new_is_lecturer: newIsLecturer,
      });
      if (error) {
        console.error("Failed to change lecturer role", error);
        toast.error("Couldn't update that account's lecturer access.");
        return false;
      }
      return true;
    } finally {
      setMutating(false);
    }
  }, []);

  const setBanned = useCallback(async (targetUserId: string, banned: boolean) => {
    setMutating(true);
    try {
      const accessToken = await currentAccessToken();
      if (!accessToken) {
        toast.error("Sign in again and retry.");
        return false;
      }
      const result = await setUserBanned({ data: { targetUserId, banned, accessToken } });
      if (!result.ok) {
        console.error("Failed to set ban state", result.reason);
        toast.error(banned ? "Couldn't ban that account." : "Couldn't unban that account.");
        return false;
      }
      return true;
    } finally {
      setMutating(false);
    }
  }, []);

  const deleteUser = useCallback(async (targetUserId: string) => {
    setMutating(true);
    try {
      const accessToken = await currentAccessToken();
      if (!accessToken) {
        toast.error("Sign in again and retry.");
        return false;
      }
      const result = await deleteUserAccount({ data: { targetUserId, accessToken } });
      if (!result.ok) {
        console.error("Failed to delete account", result.reason);
        toast.error("Couldn't delete that account.");
        return false;
      }
      return true;
    } finally {
      setMutating(false);
    }
  }, []);

  return { setLecturerRole, setBanned, deleteUser, mutating };
}
