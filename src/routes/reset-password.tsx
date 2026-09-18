import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { supabase } from "@/lib/supabase";
import { useOnlineStatus } from "@/hooks/use-online-status";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password - eLearn" },
      { name: "description", content: "Set a new password for your eLearn account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  // Starts "checking" rather than assuming the recovery link already
  // worked — supabase-js parses the token out of the URL asynchronously
  // and only then fires the PASSWORD_RECOVERY event below, so rendering
  // the form immediately would let someone submit before a real recovery
  // session exists. "invalid" covers an expired/already-used/malformed
  // link, which never fires that event at all.
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let settled = false;
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setStatus("ready");
      }
    });
    // A real link Supabase itself already rejected (expired/used) never
    // fires PASSWORD_RECOVERY at all — this is what turns that into an
    // actual "invalid" message instead of leaving the checking state (and
    // this page) spinning forever.
    const timer = setTimeout(() => {
      if (!settled) setStatus("invalid");
    }, 5000);
    return () => {
      clearTimeout(timer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isOnline) {
      setError("You're offline. Connect to the internet to set a new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    void navigate({ to: "/dashboard" });
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">Checking your reset link…</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 font-display text-xl font-medium text-prestige-deep">
          This link has expired
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
          Reset links only work once and expire after a while. Request a fresh one below.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-prestige-deep px-5 py-3 text-sm font-medium text-prestige-cream shadow-lg shadow-prestige-deep/20 transition-transform active:scale-[0.97]"
        >
          Send a new link
        </Link>
      </div>
    );
  }

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
          Set a new password.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a new password for your eLearn account.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-prestige-mid">
              New password
            </label>
            <PasswordInput
              id="password"
              required
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 rounded-lg text-base md:text-base"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-xs font-medium text-prestige-mid">
              Confirm new password
            </label>
            <PasswordInput
              id="confirmPassword"
              required
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-14 rounded-lg text-base md:text-base"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading || !isOnline}
            title={!isOnline ? "Setting a new password needs a network connection" : undefined}
            className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-prestige-deep px-5 py-3 text-sm font-medium text-prestige-cream shadow-lg shadow-prestige-deep/20 transition-transform active:scale-[0.97] disabled:opacity-60"
          >
            <span>{loading ? "Saving…" : "Save new password"}</span>
            {!loading && (
              <ChevronRight
                className="h-4 w-4 text-prestige-gold transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
