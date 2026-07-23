import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GoogleGlyph } from "@/components/GoogleGlyph";
import { supabase } from "@/lib/supabase";
import { loginWithNust } from "@/lib/moodle-cloud";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — eLearn" },
      { name: "description", content: "Sign in to your eLearn account." },
    ],
  }),
  component: Login,
});

// A plain "@" check is enough here — it only decides which of the two
// real login paths to try, not whether the value is a well-formed email;
// each path's own backend (Supabase auth / Moodle's login/token.php)
// already validates the actual credential, and a false-positive either
// way just surfaces as that path's own normal "invalid credentials"
// error rather than silently doing the wrong thing.
function looksLikeEmail(identifier: string): boolean {
  return identifier.includes("@");
}

function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmed = identifier.trim();
    if (looksLikeEmail(trimmed)) {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      void navigate({ to: "/dashboard" });
      return;
    }

    // Anything without an "@" is treated as a NUST student number — see
    // loginWithNust (moodle-cloud.ts) for the full flow: it verifies
    // against Moodle itself, then signs this browser into a matching
    // eLearn account (created automatically on first login) with the
    // real NUST courses already linked, no separate Settings step.
    const result = await loginWithNust(trimmed, password);
    setLoading(false);
    if (!result.signedIn) {
      setError(
        result.reason === "invalid_credentials"
          ? "Those NUST eLearning credentials weren't accepted. Check your student number and password."
          : "Couldn't sign in right now. Try again in a moment.",
      );
      return;
    }
    void navigate({ to: "/dashboard" });
  };

  // Redirects out to Google and back — the page reloads on return, so
  // there's no "reset loading" step here; a stuck spinner on this specific
  // click would mean the redirect itself never fired, which the error
  // branch below already surfaces.
  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col justify-center px-6 py-12 lg:max-w-[420px]">
        <div>
          <p className="eyebrow">Namibia University of Science and Technology</p>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">
            eLearn
            <span className="ml-1 inline-block h-1.5 w-1.5 translate-y-[-6px] rounded-full bg-prestige-gold" />
          </h1>
        </div>

        <h2 className="mt-10 font-display text-3xl font-medium leading-[1.15] tracking-tight text-balance text-prestige-deep">
          Welcome back.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to continue where you left off.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="identifier" className="text-xs font-medium text-prestige-mid">
              Email or NUST student number
            </label>
            <Input
              id="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder="you@example.com or 223068209"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-prestige-mid">
              Password
            </label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-lg"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-prestige-deep px-5 py-3 text-sm font-medium text-prestige-cream shadow-lg shadow-prestige-deep/20 transition-transform active:scale-[0.97] disabled:opacity-60"
          >
            <span>{loading ? "Signing in…" : "Sign in"}</span>
            {!loading && (
              <ChevronRight
                className="h-4 w-4 text-prestige-gold transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-prestige-deep shadow-sm transition-transform active:scale-[0.97] disabled:opacity-60"
        >
          <GoogleGlyph className="h-4 w-4" />
          <span>{googleLoading ? "Redirecting…" : "Continue with Google"}</span>
        </button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="gold-underline font-medium text-prestige-deep">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
