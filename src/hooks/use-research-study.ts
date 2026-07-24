import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getUserDb } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  submitResearchConsent,
  submitResearchSurvey,
  submitAnonymousSuggestion,
} from "@/lib/research-study";
import type { ResearchSurveyAnswers } from "@/lib/supabase";

// Bookkeeping only — whether *this signed-in account* has already been
// asked, stored in its own local UserDB (see db.ts) so it's never shown
// twice to the same student. Genuinely separate from the anonymous data
// actually submitted to Supabase (research-study.ts) — this flag never
// leaves the device and carries no answer content, just "already asked."
const CONSENT_RESPONDED_KEY = "research_consent_responded";
const CONSENT_AGREED_KEY = "research_consent_agreed";
const SURVEY_COMPLETED_KEY = "research_survey_completed";
// In-progress answers, so closing the app (or just this modal) mid-survey
// doesn't lose what was already filled in — see ResearchSurveyModal, which
// reads/writes this on every step. Cleared only on a real successful
// submit (useSubmitResearchSurvey below), never on a plain close.
const SURVEY_DRAFT_KEY = "research_survey_draft";

// Resets on a real reload/app relaunch (module-level, not persisted) —
// lets the prompt reappear at every fresh app open until the survey is
// actually completed, without also reopening on every in-app navigation
// after a student has already closed it once this session.
let closedThisLoad = false;

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

/** Whether the optional post-task survey should auto-prompt — shows at
 * every fresh app open/login for a student who has responded to the
 * consent gate but not yet completed the survey, and keeps reappearing on
 * the next app open (not the same one — see `closedThisLoad`) until it's
 * actually completed, not just shown. In-progress answers survive a close
 * via SURVEY_DRAFT_KEY (see ResearchSurveyModal), so nothing is lost if a
 * student closes the app mid-survey by mistake. Also reachable anytime,
 * voluntarily, from Profile regardless of this. */
export function useResearchSurveyPrompt(): {
  shouldShow: boolean;
  dismiss: () => void;
} {
  const { user } = useAuth();
  const [consentResponded, setConsentResponded] = useState<boolean | null>(null);
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [closed, setClosed] = useState(closedThisLoad);

  useEffect(() => {
    if (!user) {
      setConsentResponded(null);
      setCompleted(null);
      return;
    }
    const db = getUserDb(user.id);
    void db.syncMeta
      .get(CONSENT_RESPONDED_KEY)
      .then((row) => setConsentResponded(row?.value === "true"));
    void db.syncMeta.get(SURVEY_COMPLETED_KEY).then((row) => setCompleted(row?.value === "true"));
  }, [user]);

  const dismiss = useCallback(() => {
    closedThisLoad = true;
    setClosed(true);
  }, []);

  return {
    shouldShow: Boolean(user) && consentResponded === true && completed === false && !closed,
    dismiss,
  };
}

export type ResearchSurveyDraft = {
  stepIndex: number;
  sus: Record<number, number>;
  tam: Record<number, number>;
  dataEfficiency: Record<number, number>;
  openEnded: Record<number, string>;
  continueDevelopment: number | undefined;
};

/** Reads/writes the in-progress survey draft — see SURVEY_DRAFT_KEY's own
 * comment above for why this exists. `loading` distinguishes "haven't
 * checked yet" from "checked, there's genuinely no draft," so
 * ResearchSurveyModal doesn't overwrite a real in-progress draft with
 * blank state before the read resolves. */
export function useResearchSurveyDraft(): {
  draft: ResearchSurveyDraft | null;
  loading: boolean;
  saveDraft: (draft: ResearchSurveyDraft) => void;
  clearDraft: () => void;
} {
  const { user } = useAuth();
  const [draft, setDraft] = useState<ResearchSurveyDraft | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDraft(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void getUserDb(user.id)
      .syncMeta.get(SURVEY_DRAFT_KEY)
      .then((row) => {
        if (!row) {
          setDraft(null);
          return;
        }
        try {
          setDraft(JSON.parse(row.value) as ResearchSurveyDraft);
        } catch (err) {
          console.error("Failed to parse saved survey draft", err);
          setDraft(null);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const saveDraft = useCallback(
    (next: ResearchSurveyDraft) => {
      if (!user) return;
      void getUserDb(user.id).syncMeta.put({ key: SURVEY_DRAFT_KEY, value: JSON.stringify(next) });
    },
    [user],
  );

  const clearDraft = useCallback(() => {
    if (!user) return;
    void getUserDb(user.id).syncMeta.delete(SURVEY_DRAFT_KEY);
  }, [user]);

  return { draft, loading, saveDraft, clearDraft };
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

/** The general anonymous suggestion box (Profile) — separate from the
 * survey above and from the account-tied feedback feature
 * (use-feedback.ts). Online-only, same reasoning as
 * useSubmitResearchSurvey: a one-off submission with no local read-path
 * afterward. */
export function useSubmitAnonymousSuggestion() {
  const isOnline = useOnlineStatus();
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (message: string) => {
      if (!message.trim() || !isOnline) return false;
      setSubmitting(true);
      try {
        await submitAnonymousSuggestion(message);
        toast.success("Thanks — sent anonymously.");
        return true;
      } catch (err) {
        console.error("Failed to submit anonymous suggestion", err);
        toast.error("Couldn't send that. Check your connection and try again.");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [isOnline],
  );

  return { submit, submitting };
}
