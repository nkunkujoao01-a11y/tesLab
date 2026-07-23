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

/** Best-effort: nudges the same cron-triggered sync endpoint
 * (moodle-cron-handler.ts) right after a successful connect, instead of
 * making the student wait up to SYNC_STALE_HOURS for their first real
 * course to show up — a brand-new (or just-reconnected) connection's
 * last_sync_at is null, which already always counts as "due," so this is
 * just pulling that forward in time, not new sync logic. Passing
 * `user_id` scopes this call to *just* this one connection (see
 * handleMoodleCronSync's own comment) — real-device testing found that
 * without it, this call synced *every* connection due at that moment, in
 * one request, and reliably blew past its own timeout with more than a
 * couple of real connections in play, silently never reaching (or
 * finishing) the one connection this call actually exists for. A plain
 * HTTP self-call (not a direct import of moodle-cron-handler.ts)
 * deliberately keeps this client-reachable file's import graph as small
 * as moodle-sync-server.ts's own header comment already establishes for
 * the cron-only side. Still bounded with a timeout so a slow/busy sync
 * can never hang the connect/login response itself — on timeout or any
 * failure, the next scheduled cron run still covers this connection
 * regardless. */
async function triggerImmediateMoodleSync(userId: string): Promise<void> {
  const cronSecret = process.env.MOODLE_CRON_SECRET;
  const vercelUrl = process.env.VERCEL_URL;
  if (!cronSecret || !vercelUrl) return;
  try {
    await fetch(`https://${vercelUrl}/api/moodle/cron-sync`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": cronSecret },
      body: JSON.stringify({ user_id: userId }),
      signal: AbortSignal.timeout(25000),
    });
  } catch (err) {
    console.error("Best-effort immediate Moodle sync failed to trigger", err);
  }
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

    // getUser(jwt) validates/introspects the caller's own token directly —
    // no local session needed on this server-side client, just the id it
    // already asserts via that same token save_moodle_connection above
    // ran under.
    const {
      data: { user: callerUser },
    } = await userScopedClient.auth.getUser(accessToken);
    if (callerUser) {
      await triggerImmediateMoodleSync(callerUser.id);
    }
    return { connected: true, fullName: siteInfo.fullname };
  });

type AdminSaveMoodleConnectionFn = {
  admin_save_moodle_connection: {
    Args: {
      p_user_id: string;
      p_moodle_user_id: number;
      p_token: string;
      p_full_name: string;
      p_available_functions: string[];
    };
    Returns: void;
  };
};

// .invalid is IANA-reserved (RFC 2606) specifically for non-resolvable
// placeholder use like this — a deterministic, collision-safe mapping
// from a real NUST student number to a synthetic auth.users email, so no
// real student's own separate Gmail/other signup could ever land on the
// same address by coincidence.
const NUST_LOGIN_EMAIL_DOMAIN = "nust-student.invalid";

function studentNumberToEmail(studentNumber: string): string {
  return `${studentNumber.trim().toLowerCase()}@${NUST_LOGIN_EMAIL_DOMAIN}`;
}

type NustLoginInput = { studentNumber: string; password: string };
type NustLoginResult =
  | { ok: true; email: string; loginPassword: string; fullName: string }
  | { ok: false; reason: "invalid_credentials" | "unexpected" };

/** Logs a student in with only their real NUST student number + password —
 * no separate eLearn signup, no separate "connect Moodle" step in
 * Settings afterward. Moodle's own login/token.php is the actual identity
 * check here (same one-hop-only password handling as connectMoodleAccount
 * above — this student's NUST password still never touches anything but
 * that one outbound call). studentNumberToEmail deterministically maps
 * that verified identity onto a real Supabase auth user: `generateLink`
 * with `type: "magiclink"` finds-or-creates that user (see the installed
 * @supabase/auth-js types — "generateLink() handles the creation of the
 * user for signup, invite and magiclink") purely to get a reliable user
 * id back, not to use its token — redeeming that token via
 * `verifyOtp({ type: "magiclink" })` turned out to fail in practice
 * ("Email link is invalid or has expired") for reasons not worth chasing
 * further, given `updateUserById` + the browser's own already-proven
 * `signInWithPassword` do the exact same job through a fully standard,
 * already-working path elsewhere in this app: this handler sets a fresh,
 * random, single-use password on that account, hands it to the browser
 * once over this same server-authenticated response, and the browser
 * signs in with it immediately — this student never sees or needs to
 * remember it, and it's overwritten by a new random one on every login.
 *
 * A student who separately signs up with a real email/password *and*
 * also uses this NUST-login path ends up with two distinct accounts (one
 * keyed by their student number, one by their real email) — no automatic
 * merge; a real, known limitation, not an oversight, and out of scope for
 * this pass. */
export const loginWithNustCredentials = createServerFn({ method: "POST" })
  .validator((data: NustLoginInput) => data)
  .handler(async ({ data }): Promise<NustLoginResult> => {
    const { studentNumber, password } = data;

    let token: string;
    let siteInfo: MoodleSiteInfo;
    try {
      token = await moodleLoginToken(studentNumber, password);
      siteInfo = await moodleGetSiteInfo(token);
    } catch (err) {
      if (err instanceof MoodleAuthError) {
        console.error("NUST login failed:", err.message);
        return { ok: false, reason: "invalid_credentials" };
      }
      console.error("Unexpected error during NUST login", err);
      return { ok: false, reason: "unexpected" };
    }

    const url = import.meta.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      console.error("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for NUST login");
      return { ok: false, reason: "unexpected" };
    }
    const admin = createClient(url, serviceRoleKey) as unknown as SupabaseClient<{
      public: {
        Tables: Record<string, never>;
        Views: Record<string, never>;
        Functions: AdminSaveMoodleConnectionFn;
      };
    }>;

    const email = studentNumberToEmail(studentNumber);
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { data: { full_name: siteInfo.fullname } },
    });
    if (linkError || !linkData?.user) {
      console.error("Failed to find or create a Supabase account for NUST login", linkError);
      return { ok: false, reason: "unexpected" };
    }

    // A fresh, random, single-use password — this student never sees or
    // needs it, and the next login overwrites it again. See this
    // function's own comment for why this replaces the OTP/magiclink
    // redemption path that was here before.
    const loginPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { error: passwordError } = await admin.auth.admin.updateUserById(linkData.user.id, {
      password: loginPassword,
      // Explicit regardless of this project's own "Confirm email" auth
      // setting — a signInWithPassword call for an unconfirmed address
      // would otherwise fail here specifically for a student's very
      // first NUST login (the moment generateLink just created them),
      // which no real signup flow exists to ever confirm on their behalf.
      email_confirm: true,
    });
    if (passwordError) {
      console.error("Failed to set a login password for NUST login", passwordError);
      return { ok: false, reason: "unexpected" };
    }

    const { error: saveError } = await admin.rpc("admin_save_moodle_connection", {
      p_user_id: linkData.user.id,
      p_moodle_user_id: siteInfo.userid,
      p_token: token,
      p_full_name: siteInfo.fullname,
      p_available_functions: siteInfo.functions.map((f) => f.name),
    });
    if (saveError) {
      console.error("Failed to save Moodle connection for NUST login", saveError);
      // The session itself still works even if this one save fails — a
      // student can still sign in; they'd just need to connect Moodle
      // from Settings afterward instead of it having happened
      // automatically, same degrade-gracefully discipline as the rest of
      // this file.
    }

    await triggerImmediateMoodleSync(linkData.user.id);
    return { ok: true, email, loginPassword, fullName: siteInfo.fullname };
  });

type GetOwnMoodleFileTokenFn = {
  get_own_moodle_file_token: { Args: Record<string, never>; Returns: string };
};

type FetchFileInput = { fileUrl: string; accessToken: string };
type FetchFileResult =
  | { ok: true; contentType: string; base64: string }
  | { ok: false; reason: "not_connected" | "fetch_failed" | "unexpected" };

// Moodle's file URLs (pluginfile.php/...) require ?token=<wstoken> to be
// fetchable without a separate browser login session — appending it here,
// server-side, means the token is never present in any client-visible URL
// (browser history, Referer header, etc.), unlike a direct <a href> would
// be. Returns the file as base64 rather than a streamed Response: this
// server function is invoked the same client-callable way
// connectMoodleAccount is (see moodle-cloud.ts), and a plain
// JSON-serializable return value is the well-supported path through that
// call convention — fine for the lecture-note-sized files this feature
// actually deals with.
export const fetchMoodleFile = createServerFn({ method: "POST" })
  .validator((data: FetchFileInput) => data)
  .handler(async ({ data }): Promise<FetchFileResult> => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY on the server");
      return { ok: false, reason: "unexpected" };
    }
    const userScopedClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    }) as unknown as SupabaseClient<{
      public: {
        Tables: Record<string, never>;
        Views: Record<string, never>;
        Functions: GetOwnMoodleFileTokenFn;
      };
    }>;
    const { data: token, error } = await userScopedClient.rpc("get_own_moodle_file_token");
    if (error || !token) {
      console.error("Failed to get own Moodle file token", error);
      return { ok: false, reason: "not_connected" };
    }

    const separator = data.fileUrl.includes("?") ? "&" : "?";
    let response: Response;
    try {
      response = await fetch(`${data.fileUrl}${separator}token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.error("Failed to fetch Moodle file", err);
      return { ok: false, reason: "fetch_failed" };
    }
    if (!response.ok) {
      console.error(`Moodle file fetch failed: ${response.status}`);
      return { ok: false, reason: "fetch_failed" };
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { ok: true, contentType, base64: btoa(binary) };
  });
