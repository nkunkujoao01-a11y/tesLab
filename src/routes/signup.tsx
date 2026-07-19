import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ChevronRight, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — eLearn" },
      { name: "description", content: "Create your eLearn account." },
    ],
  }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      void navigate({ to: "/dashboard" });
    } else {
      // Email confirmation is required before a session is issued.
      setCheckEmail(true);
    }
  };

  if (checkEmail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-prestige-deep/5 text-prestige-mid">
          <MailCheck className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 font-display text-xl font-medium text-prestige-deep">
          Check your email
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm text-muted-foreground">
          We sent a confirmation link to {email}. Follow it to finish creating your account.
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
          Create your account.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Download modules, generate summaries, study offline.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-xs font-medium text-prestige-mid">
              Full name
            </label>
            <Input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-prestige-mid">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              minLength={6}
              autoComplete="new-password"
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
            <span>{loading ? "Creating account…" : "Create account"}</span>
            {!loading && (
              <ChevronRight
                className="h-4 w-4 text-prestige-gold transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="gold-underline font-medium text-prestige-deep">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
