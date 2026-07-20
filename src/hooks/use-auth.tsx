import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSessionLoading(false);
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
