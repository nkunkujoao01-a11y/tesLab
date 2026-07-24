// Full-screen, mandatory consent gate for the NUST ethics-approved
// usability study this app is part of — shown once, immediately after a
// signed-in student's first load, before the rest of the app. See
// use-research-study.ts's useResearchConsentGate for exactly when this
// mounts and what "responding" means, and 0025_research_study.sql for why
// nothing submitted here carries any real identity.
//
// Styled distinctly from this app's everyday utilitarian cards on
// purpose — a consent form is read once and needs to feel like a real,
// considered document, not another settings panel. A restrained but
// deliberate cinematic treatment: a full-bleed deep gradient, a large
// serif-display title, and generous, unhurried spacing — the outcome (a
// blocking gate) is the deliberately mandatory part per the request that
// commissioned this; the actual *tone* is meant to read as respectful
// and clear, not clinical.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useResearchConsentGate } from "@/hooks/use-research-study";

function ConsentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-prestige-cream/10 pt-5 first:border-none first:pt-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-prestige-gold">
        {title}
      </p>
      <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-prestige-cream/80">
        {children}
      </div>
    </div>
  );
}

export function ResearchConsentGate() {
  const { shouldShow, respond } = useResearchConsentGate();
  const [submitting, setSubmitting] = useState<"agree" | "decline" | null>(null);

  if (!shouldShow) return null;

  const handleRespond = async (agreed: boolean) => {
    setSubmitting(agreed ? "agree" : "decline");
    await respond(agreed);
    setSubmitting(null);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-prestige-deep">
      {/* A soft, off-center radial glow — the one deliberately decorative
          touch, restrained enough not to compete with the actual text. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 85% 0%, color-mix(in oklab, var(--prestige-gold) 18%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-[640px] flex-col justify-center px-6 py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-prestige-gold">
          Research Study Consent
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium leading-[1.15] tracking-tight text-prestige-cream lg:text-4xl">
          An AI-based, low-bandwidth eLearning platform for Namibian university students
        </h1>
        <p className="mt-4 text-sm text-prestige-cream/70">
          Researcher: Joao Ndongala Nkunku (Student Number: 223068209) · Supervisor: Dr Tendai
          Mataranyika · Namibia University of Science and Technology
        </p>

        <div className="mt-10 space-y-5 rounded-2xl bg-prestige-cream/5 p-6 ring-1 ring-prestige-cream/10 lg:p-8">
          <ConsentSection title="Introduction">
            <p>
              You are being invited to participate in a research study to evaluate a new,
              low-bandwidth eLearning platform designed to help students study offline and use AI to
              summarize course materials.
            </p>
          </ConsentSection>

          <ConsentSection title="Purpose">
            <p>
              To test the usability of the platform and measure how much mobile data it saves
              compared to other eLearning systems.
            </p>
          </ConsentSection>

          <ConsentSection title="Procedures">
            <p>Your participation involves using this platform on your laptop or smartphone, and</p>
            <p>completing a short questionnaire about your experience (approx. 5 minutes).</p>
          </ConsentSection>

          <ConsentSection title="Voluntary participation">
            <p>
              Your participation is completely voluntary. You may choose not to participate, or stop
              using the platform at any time, without any penalty or loss of benefits.
            </p>
          </ConsentSection>

          <ConsentSection title="Confidentiality & data storage">
            <p>
              Any data collected (questionnaire answers and system logs) will be kept confidential.
            </p>
            <p>
              No personal information that can identify you — like your name or student number —
              will be collected.
            </p>
            <p>
              All data will be stored on a password-protected computer accessible only to the
              researcher, and deleted after two years.
            </p>
          </ConsentSection>

          <ConsentSection title="Risks & benefits">
            <p>
              There are no significant risks involved. While you may not receive a direct benefit
              from participating, your feedback will help improve educational technology for
              students in Namibia.
            </p>
          </ConsentSection>

          <ConsentSection title="Ethical clearance">
            <p>
              This study has been reviewed and approved by the NUST Faculty of Computing and
              Informatics.
            </p>
          </ConsentSection>

          <ConsentSection title="Consent statement">
            <p>
              By choosing "I agree" below, you confirm that you have read and understood the
              information above, understand that your participation is voluntary, and agree to
              participate in this study.
            </p>
          </ConsentSection>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => void handleRespond(false)}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-prestige-cream/70 ring-1 ring-prestige-cream/20 transition-all hover:bg-prestige-cream/5 hover:text-prestige-cream disabled:opacity-40"
          >
            {submitting === "decline" && (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            )}
            I do not agree
          </button>
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => void handleRespond(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-prestige-gold px-5 py-3 text-sm font-semibold text-prestige-deep transition-all active:scale-[0.98] disabled:opacity-40"
          >
            {submitting === "agree" && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
            I agree to participate
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] text-prestige-cream/40 sm:text-right">
          You can use eLearn either way — this only affects the research study itself.
        </p>
      </div>
    </div>
  );
}
