// Real data for the admin console — see DEV_LOG.md, Feature 59. Every
// query here is scoped to what the "Lecturers can view all ..." RLS
// policies (0011_module_enrollments.sql, 0012_admin_console_access.sql)
// actually grant; a non-lecturer calling these gets empty results back
// from RLS, not an error, same as useModuleRoster already does.
import { supabase } from "@/lib/supabase";
import type { FeedbackRow } from "@/lib/supabase";

export type AdminModuleSummary = {
  id: string;
  code: string;
  title: string;
  materialCount: number;
  quizQuestionCount: number;
  enrolledCount: number;
};

// Supabase's typed client can't infer a row shape for an embedded-select
// string against a table with no declared `Relationships` (see
// supabase.ts's `Relationships: []` on every table) — the same reason
// modules-api.ts's own equivalent query needs an explicitly-typed mapper
// function rather than inline inference (a `never` element type is still
// assignable to any explicitly-annotated parameter, which is what makes
// that pattern typecheck at all).
type ModulesWithCountsRow = {
  id: string;
  code: string;
  title: string;
  materials: { id: string }[];
  module_quizzes: { id: string }[];
  module_enrollments: { user_id: string }[];
};

function mapModuleWithCounts(row: ModulesWithCountsRow): AdminModuleSummary {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    materialCount: row.materials.length,
    quizQuestionCount: row.module_quizzes.length,
    enrolledCount: row.module_enrollments.length,
  };
}

/** Every module with real per-module counts, for the console's Modules
 * table. Counts come from the same join-then-count-client-side pattern
 * modules-api.ts already uses for materials/quizQuestions — this app's
 * real catalog size (a dozen-ish modules) makes that entirely fine, and
 * it avoids needing a Postgres view or RPC just for a count. */
export async function fetchAdminModules(): Promise<AdminModuleSummary[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("id, code, title, materials(id), module_quizzes(id), module_enrollments(user_id)")
    .order("code");
  if (error) throw error;
  return (data ?? []).map(mapModuleWithCounts);
}

async function namesByUserId(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  if (error) {
    console.error("Failed to resolve names for admin console", error);
    return new Map();
  }
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}

export type AdminOverview = {
  moduleCount: number;
  distinctEnrolledStudentCount: number;
  quizQuestionCount: number;
  feedbackCount: number;
  modulesWithQuizCount: number;
  recentFeedback: { id: string; fullName: string; message: string; createdAt: string }[];
  recentEnrollments: {
    userId: string;
    fullName: string;
    moduleTitle: string;
    enrolledAt: string;
  }[];
};

/** Everything the Overview page's stat tiles and side panels need, in one
 * place — each piece is a real query against the actual tables (no mock
 * data), fetched in parallel since none depend on each other except the
 * two name-resolution steps at the end. */
export async function fetchAdminOverview(): Promise<AdminOverview> {
  const [
    modulesRes,
    quizRes,
    feedbackRes,
    enrollmentsRes,
    recentFeedbackRes,
    recentEnrollmentsRes,
  ] = await Promise.all([
    supabase.from("modules").select("id, module_quizzes(id)"),
    supabase.from("module_quizzes").select("id", { count: "exact", head: true }),
    supabase.from("feedback").select("id", { count: "exact", head: true }),
    supabase.from("module_enrollments").select("user_id"),
    supabase
      .from("feedback")
      .select("id, user_id, message, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("module_enrollments")
      .select("user_id, module_id, enrolled_at")
      .order("enrolled_at", { ascending: false })
      .limit(5),
  ]);

  if (modulesRes.error) throw modulesRes.error;
  if (enrollmentsRes.error) throw enrollmentsRes.error;
  if (recentFeedbackRes.error) throw recentFeedbackRes.error;
  if (recentEnrollmentsRes.error) throw recentEnrollmentsRes.error;

  const distinctEnrolledStudentCount = new Set((enrollmentsRes.data ?? []).map((e) => e.user_id))
    .size;
  const modulesWithQuizzes = (modulesRes.data ?? []) as {
    id: string;
    module_quizzes: { id: string }[];
  }[];
  const modulesWithQuizCount = modulesWithQuizzes.filter((m) => m.module_quizzes.length > 0).length;

  const feedbackUserIds = (recentFeedbackRes.data ?? []).map((f) => f.user_id);
  const enrollmentUserIds = (recentEnrollmentsRes.data ?? []).map((e) => e.user_id);
  const names = await namesByUserId([...feedbackUserIds, ...enrollmentUserIds]);

  const moduleIds = (recentEnrollmentsRes.data ?? []).map((e) => e.module_id);
  const { data: moduleTitleRows } =
    moduleIds.length > 0
      ? await supabase.from("modules").select("id, title").in("id", moduleIds)
      : { data: [] as { id: string; title: string }[] };
  const titleByModuleId = new Map((moduleTitleRows ?? []).map((m) => [m.id, m.title]));

  return {
    moduleCount: (modulesRes.data ?? []).length,
    distinctEnrolledStudentCount,
    quizQuestionCount: quizRes.count ?? 0,
    feedbackCount: feedbackRes.count ?? 0,
    modulesWithQuizCount,
    recentFeedback: (recentFeedbackRes.data ?? []).map((f) => ({
      id: f.id,
      fullName: names.get(f.user_id) ?? "Unknown student",
      message: f.message,
      createdAt: f.created_at,
    })),
    recentEnrollments: (recentEnrollmentsRes.data ?? []).map((e) => ({
      userId: e.user_id,
      fullName: names.get(e.user_id) ?? "Unknown student",
      moduleTitle: titleByModuleId.get(e.module_id) ?? e.module_id,
      enrolledAt: e.enrolled_at,
    })),
  };
}

export type AdminFeedbackItem = FeedbackRow & {
  fullName: string;
  imageUrls: string[];
};

/** Every feedback submission, newest first, with the submitter's real
 * name resolved and signed URLs for each attached image — the bucket is
 * private (see 0009_feedback.sql's own reasoning: a screenshot can easily
 * contain personal info), so a plain public URL wouldn't work even with
 * the read grant above; a signed URL is the real mechanism the migration's
 * own comment already anticipated ("resolved to a viewable URL at review
 * time"). */
export async function fetchAdminFeedback(): Promise<AdminFeedbackItem[]> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];

  const names = await namesByUserId(rows.map((r) => r.user_id));

  const withImages = await Promise.all(
    rows.map(async (row) => {
      const imageUrls: string[] = [];
      for (const path of row.image_paths) {
        const { data: signed } = await supabase.storage
          .from("feedback-images")
          .createSignedUrl(path, 3600);
        if (signed?.signedUrl) imageUrls.push(signed.signedUrl);
      }
      return {
        ...row,
        fullName: names.get(row.user_id) ?? "Unknown student",
        imageUrls,
      };
    }),
  );

  return withImages;
}
