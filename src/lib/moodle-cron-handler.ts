// eLearn: the automatic NUST eLearning sync — triggered on a schedule by
// Supabase pg_cron (see supabase/migrations/0018_moodle_sync_cron.sql),
// which POSTs to /api/moodle/cron-sync. Wired into src/server.ts as a
// plain path intercept *before* TanStack Start's own request pipeline
// runs, deliberately not a createServerFn: those compile down to
// same-origin, CSRF-protected, client-invoked RPC calls (see start.ts) —
// exactly wrong for a stable URL an external scheduler hits with a shared
// secret instead of a browser session.
//
// This is this app's first-ever use of the Supabase *service-role* key —
// required to decrypt/read every connected student's row, not just the
// caller's own (see admin_get_moodle_token/admin_list_moodle_connections_
// due_for_sync/admin_record_moodle_sync_result in
// 0017_moodle_connections.sql, each grantable only to service_role).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MoodleAuthError, moodleCall } from "@/lib/moodle-sync-server";

// A connection is only retried after this many hours since its last sync
// attempt — matched to the cron schedule's own interval (0018) so each
// connection gets attempted roughly once per run, not hammered.
const SYNC_STALE_HOURS = 6;

type SyncFunctions = {
  admin_list_moodle_connections_due_for_sync: {
    Args: { p_stale_before: string };
    Returns: { user_id: string }[];
  };
  admin_get_moodle_token: {
    Args: { p_user_id: string };
    Returns: { token: string; site_url: string; available_functions: string[] }[];
  };
  admin_record_moodle_sync_result: {
    Args: { p_user_id: string; p_error: string | null; p_needs_reconnect: boolean };
    Returns: void;
  };
};

// Only this handler ever writes these four tables (see
// 0019_moodle_content.sql's own comment) — typed locally here rather than
// in supabase.ts's shared Database type for the same reason ai-cloud.ts
// keeps its RPCs local (see that file's comment).
type Row<T> = { Row: T; Insert: T; Update: Partial<T>; Relationships: [] };
type SyncTables = {
  moodle_courses: Row<{
    id: number;
    user_id: string;
    full_name: string;
    short_name: string;
    summary: string | null;
    course_image: string | null;
    lecturer_name: string | null;
    last_synced_at: string;
  }>;
  moodle_course_sections: Row<{
    course_id: number;
    user_id: string;
    section_id: number;
    name: string | null;
    position: number;
    summary: string | null;
  }>;
  moodle_course_modules: Row<{
    course_id: number;
    user_id: string;
    section_id: number;
    module_id: number;
    name: string;
    modname: string;
    url: string | null;
    contents: unknown;
  }>;
  moodle_grades: Row<{
    course_id: number;
    user_id: string;
    item_name: string;
    item_type: string | null;
    grade_raw: number | null;
    grade_formatted: string | null;
    grade_max: number | null;
    weight: number | null;
    feedback: string | null;
  }>;
};
export type AdminClient = SupabaseClient<{
  public: { Tables: SyncTables; Views: Record<string, never>; Functions: SyncFunctions };
}>;

/** Reads a server-only secret regardless of whether this deploys as a
 * Cloudflare Workers module (secrets on the `env` binding passed into
 * fetch) or a Node-style host like Vercel (`process.env`) — this
 * repo's real production host is unconfirmed (see the Moodle integration
 * plan's own notes), so this supports both rather than guessing. */
function readEnvVar(env: unknown, name: string): string | undefined {
  const fromBinding = (env as Record<string, string | undefined> | null | undefined)?.[name];
  if (fromBinding) return fromBinding;
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

type MoodleCourseApi = {
  id: number;
  fullname: string;
  shortname: string;
  summary?: string;
  courseimage?: string;
};
type MoodleEnrolledUser = { fullname: string; roles?: { shortname: string }[] };
type MoodleModule = { id: number; name: string; modname: string; url?: string; contents?: unknown };
type MoodleSection = { id: number; name?: string; summary?: string; modules?: MoodleModule[] };
type MoodleGradeItem = {
  itemname?: string;
  itemtype?: string;
  graderaw?: number;
  gradeformatted?: string;
  grademax?: number;
  weightraw?: number;
  feedback?: string;
};

/** `.upsert()` resolves with `{ error }` rather than rejecting — without
 * checking it, a real failure (RLS, a bad column, a missing table) here
 * silently no-ops instead of surfacing, which is exactly what happened
 * during Phase B verification: a real sync "succeeded" (null
 * last_sync_error) while writing zero rows. Wrapping every upsert in this
 * makes a write failure behave like any other thrown error here — caught
 * by syncOneConnection's own try/catch below and recorded via
 * admin_record_moodle_sync_result instead of vanishing. */
async function upsertOrThrow(
  promise: PromiseLike<{ error: { message: string } | null }>,
  what: string,
): Promise<void> {
  const { error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
}

/** Exported for moodle-server.ts's own immediate-sync trigger — see that
 * file's comment on why it now calls this directly, in-process, instead
 * of the HTTP self-call this used to be reached through exclusively. Both
 * remain valid callers: the scheduled cron job (via
 * handleMoodleCronSync, an actual separate top-level request) and now
 * also a connect/login handler's own request (a plain function call
 * within that same single invocation, no nested request involved). */
export async function syncOneConnection(admin: AdminClient, userId: string): Promise<void> {
  const { data: tokenRows, error: tokenError } = await admin.rpc("admin_get_moodle_token", {
    p_user_id: userId,
  });
  const tokenRow = tokenRows?.[0];
  if (tokenError || !tokenRow) {
    // Disconnected (or already needs_reconnect) between listing and now —
    // nothing to do, not an error.
    return;
  }
  const { token, site_url: siteUrl, available_functions: availableFunctions } = tokenRow;
  const has = (fn: string) => availableFunctions?.includes(fn) ?? false;

  try {
    if (!has("core_enrol_get_users_courses")) {
      throw new MoodleAuthError("core_enrol_get_users_courses is not enabled for this account");
    }
    // Also re-validates the token every run — an invalid/revoked token
    // throws MoodleAuthError here just as it would from any other call.
    const siteInfo = await moodleCall<{ userid: number }>(
      siteUrl,
      token,
      "core_webservice_get_site_info",
    );
    const courses = await moodleCall<MoodleCourseApi[]>(
      siteUrl,
      token,
      "core_enrol_get_users_courses",
      {
        userid: String(siteInfo.userid),
      },
    );

    // Rows here are keyed by (this app's own user_id, Moodle course id) —
    // correctly scoped per eLearn account, but a student can reconnect the
    // *same* eLearn account to a *different* real NUST Moodle identity
    // (their own credentials, then a friend's, or back again). Without
    // this, every course from a previously-connected identity just sits
    // here forever alongside the new one — nothing ever removed it — so
    // the student ends up seeing a mix of their own and a previously
    // connected account's courses/modules. Deleting anything no longer in
    // the just-fetched enrollment list (cascades to sections/modules/
    // grades via their FKs) makes this sync a real replace, not just an
    // upsert — also correctly drops a course the student simply left.
    const currentCourseIds = courses.map((c) => c.id);
    await upsertOrThrow(
      currentCourseIds.length > 0
        ? admin
            .from("moodle_courses")
            .delete()
            .eq("user_id", userId)
            .not("id", "in", `(${currentCourseIds.join(",")})`)
        : admin.from("moodle_courses").delete().eq("user_id", userId),
      "Removing courses no longer enrolled in",
    );

    for (const course of courses) {
      let lecturerName: string | null = null;
      if (has("core_enrol_get_enrolled_users")) {
        try {
          const enrolled = await moodleCall<MoodleEnrolledUser[]>(
            siteUrl,
            token,
            "core_enrol_get_enrolled_users",
            { courseid: String(course.id) },
          );
          const teacher = enrolled.find((u) =>
            u.roles?.some((r) => r.shortname === "editingteacher" || r.shortname === "teacher"),
          );
          lecturerName = teacher?.fullname ?? null;
        } catch (err) {
          // A missing lecturer name must never fail the whole course sync.
          console.error(`Couldn't fetch the teacher for course ${course.id}`, err);
        }
      }

      await upsertOrThrow(
        admin.from("moodle_courses").upsert({
          id: course.id,
          user_id: userId,
          full_name: course.fullname,
          short_name: course.shortname,
          summary: course.summary ?? null,
          course_image: course.courseimage ?? null,
          lecturer_name: lecturerName,
          last_synced_at: new Date().toISOString(),
        }),
        `Saving course ${course.id}`,
      );

      if (has("core_course_get_contents")) {
        try {
          const sections = await moodleCall<MoodleSection[]>(
            siteUrl,
            token,
            "core_course_get_contents",
            {
              courseid: String(course.id),
            },
          );
          for (const [index, section] of sections.entries()) {
            await upsertOrThrow(
              admin.from("moodle_course_sections").upsert({
                course_id: course.id,
                user_id: userId,
                section_id: section.id,
                name: section.name ?? null,
                position: index,
                summary: section.summary ?? null,
              }),
              `Saving section ${section.id} of course ${course.id}`,
            );
            for (const module of section.modules ?? []) {
              await upsertOrThrow(
                admin.from("moodle_course_modules").upsert({
                  course_id: course.id,
                  user_id: userId,
                  section_id: section.id,
                  module_id: module.id,
                  name: module.name,
                  modname: module.modname,
                  url: module.url ?? null,
                  contents: module.contents ?? null,
                }),
                `Saving module ${module.id} of course ${course.id}`,
              );
            }
          }
        } catch (err) {
          console.error(`Couldn't fetch materials for course ${course.id}`, err);
        }
      }

      // gradereport_user_get_grades_table returns HTML table cells, a
      // meaningfully different shape from get_grade_items' structured
      // objects (flagged as an open uncertainty in the integration plan)
      // — deliberately not parsed here. If only the table variant is
      // available on this NUST instance, grades are skipped for now
      // rather than guessing at an untested scraping approach.
      if (has("gradereport_user_get_grade_items")) {
        try {
          const gradeResp = await moodleCall<{ usergrades: { gradeitems: MoodleGradeItem[] }[] }>(
            siteUrl,
            token,
            "gradereport_user_get_grade_items",
            { courseid: String(course.id), userid: String(siteInfo.userid) },
          );
          const items = gradeResp.usergrades?.[0]?.gradeitems ?? [];
          for (const item of items) {
            await upsertOrThrow(
              admin.from("moodle_grades").upsert({
                course_id: course.id,
                user_id: userId,
                item_name: item.itemname ?? "Course total",
                item_type: item.itemtype ?? null,
                grade_raw: item.graderaw ?? null,
                grade_formatted: item.gradeformatted ?? null,
                grade_max: item.grademax ?? null,
                weight: item.weightraw ?? null,
                feedback: item.feedback ?? null,
              }),
              `Saving grade "${item.itemname}" for course ${course.id}`,
            );
          }
        } catch (err) {
          console.error(`Couldn't fetch grades for course ${course.id}`, err);
        }
      }
    }

    await admin.rpc("admin_record_moodle_sync_result", {
      p_user_id: userId,
      p_error: null,
      p_needs_reconnect: false,
    });
  } catch (err) {
    // A revoked/expired token permanently excludes this connection from
    // future runs (see admin_list_moodle_connections_due_for_sync) until
    // the student reconnects — no infinite retry loop against a dead
    // token. Any other failure just records the error and waits for the
    // next scheduled run rather than retrying immediately.
    const revoked =
      err instanceof MoodleAuthError &&
      /invalidtoken|invalid token|accessexception/i.test(err.message);
    await admin.rpc("admin_record_moodle_sync_result", {
      p_user_id: userId,
      p_error: err instanceof Error ? err.message : String(err),
      p_needs_reconnect: revoked,
    });
  }
}

export async function handleMoodleCronSync(request: Request, env: unknown): Promise<Response> {
  const expectedSecret = readEnvVar(env, "MOODLE_CRON_SECRET");
  if (!expectedSecret) {
    console.error("MOODLE_CRON_SECRET is not configured — refusing all cron-sync requests");
    return new Response("Not configured", { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const serviceRoleKey = readEnvVar(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    console.error(
      "Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for the Moodle cron sync job",
    );
    return new Response("Not configured", { status: 503 });
  }
  const admin = createClient(url, serviceRoleKey) as AdminClient;

  // An optional single-connection target (see moodle-server.ts's
  // triggerImmediateMoodleSync) — without this, a student's own
  // just-connected/just-logged-in sync had to wait behind *every other*
  // student's connection that happened to also be due at that same
  // moment, in the same request, before this endpoint even got to theirs.
  // With enough real connections that reliably blew past the 15s bound
  // that call sets on itself, so it silently never actually reached (or
  // finished) that one new connection at all — this real-device testing
  // finding is what surfaced it. The regular scheduled cron run (0018)
  // never sends this field, so it keeps syncing everyone due, unchanged.
  let targetUserId: string | undefined;
  try {
    const body: unknown = await request.json();
    if (
      body &&
      typeof body === "object" &&
      typeof (body as { user_id?: unknown }).user_id === "string"
    ) {
      targetUserId = (body as { user_id: string }).user_id;
    }
  } catch {
    // No body, or not JSON — falls through to the normal "sync everyone
    // due" path below, same as before this field existed.
  }

  let due: { user_id: string }[] | null;
  if (targetUserId) {
    due = [{ user_id: targetUserId }];
  } else {
    const staleBefore = new Date(Date.now() - SYNC_STALE_HOURS * 60 * 60 * 1000).toISOString();
    const { data, error: dueError } = await admin.rpc(
      "admin_list_moodle_connections_due_for_sync",
      {
        p_stale_before: staleBefore,
      },
    );
    if (dueError) {
      console.error("Failed to list Moodle connections due for sync", dueError);
      return new Response("Failed to list connections", { status: 500 });
    }
    due = data;
  }

  let synced = 0;
  let failed = 0;
  for (const { user_id: userId } of due ?? []) {
    try {
      await syncOneConnection(admin, userId);
      synced++;
    } catch (err) {
      failed++;
      console.error(`Moodle sync failed for user ${userId}`, err);
    }
  }

  return new Response(JSON.stringify({ due: due?.length ?? 0, synced, failed }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
