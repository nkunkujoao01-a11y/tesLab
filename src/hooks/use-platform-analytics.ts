// Platform-wide analytics for the super admin overview — same real-data
// pattern as use-module-analytics.ts (reads activity_events/read_materials
// directly rather than a separate reporting table), just without a
// moduleId/roster scope. No new instrumentation: only what
// activity_events (download/read/summary/quiz/flashcard),
// read_materials, feedback, and the research tables already record. Time
// spent and device/platform signals do not exist anywhere server-side —
// deliberately not faked here; the overview page surfaces that as a known
// gap instead.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ActivityType } from "@/lib/db";
import type { ResearchSurveyAnswers } from "@/lib/supabase";

const ACTIVITY_TYPES: ActivityType[] = ["download", "read", "summary", "quiz", "flashcard"];

// Same "reasonably generous, not exhaustive" bound as
// use-module-analytics.ts's ACTIVITY_SAMPLE_LIMIT — an honest
// approximation for distinct-active-user counts, not a guarantee every
// event in a long window is captured.
const ACTIVE_USER_SAMPLE_LIMIT = 5000;

export type PlatformAnalytics = {
  totalStudents: number;
  activeLast7Days: number;
  activeLast30Days: number;
  eventsByType: Record<ActivityType, number>;
  totalMaterialsRead: number;
  feedbackCount: number;
  avgFeedbackRating: number | null;
  researchConsentCount: number;
  researchConsentAgreedCount: number;
  researchSurveyResponseCount: number;
};

function countDistinctUsers(rows: { user_id: string }[]): number {
  return new Set(rows.map((r) => r.user_id)).size;
}

export function usePlatformAnalytics(): {
  data: PlatformAnalytics | null;
  loading: boolean;
  refetch: () => void;
} {
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const now = Date.now();
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    void Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("activity_events")
        .select("user_id")
        .gte("event_at", since7d)
        .limit(ACTIVE_USER_SAMPLE_LIMIT),
      supabase
        .from("activity_events")
        .select("user_id")
        .gte("event_at", since30d)
        .limit(ACTIVE_USER_SAMPLE_LIMIT),
      Promise.all(
        ACTIVITY_TYPES.map((type) =>
          supabase
            .from("activity_events")
            .select("id", { count: "exact", head: true })
            .eq("type", type),
        ),
      ),
      supabase.from("read_materials").select("user_id", { count: "exact", head: true }),
      supabase.from("feedback").select("rating"),
      supabase.from("research_consent").select("agreed"),
      supabase.from("research_survey_responses").select("id", { count: "exact", head: true }),
    ]).then(
      ([
        studentsRes,
        active7dRes,
        active30dRes,
        eventTypeResults,
        materialsRes,
        feedbackRes,
        consentRes,
        surveyRes,
      ]) => {
        if (cancelled) return;

        const eventsByType = {} as Record<ActivityType, number>;
        ACTIVITY_TYPES.forEach((type, i) => {
          const res = eventTypeResults[i];
          if (res.error) console.error(`Failed to count ${type} events`, res.error);
          eventsByType[type] = res.count ?? 0;
        });

        const ratings = (feedbackRes.data ?? [])
          .map((f) => f.rating)
          .filter((r): r is number => r !== null);

        setData({
          totalStudents: studentsRes.count ?? 0,
          activeLast7Days: countDistinctUsers(active7dRes.data ?? []),
          activeLast30Days: countDistinctUsers(active30dRes.data ?? []),
          eventsByType,
          totalMaterialsRead: materialsRes.count ?? 0,
          feedbackCount: feedbackRes.data?.length ?? 0,
          avgFeedbackRating:
            ratings.length > 0
              ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
              : null,
          // Real counts only for an actual super admin — research_consent
          // and research_survey_responses are RLS-gated to is_super_admin()
          // specifically (0036_research_super_admin_access.sql), so these
          // come back as empty arrays/zero for anyone else, not an error.
          researchConsentCount: consentRes.data?.length ?? 0,
          researchConsentAgreedCount: (consentRes.data ?? []).filter((c) => c.agreed).length,
          researchSurveyResponseCount: surveyRes.count ?? 0,
        });
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { data, loading, refetch };
}

export type ResearchSubmission = {
  anonymousId: string;
  consent: { agreed: boolean; respondedAt: string } | null;
  survey: ResearchSurveyAnswers | null;
  surveySubmittedAt: string | null;
};

/** Groups research_consent/research_survey_responses rows by
 * anonymous_id for the dedicated research page. anonymous_id is a
 * per-device random "User_XXXX" tag (research-study.ts), not globally
 * unique — two different real students could coincidentally share one,
 * so this grouping is a best-effort pairing, not a guaranteed one-to-one
 * identity join. Surfaced as a caveat in the page itself, not just here. */
export function useResearchSubmissions(): {
  submissions: ResearchSubmission[];
  loading: boolean;
  refetch: () => void;
} {
  const [submissions, setSubmissions] = useState<ResearchSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      supabase
        .from("research_consent")
        .select("anonymous_id, agreed, responded_at")
        .order("responded_at", { ascending: false }),
      supabase
        .from("research_survey_responses")
        .select("anonymous_id, answers, submitted_at")
        .order("submitted_at", { ascending: false }),
    ]).then(([consentRes, surveyRes]) => {
      if (cancelled) return;
      if (consentRes.error)
        console.error("Failed to load research consent records", consentRes.error);
      if (surveyRes.error)
        console.error("Failed to load research survey responses", surveyRes.error);

      const byId = new Map<string, ResearchSubmission>();
      for (const row of consentRes.data ?? []) {
        byId.set(row.anonymous_id, {
          anonymousId: row.anonymous_id,
          consent: { agreed: row.agreed, respondedAt: row.responded_at },
          survey: null,
          surveySubmittedAt: null,
        });
      }
      for (const row of surveyRes.data ?? []) {
        const existing = byId.get(row.anonymous_id);
        if (existing) {
          existing.survey = row.answers;
          existing.surveySubmittedAt = row.submitted_at;
        } else {
          byId.set(row.anonymous_id, {
            anonymousId: row.anonymous_id,
            consent: null,
            survey: row.answers,
            surveySubmittedAt: row.submitted_at,
          });
        }
      }
      setSubmissions([...byId.values()]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { submissions, loading, refetch };
}

export type AnonymousSuggestion = {
  anonymousId: string;
  message: string;
  submittedAt: string;
};

/** The general anonymous suggestion box (0039_anonymous_suggestions.sql)
 * — separate from research_consent/research_survey_responses above, same
 * is_super_admin()-gated read access. Real rows only for an actual super
 * admin, empty for anyone else, per that table's RLS. */
export function useAnonymousSuggestions(): {
  suggestions: AnonymousSuggestion[];
  loading: boolean;
  refetch: () => void;
} {
  const [suggestions, setSuggestions] = useState<AnonymousSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("anonymous_suggestions")
      .select("anonymous_id, message, submitted_at")
      .order("submitted_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Failed to load anonymous suggestions", error);
        setSuggestions(
          (data ?? []).map((row) => ({
            anonymousId: row.anonymous_id,
            message: row.message,
            submittedAt: row.submitted_at,
          })),
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { suggestions, loading, refetch };
}
