import { useState } from "react";
import {
  CloudDownload,
  Sparkles,
  FileText,
  LineChart,
  RefreshCw,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

type Step = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
};

// One real, working feature per step — no filler slides for things this
// app doesn't actually do. Mirrors the pre-login carousel's visual
// language (src/routes/index.tsx) but is shown post-signup, exactly
// once, and covers what a signed-in student can actually click on today
// (including Feature 26's PDF upload, the newest capability).
const STEPS: Step[] = [
  {
    icon: CloudDownload,
    eyebrow: "Step 1",
    title: "Download on Wi-Fi, study anywhere",
    body: "Open a module in your Library and tap Get. It's saved to this device — the reader works with no signal at all afterward.",
  },
  {
    icon: Sparkles,
    eyebrow: "Step 2",
    title: "Real AI summaries, generated on this device",
    body: "Open any downloaded page and tap Summarise. A fast built-in model works instantly — download the fuller neural model from your Profile for better summaries, whenever you like.",
  },
  {
    icon: FileText,
    eyebrow: "Step 3",
    title: "Upload your own PDFs",
    body: "Got lecture notes or readings as PDFs already? Upload them under My documents in the Library — text is extracted right on your device and can be summarised the same way.",
  },
  {
    icon: LineChart,
    eyebrow: "Step 4",
    title: "A real record of what you've studied",
    body: "Progress and streaks track materials you've actually opened — no fake numbers. Check Progress anytime for the full picture.",
  },
  {
    icon: RefreshCw,
    eyebrow: "Step 5",
    title: "Your progress follows you",
    body: "Reading history, summaries, and documents sync automatically when you're online — sign in on another device and it's all there. Downloads themselves stay on each device, by design.",
  },
];

/** Shown exactly once, automatically, the first time a signed-in student
 * lands on a real page — gated on `profile.onboarding_completed_at`
 * being null (see use-auth.tsx's completeOnboarding, migration 0006).
 * Mounted once at the app root (see __root.tsx), not per-page — same
 * reasoning as AutoSync (Feature 23): most pages remount MobileShell on
 * navigation, which would re-trigger a per-page mount otherwise. */
export function WelcomeTour() {
  const { user, profile, completeOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);

  const shouldShow = Boolean(user && profile && !profile.onboarding_completed_at && !dismissing);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = () => {
    setDismissing(true);
    void completeOnboarding();
  };

  return (
    <Dialog open={shouldShow} onOpenChange={(open) => !open && finish()}>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="p-6">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-prestige-deep/5 text-prestige-mid">
            <current.icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <p className="eyebrow mt-4">{current.eyebrow}</p>
          <h2 className="mt-2 font-display text-xl font-medium leading-tight text-prestige-deep">
            {current.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === step ? "w-6 bg-prestige-deep" : "w-1.5 bg-prestige-deep/15"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={finish}
              className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
              className="inline-flex items-center gap-1.5 rounded-full bg-prestige-deep px-4 py-2 text-xs font-semibold text-prestige-cream transition-transform active:scale-[0.97]"
            >
              {last ? "Get started" : "Next"}
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
