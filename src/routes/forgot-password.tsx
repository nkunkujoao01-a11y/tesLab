import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ChevronRight, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOnlineStatus } from "@/hooks/use-online-status";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password - eLearn" },
      { name: "description", content: "Reset the password for your eLearn account." },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const isOnline = useOnlineStatus();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isOnline) {
      setError("You're offline. Connect to the internet to reset your password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Shown on success regardless of whether that email actually has an
    // account — same reasoning Supabase's own dashboard defaults to: telling
    // a stranger "no account with that email" is exactly the kind of thing
    // that lets someone probe which emails are registered here.
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-prestige-deep/5 text-prestige-mid">
          <MailCheck className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 font-display text-xl font-medium text-prestige-deep">
          Check your email
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
          If an eLearn account exists for {email.trim()}, we sent a link to reset its password.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-prestige-mid hover:text-prestige-deep"
        >
          Back to sign in
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
          Forgot your password?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email for your eLearn account and we'll send you a link to reset it. Signed in
          with your NUST student number instead? That password is managed by NUST eLearning itself,
          not here.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-prestige-mid">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 rounded-lg text-base md:text-base"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading || !isOnline}
            title={!isOnline ? "Sending a reset link needs a network connection" : undefined}
            className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-prestige-deep px-5 py-3 text-sm font-medium text-prestige-cream shadow-lg shadow-prestige-deep/20 transition-transform active:scale-[0.97] disabled:opacity-60"
          >
            <span>{loading ? "Sending…" : "Send reset link"}</span>
            {!loading && (
              <ChevronRight
                className="h-4 w-4 text-prestige-gold transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="gold-underline font-medium text-prestige-deep">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
