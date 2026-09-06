// eLearn: shared Moodle REST-call helper for the background sync job
// (moodle-cron-handler.ts) only. Deliberately a separate small file from
// moodle-server.ts (the connect flow) rather than sharing one — that file
// is imported by client-side code (moodle-cloud.ts) via its createServerFn
// export, and this job's logic has no reason to grow the surface of what
// gets pulled into the client bundle graph. moodle-cron-handler.ts is only
// ever reachable from src/server.ts, never from the browser.

export class MoodleAuthError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "MoodleAuthError";
  }
}

type MoodleErrorBody = { error?: string; errorcode?: string; exception?: string; message?: string };

function isMoodleError(body: unknown): body is MoodleErrorBody {
  const b = body as MoodleErrorBody;
  return (
    !!b && typeof b === "object" && (typeof b.error === "string" || typeof b.exception === "string")
  );
}

// Review follow-up: this call used to only ever be reached through an HTTP
// self-call that carried its own fetch timeout (see moodle-server.ts's
// runImmediateMoodleSync comment on why that self-call was removed) — once
// syncOneConnection started being invoked in-process instead, nothing here
// or in either caller bounded how long a single stalled elearning.nust.na
// request could hang for. A cron run (many of these calls per student,
// across every course) or an immediate post-connect sync (awaited directly
// by connectMoodleAccount) could then block indefinitely instead of failing
// fast, with no client-visible error until an unconfigured platform timeout
// eventually kills the whole request.
const MOODLE_CALL_TIMEOUT_MS = 20_000;

export async function moodleCall<T>(
  siteUrl: string,
  token: string,
  wsfunction: string,
  params: Record<string, string> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${siteUrl}/webservice/rest/server.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        wstoken: token,
        wsfunction,
        moodlewsrestformat: "json",
        ...params,
      }),
      signal: AbortSignal.timeout(MOODLE_CALL_TIMEOUT_MS),
    });
  } catch (err) {
    throw new MoodleAuthError(
      err instanceof Error
        ? `NUST eLearning is unreachable: ${err.message}`
        : "NUST eLearning is unreachable",
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await response.json().catch(() => null);
  if (isMoodleError(body)) {
    throw new MoodleAuthError(body.message ?? body.error ?? `Moodle call ${wsfunction} failed`);
  }
  return body as T;
}
