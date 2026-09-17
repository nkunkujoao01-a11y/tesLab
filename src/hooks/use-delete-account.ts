import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getUserDb } from "@/lib/db";
import { deleteOwnAccount } from "@/lib/account-server";
import { useAuth } from "@/hooks/use-auth";

/** Self-service permanent account deletion (Settings > Account). Once the
 * server confirms the account itself is gone, this device's own local
 * copy of it is wiped and the local session dropped directly — not via
 * useAuth().signOut(), which revokes a session for an account that, by
 * this point, no longer exists to revoke a session against. A raw
 * localStorage clear follows as a fallback for the same reason
 * use-auth.tsx's readPersistedSupabaseUser reads that key directly: if
 * supabase.auth.signOut() itself fails (e.g. offline, or the now-invalid
 * token erroring the request), the persisted session must not survive to
 * resurrect a deleted account on the next load. */
export function useDeleteAccount() {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast.error("Sign in again and retry.");
        return false;
      }

      const result = await deleteOwnAccount({ data: { accessToken } });
      if (!result.ok) {
        console.error("Failed to delete account", result.reason);
        toast.error("Couldn't delete your account. Try again.");
        return false;
      }

      await getUserDb(user.id)
        .delete()
        .catch(() => {
          // Best-effort — the account is already gone server-side either way.
        });
      await supabase.auth.signOut().catch(() => {});
      try {
        const projectRef = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split(
          ".",
        )[0];
        localStorage.removeItem(`sb-${projectRef}-auth-token`);
      } catch {
        // Same never-throw discipline as this key's other reader/writer.
      }

      window.location.href = "/";
      return true;
    } finally {
      setDeleting(false);
    }
  }, [user]);

  return { deleteAccount, deleting };
}
