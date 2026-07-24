import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getUserDb } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { submitResearchConsent, submitResearchSurvey } from "@/lib/research-study";
import type { ResearchSurveyAnswers } from "@/lib/supabase";
import { useSummariesGeneratedCount } from "@/hooks/use-activity";
import { useDownloadedMaterialIds } from "@/hooks/use-downloads";

// Bookkeeping only — whether *this signed-in account* has already been
// asked, stored in its own local UserDB (see db.ts) so it's never shown
// twice to the same student. Genuinely separate from the anonymous data
// actually submitted to Supabase (research-study.ts) — this flag never
// leaves the device and carries no answer content, just "already asked."
const CONSENT_RESPONDED_KEY = "research_consent_responded";
const CONSENT_AGREED_KEY = "research_consent_agreed";
const SURVEY_SHOWN_KEY = "research_survey_shown";
const SURVEY_COMPLETED_KEY = "research_survey_completed";

/** Whether the mandatory consent gate should show — true only once, the
 * first time a signed-in student who hasn't yet responded (agreed *or*
 * declined — either answer counts as "responded") loads the app. */
export function useResearchConsentGate(): {
  shouldShow: boolean;
  respond: (agreed: boolean) => Promise<void>;
} {
  const { user } = useAuth();
  const [responded, setResponded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setResponded(null);
      return;
    }
    void getUserDb(user.id)
      .syncMeta.get(CONSENT_RESPONDED_KEY)
      .then((row) => setResponded(row?.value === "true"));
  }, [user]);

  const respond = useCallback(
    async (agreed: boolean) => {
      if (!user) return;
      try {
        await submitResearchConsent(agreed);
      } catch (err) {
        console.error("Failed to submit research consent", err);
        // Recorded locally either way (see the block below) — a failed
        // submission (offline, network blip) shouldn't trap a student
        // behind a gate they already made a real choice on. There's
        // nothing sensitive in "agreed: true/false" alone to lose by not
        // retrying it — worth being honest about in the console, not
        // worth blocking on.
      }
      const db = getUserDb(user.id);
      await db.syncMeta.put({ key: CONSENT_RESPONDED_KEY, value: "true" });
      await db.syncMeta.put({ key: CONSENT_AGREED_KEY, value: agreed ? "true" : "false" });
      setResponded(true);
    },
    [user],
  );

  return { shouldShow: Boolean(user) && responded === false, respond };
}

/** Whether the optional post-task survey should auto-prompt — once,
 * after real usage (a generated summary, or a downloaded material), never
 * again once shown (whether or not it was actually completed — a
 * dismissed prompt shouldn't keep reappearing). Also reachable anytime,
 * voluntarily, from Profile regardless of this. */
export function useResearchSurveyPrompt(): {
  shouldShow: boolean;
  dismiss: () => void;
} {
  const { user } = useAuth();
  const summariesCount = useSummariesGeneratedCount();
  const downloadedCount = useDownloadedMaterialIds().size;
  const [alreadyShown, setAlreadyShown] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setAlreadyShown(null);
      return;
    }
    void getUserDb(user.id)
      .syncMeta.get(SURVEY_SHOWN_KEY)
      .then((row) => setAlreadyShown(row?.value === "true"));
  }, [user]);

  const dismiss = useCallback(() => {
    if (!user) return;
    setAlreadyShown(true);
    void getUserDb(user.id).syncMeta.put({ key: SURVEY_SHOWN_KEY, value: "true" });
  }, [user]);

  const hasDoneRealTask = summariesCount > 0 || downloadedCount > 0;

  return { shouldShow: Boolean(user) && alreadyShown === false && hasDoneRealTask, dismiss };
}

/** Submits the survey — online-only, same "gate on being online, no
 * offline queue" reasoning as use-feedback.ts's identical choice: this is
 * a one-off submission with no local read-path afterward, not content the
 * student ever reads back, so there's nothing this app's usual
 * local-first sync pattern would actually be preserving here. */
export function useSubmitResearchSurvey() {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (answers: ResearchSurveyAnswers) => {
      if (!user || !isOnline) return false;
      setSubmitting(true);
      try {
        await submitResearchSurvey(answers);
        await getUserDb(user.id).syncMeta.put({ key: SURVEY_COMPLETED_KEY, value: "true" });
        toast.success("Thanks for completing the survey — it genuinely helps.");
        return true;
      } catch (err) {
        console.error("Failed to submit research survey", err);
        toast.error("Couldn't submit the survey. Check your connection and try again.");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [user, isOnline],
  );

  return { submit, submitting };
}

/** Whether this account has already completed the survey — used to swap
 * the voluntary Profile link's label ("Take the survey" vs. "Survey
 * completed — thank you") rather than just always offering it. */
export function useResearchSurveyCompleted(): boolean {
  const { user } = useAuth();
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!user) {
      setCompleted(false);
      return;
    }
    void getUserDb(user.id)
      .syncMeta.get(SURVEY_COMPLETED_KEY)
      .then((row) => setCompleted(row?.value === "true"));
  }, [user]);

  return completed;
}
