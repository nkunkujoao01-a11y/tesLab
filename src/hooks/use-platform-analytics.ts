// Platform-wide analytics for the super admin overview — same real-data
// pattern as use-module-analytics.ts (reads activity_events/read_materials
// directly rather than a separate reporting table), just without a
// moduleId/roster scope. Device/platform breakdown and session-duration
// data come from study_sessions (0040_study_sessions.sql,
// use-session-tracking.ts) — real "tab open and visible" time, not
// focused-study precision (see that hook's own comment on the tradeoff).
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

// Same bounded-sample honesty as ACTIVE_USER_SAMPLE_LIMIT above, applied to
// the two new real-usage breakdowns below (top modules, activity by hour) —
// large enough to be a genuinely representative sample of recent real
// behavior, not a claim of exhaustiveness over the platform's entire
// history.
const USAGE_SAMPLE_LIMIT = 5000;

export type TopModule = {
  moduleId: string;
  title: string;
  readCount: number;
};

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
  deviceBreakdown: Record<"mobile" | "tablet" | "desktop", number>;
  avgSessionMinutes: number | null;
  // What's actually being used — real read_materials rows grouped by
  // module and joined against the modules table for a real title, not
  // just a raw id. See useModuleAnalytics (per-module admin pages) for
  // the equivalent scoped-to-one-module breakdown; this is the
  // platform-wide "what's popular" ranking that didn't exist before.
  topModules: TopModule[];
  // When real usage actually happens, by hour of day (0-23, in whichever
  // timezone the browser viewing this dashboard is in) — this app has no
  // stored per-student timezone, and its whole student base is Namibia-
  // based in practice, so an admin viewing this from the same timezone
  // reads it correctly as local time; genuinely wrong only for an admin
  // reviewing from a different timezone than their own students.
  activityByHour: { hour: number; count: number }[];
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
    // "When does real usage happen" is about current behavior, not the
    // platform's entire history — a 90-day window is generous enough to
    // smooth out a single unusual week while still reflecting how
    // students actually use the app today, not a semester that ended
    // long ago.
    const since90d = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();

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
      supabase.from("study_sessions").select("user_id, device_type, duration_seconds, updated_at"),
      // Real per-module read counts — no server-side GROUP BY through the
      // Supabase client, so this fetches raw module_id rows (bounded, same
      // discipline as ACTIVE_USER_SAMPLE_LIMIT above) and aggregates
      // client-side, same as deviceBreakdown/avgSessionMinutes already do
      // for study_sessions below.
      supabase.from("read_materials").select("module_id").limit(USAGE_SAMPLE_LIMIT),
      supabase.from("modules").select("id, title"),
      supabase
        .from("activity_events")
        .select("event_at")
        .gte("event_at", since90d)
        .limit(USAGE_SAMPLE_LIMIT),
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
        sessionsRes,
        moduleReadsRes,
        modulesRes,
        recentEventsRes,
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

        if (sessionsRes.error) console.error("Failed to load study sessions", sessionsRes.error);
        // Each distinct student's most recent session decides their
        // device bucket — a student who studies on both phone and laptop
        // still counts once, under whichever they used last.
        const latestSessionByUser = new Map<string, NonNullable<typeof sessionsRes.data>[number]>();
        for (const row of sessionsRes.data ?? []) {
          const existing = latestSessionByUser.get(row.user_id);
          if (!existing || row.updated_at > existing.updated_at) {
            latestSessionByUser.set(row.user_id, row);
          }
        }
        const deviceBreakdown = { mobile: 0, tablet: 0, desktop: 0 };
        for (const session of latestSessionByUser.values()) {
          deviceBreakdown[session.device_type] += 1;
        }
        // Excludes 0-duration sessions — a session that just started and
        // never had a chance to accumulate any visible time would
        // otherwise skew the average toward 0 unfairly.
        const nonZeroDurations = (sessionsRes.data ?? [])
          .map((s) => s.duration_seconds)
          .filter((d) => d > 0);
        const avgSessionMinutes =
          nonZeroDurations.length > 0
            ? Math.round(
                (nonZeroDurations.reduce((a, b) => a + b, 0) / nonZeroDurations.length / 60) * 10,
              ) / 10
            : null;

        if (moduleReadsRes.error)
          console.error("Failed to load read_materials for module ranking", moduleReadsRes.error);
        if (modulesRes.error)
          console.error("Failed to load modules for title lookup", modulesRes.error);
        const moduleTitleById = new Map((modulesRes.data ?? []).map((m) => [m.id, m.title]));
        const readCountByModule = new Map<string, number>();
        for (const row of moduleReadsRes.data ?? []) {
          readCountByModule.set(row.module_id, (readCountByModule.get(row.module_id) ?? 0) + 1);
        }
        // Top 8 is enough to answer "what's actually popular" at a glance
        // without turning this into its own scrollable table — a student
        // ever reading from dozens of modules evenly would show a flat
        // ranking either way, which is itself an honest answer.
        const topModules: TopModule[] = [...readCountByModule.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([moduleId, readCount]) => ({
            moduleId,
            title: moduleTitleById.get(moduleId) ?? moduleId,
            readCount,
          }));

        if (recentEventsRes.error)
          console.error(
            "Failed to load recent activity for hourly breakdown",
            recentEventsRes.error,
          );
        const hourCounts = new Array(24).fill(0) as number[];
        for (const row of recentEventsRes.data ?? []) {
          hourCounts[new Date(row.event_at).getHours()] += 1;
        }
        const activityByHour = hourCounts.map((count, hour) => ({ hour, count }));

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
          deviceBreakdown,
          avgSessionMinutes,
          topModules,
          activityByHour,
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
  // Null whenever the student chose "keep my response anonymous" — see
  // 0042_research_optional_identity.sql. Not a display nicety on top of
  // anonymousId: this is the real identity, present only when a
  // respondent actually chose to be identified.
  fullName: string | null;
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
        .select("anonymous_id, agreed, responded_at, full_name")
        .order("responded_at", { ascending: false }),
      supabase
        .from("research_survey_responses")
        .select("anonymous_id, answers, submitted_at, full_name")
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
          fullName: row.full_name,
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
          existing.fullName = existing.fullName ?? row.full_name;
        } else {
          byId.set(row.anonymous_id, {
            anonymousId: row.anonymous_id,
            fullName: row.full_name,
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
  imageUrls: string[];
};

/** The general anonymous suggestion box (0039_anonymous_suggestions.sql,
 * images added in 0041_anonymous_suggestion_images.sql) — separate from
 * research_consent/research_survey_responses above, same
 * is_super_admin()-gated read access. Real rows only for an actual super
 * admin, empty for anyone else, per that table's RLS. Signed URLs are
 * resolved here (not stored) since the bucket is private — same
 * "resolved to a viewable URL at review time" pattern
 * fetchAdminFeedback (admin-console-api.ts) already established for the
 * unrelated feedback-images bucket. */
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
      .select("anonymous_id, message, image_paths, submitted_at")
      .order("submitted_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load anonymous suggestions", error);
          setSuggestions([]);
          setLoading(false);
          return;
        }
        const withImages = await Promise.all(
          (data ?? []).map(async (row) => {
            const imageUrls: string[] = [];
            for (const path of row.image_paths) {
              const { data: signed } = await supabase.storage
                .from("anonymous-suggestion-images")
                .createSignedUrl(path, 3600);
              if (signed?.signedUrl) imageUrls.push(signed.signedUrl);
            }
            return {
              anonymousId: row.anonymous_id,
              message: row.message,
              submittedAt: row.submitted_at,
              imageUrls,
            };
          }),
        );
        if (cancelled) return;
        setSuggestions(withImages);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { suggestions, loading, refetch };
}
