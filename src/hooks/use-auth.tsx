import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, type ProfileRow } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  // Starts true (not false) because the very first render always has a
  // user to resolve or rule out — see the race this fixes, below.
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUser(data.session?.user ?? null);
        setSessionLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setSessionLoading(false);
      // "SIGNED_IN" fires only for a genuine new sign-in action (password,
      // Google OAuth, or the NUST student-number flow — all end in
      // signInWithPassword under the hood) — never for the page-load
      // restore of an already-existing session, which Supabase reports as
      // its own separate "INITIAL_SESSION" event. That distinction is
      // exactly why this is safe to fire here and won't happen every time
      // the app is merely reopened. Caps concurrent logins to one real
      // session per account: signing in on a new device signs this
      // account out everywhere else, rather than leaving an old session
      // (e.g. a lost or shared phone) silently valid indefinitely.
      if (event === "SIGNED_IN") {
        void supabase.auth.signOut({ scope: "others" }).catch((err) => {
          console.error("Failed to sign out other sessions", err);
        });
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Failed to load profile", error);
        setProfile(data ?? null);
        setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Supabase's session (and every downloaded model/document this app
  // caches offline) lives in localStorage/IndexedDB, which browsers are
  // free to evict under storage pressure — and, on iOS Safari specifically,
  // proactively clear entirely after 7 days with no top-level visit to the
  // site (Intelligent Tracking Prevention), the most likely real cause of
  // "got signed out just from being away a while" on iPhone. Requesting
  // persistent storage once a real session exists asks the browser to
  // exempt this origin from that eviction — best-effort only (the browser
  // can still refuse, e.g. if the user has never interacted with the site
  // enough to earn it), so this is a mitigation, not a guarantee, and
  // never blocks anything if the Storage API isn't available at all.
  useEffect(() => {
    if (!user) return;
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
    void navigator.storage.persist().catch(() => {
      // Silently ignored — a refusal here just means the existing eviction
      // risk is unchanged, not a new failure this app needs to surface.
    });
  }, [user]);

  // `loading` must stay true until the profile fetch also resolves — a
  // consumer like the /admin gate reads `!profile?.is_lecturer` the
  // instant `loading` flips, and profile fetching is a separate, later
  // effect keyed on `user`. Exposing only session-loading left a real
  // window where loading===false and profile===null, misreading a real
  // lecturer as not one until the profile request landed.
  const loading = sessionLoading || profileLoading;

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Marks the welcome tour (see WelcomeTour.tsx) as seen, once, forever —
  // updates local state immediately (the tour closes right away) and
  // persists to the profiles row, which already syncs across devices for
  // free (Feature 10), so a student who dismisses the tour on their phone
  // won't see it again on their laptop.
  const completeOnboarding = async () => {
    if (!user) return;
    const completedAt = new Date().toISOString();
    setProfile((prev) => (prev ? { ...prev, onboarding_completed_at: completedAt } : prev));
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed_at: completedAt })
      .eq("id", user.id);
    if (error) console.error("Failed to save onboarding completion", error);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
