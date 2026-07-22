// eLearn: server-only Moodle (NUST eLearning) HTTP calls.
//
// Everything here runs only inside connectMoodleAccount's createServerFn
// handler (TanStack Start compiles the handler out of the client bundle,
// leaving only a thin fetcher stub there) — never import the raw helpers
// below from client-reachable code. This exists specifically so the
// student's NUST password touches exactly one network hop (browser -> our
// own server -> Moodle's own login/token.php) and is never logged, stored,
// or echoed back — see supabase/migrations/0017_moodle_connections.sql's
// own header comment for the full reasoning.
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Typed locally rather than added to supabase.ts's shared Database type —
// see ai-cloud.ts's identical comment for why: populating the shared type
// with these broke unrelated embedded-relationship `.select()` type
// inference elsewhere in the app.
type SaveMoodleConnectionFn = {
  save_moodle_connection: {
    Args: {
      p_moodle_user_id: number;
      p_token: string;
      p_full_name: string;
      p_available_functions: string[];
    };
    Returns: void;
  };
};

const MOODLE_BASE_URL = "https://elearning.nust.na";
const MOODLE_SERVICE = "moodle_mobile_app";

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

/** Exchanges username+password for a revocable wstoken, exactly once —
 * Moodle's own documented mobile-app login flow. Never called again after
 * this; every later Moodle call uses only the returned token. */
async function moodleLoginToken(username: string, password: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${MOODLE_BASE_URL}/login/token.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password, service: MOODLE_SERVICE }),
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
    // Moodle's own error text (e.g. "Invalid login, please try again") is
    // safe to surface — it never echoes the submitted password back.
    throw new MoodleAuthError(
      body.error ?? body.message ?? "NUST eLearning rejected those credentials",
    );
  }
  if (typeof body?.token !== "string" || !body.token) {
    throw new MoodleAuthError("NUST eLearning didn't return a usable token");
  }
  return body.token;
}

type MoodleSiteInfo = { userid: number; fullname: string; functions: { name: string }[] };

async function moodleCallFunction<T>(
  token: string,
  wsfunction: string,
  params: Record<string, string> = {},
) {
  let response: Response;
  try {
    response = await fetch(`${MOODLE_BASE_URL}/webservice/rest/server.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        wstoken: token,
        wsfunction,
        moodlewsrestformat: "json",
        ...params,
      }),
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

/** core_webservice_get_site_info — called right after minting a token to
 * validate it actually works and capture which webservice functions
 * NUST's admin enabled for this service (see the migration's own comment
 * on `available_functions` — the sync job must degrade gracefully around
 * whatever subset is actually available, not assume a fixed list). */
async function moodleGetSiteInfo(token: string): Promise<MoodleSiteInfo> {
  return moodleCallFunction<MoodleSiteInfo>(token, "core_webservice_get_site_info");
}

type ConnectInput = { studentNumber: string; password: string; accessToken: string };
type ConnectResult =
  | { connected: true; fullName: string }
  | { connected: false; reason: "invalid_credentials" | "service_unavailable" | "unexpected" };

/** The one and only place the student's NUST password exists — a local
 * variable inside this handler's own scope, passed straight into the
 * outbound fetch and never referenced again. See this file's header
 * comment. `accessToken` is the caller's own Supabase session token,
 * forwarded so the save_moodle_connection RPC below runs as that same
 * user (auth.uid() inside the RPC), not via any elevated privilege — this
 * connect flow needs none. */
export const connectMoodleAccount = createServerFn({ method: "POST" })
  .validator((data: ConnectInput) => data)
  .handler(async ({ data }): Promise<ConnectResult> => {
    const { studentNumber, password, accessToken } = data;

    let token: string;
    let siteInfo: MoodleSiteInfo;
    try {
      token = await moodleLoginToken(studentNumber, password);
      siteInfo = await moodleGetSiteInfo(token);
    } catch (err) {
      if (err instanceof MoodleAuthError) {
        console.error("Moodle connect failed:", err.message);
        return { connected: false, reason: "invalid_credentials" };
      }
      console.error("Unexpected error connecting Moodle account", err);
      return { connected: false, reason: "unexpected" };
    }

    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY on the server");
      return { connected: false, reason: "unexpected" };
    }
    // Scoped to the caller's own JWT (not a service-role client) — this
    // RPC call is subject to the exact same auth.uid() check as if the
    // browser had called it directly.
    const userScopedClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }) as unknown as SupabaseClient<{
      public: {
        Tables: Record<string, never>;
        Views: Record<string, never>;
        Functions: SaveMoodleConnectionFn;
      };
    }>;
    const { error } = await userScopedClient.rpc("save_moodle_connection", {
      p_moodle_user_id: siteInfo.userid,
      p_token: token,
      p_full_name: siteInfo.fullname,
      p_available_functions: siteInfo.functions.map((f) => f.name),
    });
    if (error) {
      console.error("Failed to save Moodle connection", error);
      return { connected: false, reason: "unexpected" };
    }

    return { connected: true, fullName: siteInfo.fullname };
  });
