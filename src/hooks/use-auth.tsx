import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase, type ProfileRow } from "@/lib/supabase";
import { getUserDb } from "@/lib/db";
import { withTimeout } from "@/lib/with-timeout";

// Bug found from a user report: switching tabs (or just backgrounding and
// re-foregrounding the app) caused a full-screen skeleton flash every
// time, online or offline — and offline, closing and reopening the app
// left it stuck on that skeleton forever. Root cause: @supabase/auth-js
// attaches its own internal `visibilitychange` listener (not app code)
// that fires a token-refresh attempt on every tab-focus event. That
// refresh re-invokes onAuthStateChange below with a freshly-deserialized
// (but same-user) session object every time — a new `User` object
// reference even though the actual signed-in user hasn't changed. The
// profile-fetch effect further down used to depend on that whole `user`
// object, so it re-ran on every one of those events, resetting
// profileLoading to true with no timeout and no offline fallback —
// MobileShell.tsx reads `loading` (sessionLoading || profileLoading) to
// decide whether to blank the screen to <ShellSkeleton />, so this both
// flashed the skeleton on every tab switch and, offline (where the fetch
// never resolved), left it stuck forever. Fixed below by keying the
// profile effect on the stable `userId` string instead of the `user`
// object, adding a timeout, and treating a fetch failure as "keep
// whatever we already have" instead of "hang".
const PROFILE_CACHE_KEY = "cachedProfile";

function readCachedProfile(raw: unknown, userId: string): ProfileRow | null {
  try {
    if (!raw || typeof raw !== "object" || !("value" in raw)) return null;
    const value = (raw as { value: unknown }).value;
    if (typeof value !== "string") return null;
    const parsed = JSON.parse(value) as ProfileRow | null;
    if (parsed && typeof parsed === "object" && parsed.id === userId) return parsed;
    return null;
  } catch {
    // Same "never trust it, just fall through" defensiveness as
    // readPersistedSupabaseUser below — a malformed cache entry should
    // never be able to throw or misbehave, only be ignored.
    return null;
  }
}

// Real bug found from a user report: "sometimes, since I was offline, I
// have to sign in again." Root cause, confirmed by reading
// @supabase/auth-js's own source (v2.110.7): its internal __loadSession()
// (what supabase.auth.getSession() below calls) reactively tries to
// refresh the access token once it's *actually* expired (not just inside
// the 90s proactive-refresh margin) — and if that refresh attempt fails
// for *any* reason, including a plain offline network error, it returns
// `{ session: null }` to the caller. Critically, it does NOT clear the
// persisted session in storage on that path (confirmed: only a
// non-retryable/non-network auth error does that) — so a perfectly valid,
// still-refreshable session sits untouched in localStorage while
// getSession() insists there isn't one. This only bites a *fresh* mount
// (a reopened tab/app, not one that's stayed open) where the real token
// expiry (commonly ~1hr) has already passed during an offline stretch —
// exactly the "sometimes" in the report, not "every time."
// There's no supported supabase-js option to ask getSession() to skip the
// refresh attempt, so this reads the same storage key supabase-js itself
// writes to, directly, as a deliberately best-effort fallback used only
// when offline and getSession() reported nothing — never trusted for
// anything security-relevant (the server's own RLS/JWT validation is the
// real authority regardless of what this client-side value shows), and
// wrapped so any wrong assumption about the storage format just falls
// through to the existing (safe) "show sign-in" behavior rather than
// throwing.
function readPersistedSupabaseUser(): User | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const projectRef = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "user" in parsed) {
      return (parsed as { user: User }).user ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

type AuthContextValue = {
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  // True only once `profile` has been confirmed by a live server fetch
  // this mount — false while it's still the optimistic offline/cold-start
  // cache read (see the profile effect below). A locally-cached profile
  // lives in this device's own IndexedDB, editable via devtools like any
  // client-side storage — never trust it for anything privilege-gating
  // (e.g. is_lecturer/is_super_admin-based UI access); wait for this flag
  // instead. The actual data/write access is always independently
  // enforced server-side via RLS regardless of this flag, so this only
  // protects against a *client UI* briefly showing admin-shaped screens
  // to someone who tampered with their own cache — never real data.
  profileVerified: boolean;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileVerified, setProfileVerified] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  // Starts true (not false) because the very first render always has a
  // user to resolve or rule out — see the race this fixes, below.
  const [profileLoading, setProfileLoading] = useState(true);

  // Stable primitive, not the `user` object — see the profile effect's
  // dependency array below for why that distinction is the actual fix.
  const userId = user?.id ?? null;
  // Which user's profile is currently loaded (in `profile` state), so the
  // effect can tell "we already have this exact user's profile, don't
  // reset to loading" apart from "this is a genuinely different user,
  // clear the stale one first".
  const loadedProfileForUserIdRef = useRef<string | null>(null);
  // Whether this mount has ever shown a real signed-in user — combined
  // with hadPersistedTokenAtMount (captured inside the effect below) to
  // gate the "session timed out" message so it only fires for an actual
  // loss of a real session, never for a plain "not signed in yet" page
  // load with no token in storage at all.
  const hadConfirmedUserRef = useRef(false);
  // Set right before calling supabase.auth.signOut() below, so the
  // resulting SIGNED_OUT event is recognized as user-initiated rather
  // than a real timeout — see resolveSession's own comment.
  const explicitSignOutRef = useRef(false);

  // Security-audit follow-up bug (real, found by re-reading this file
  // against @supabase/auth-js's actual source, not just its docs): the
  // offline-persisted-user fallback above was only ever applied to the
  // ONE-TIME getSession() check below — but supabase-js's own
  // onAuthStateChange() subscription independently re-runs the exact same
  // __loadSession() logic to emit its own "INITIAL_SESSION" event shortly
  // after subscribing, AND fires again on every later background
  // token-refresh attempt (see this file's very first comment — that's
  // the visibilitychange-triggered refresh). Every one of those firings
  // used to call setUser(session?.user ?? null) unconditionally, with no
  // fallback — so a null session from EITHER of those (not just the
  // initial getSession() call) could silently undo the fallback the
  // moment it was applied (a race at mount), or sign someone out mid-tab
  // for a background refresh that failed only because they were offline,
  // with the token happening to expire while the tab stayed open. This is
  // the actual mechanism behind "sometimes get logged out for no reason".
  // Fixed by routing every place a session can resolve to `null` through
  // the same resolveSession() logic below, so the offline-fallback and
  // "explicit sign-out always wins" rules apply everywhere consistently,
  // not just on the very first check.
  useEffect(() => {
    let cancelled = false;
    // Captured once, synchronously, before any async resolution and
    // before supabase-js has a chance to clear storage on a genuinely
    // invalid/expired token (it only clears storage for that specific
    // case, per readPersistedSupabaseUser's own comment) — this is what
    // lets the "timed out" message correctly fire even on a brand-new
    // page load/reload (not just mid-session), the single most common
    // real version of this: closing the laptop for a while and reopening
    // it later to a token that's now genuinely expired. Without this, a
    // fresh mount's hadConfirmedUserRef always starts false, which would
    // wrongly suppress the message for exactly that case.
    const hadPersistedTokenAtMount = readPersistedSupabaseUser() !== null;

    function resolveSession(session: Session | null, isExplicitSignOut: boolean) {
      if (cancelled) return;

      if (session) {
        hadConfirmedUserRef.current = true;
        setUser(session.user);
        setSessionLoading(false);
        return;
      }

      // A real "Sign out" button click (see signOut() below, which sets
      // this flag right before calling supabase.auth.signOut()) always
      // wins — never second-guessed with a stale offline fallback, and
      // never shown as a "timed out" message (the user knows why).
      if (isExplicitSignOut) {
        explicitSignOutRef.current = false;
        setUser(null);
        setSessionLoading(false);
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // See readPersistedSupabaseUser's own comment — don't force a
        // sign-in screen for what's very likely just a failed background
        // token refresh while offline, not a real sign-out.
        const persistedUser = readPersistedSupabaseUser();
        if (persistedUser) {
          setUser(persistedUser);
          setSessionLoading(false);
          return;
        }
      }

      // A real, network-confirmed loss of session (online, or offline
      // with nothing persisted to fall back to) — not an offline
      // artifact. Only surface the "timed out" message if there was a
      // real session to lose: either this mount already showed
      // signed-in content, or storage held a token when this mount
      // started (a fresh page load onto an already-expired token — the
      // most common real version of this). A plain "never signed in at
      // all" page load (no token ever existed) is not a timeout.
      if (hadConfirmedUserRef.current || hadPersistedTokenAtMount) {
        toast.error("Your session has timed out. Please log in again.");
      }
      setUser(null);
      setSessionLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => resolveSession(data.session, false));

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      resolveSession(session, event === "SIGNED_OUT" && explicitSignOutRef.current);
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
    if (!userId) {
      loadedProfileForUserIdRef.current = null;
      setProfile(null);
      setProfileVerified(false);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    const alreadyHaveThisUsersProfile = loadedProfileForUserIdRef.current === userId;

    if (!alreadyHaveThisUsersProfile) {
      // A genuine account switch (sign out A, sign in as B) — never show
      // B even a flash of A's cached name/avatar/role.
      if (loadedProfileForUserIdRef.current !== null) setProfile(null);
      setProfileVerified(false);
      setProfileLoading(true);

      // Cold-start-while-offline: this render has no in-memory profile
      // for this user at all (e.g. the app was just reopened). Race an
      // optimistic read of the last profile we successfully cached for
      // this account against the live network fetch below — if the cache
      // wins (network is slow/offline), use it immediately instead of
      // leaving the skeleton up for the full timeout with nothing to show.
      void getUserDb(userId)
        .syncMeta.get(PROFILE_CACHE_KEY)
        .then((raw) => {
          if (cancelled) return;
          // The network fetch already won — don't clobber fresher data
          // with a possibly-stale cached copy.
          if (loadedProfileForUserIdRef.current === userId) return;
          const cached = readCachedProfile(raw, userId);
          if (cached) {
            setProfile(cached);
            setProfileLoading(false);
          }
        })
        .catch(() => {
          // IndexedDB unavailable/blocked — just fall through to the
          // network-only path below, same as a cache miss.
        });
    }
    // else: we already have this exact user's profile loaded (e.g. a
    // duplicate effect run from tab-switch-triggered session churn, now
    // that `userId` — not `user` — is the dependency, this should only
    // happen on a genuine remount). Keep showing it and refresh silently
    // in the background instead of blanking the screen to a skeleton.

    withTimeout(supabase.from("profiles").select("*").eq("id", userId).maybeSingle())
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load profile", error);
          return;
        }
        if (data) {
          setProfile(data);
          // Only a genuine live fetch flips this — never the optimistic
          // cache read above, so a tampered local cache can never make
          // profileVerified true.
          setProfileVerified(true);
          loadedProfileForUserIdRef.current = userId;
          void getUserDb(userId)
            .syncMeta.put({ key: PROFILE_CACHE_KEY, value: JSON.stringify(data) })
            .catch(() => {
              // Best-effort cache write — a failure here just means the
              // next cold offline start won't have it, not a live bug.
            });
        }
      })
      .catch((err: unknown) => {
        // Offline, timed out, or a real network error. Deliberately does
        // NOT clear `profile` (keep whatever we already had, stale is
        // better than blank) and does not leave loading stuck — see the
        // `finally` below.
        console.error("Failed to load profile", err);
      })
      .finally(() => {
        if (cancelled) return;
        setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

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
    if (!userId) return;
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
    void navigator.storage.persist().catch(() => {
      // Silently ignored — a refusal here just means the existing eviction
      // risk is unchanged, not a new failure this app needs to surface.
    });
  }, [userId]);

  // `loading` must stay true until the profile fetch also resolves — a
  // consumer like the /admin gate reads `!profile?.is_lecturer` the
  // instant `loading` flips, and profile fetching is a separate, later
  // effect keyed on `userId`. Exposing only session-loading left a real
  // window where loading===false and profile===null, misreading a real
  // lecturer as not one until the profile request landed.
  const loading = sessionLoading || profileLoading;

  const signOut = async () => {
    explicitSignOutRef.current = true;
    try {
      // supabase-js's own signOut() notifies onAuthStateChange
      // subscribers with the SIGNED_OUT event (and awaits that) before
      // this resolves, so resolveSession's own reset of the flag above
      // always runs first in the success path — this try/catch only
      // exists as a safety net for the flag's lifetime if signOut()
      // itself throws before ever reaching that point (e.g. some
      // pre-flight error), so it can never get stuck true and wrongly
      // suppress a real future "timed out" message.
      await supabase.auth.signOut();
    } catch (err) {
      explicitSignOutRef.current = false;
      throw err;
    }
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
    <AuthContext.Provider
      value={{ user, profile, profileVerified, loading, signOut, completeOnboarding }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
