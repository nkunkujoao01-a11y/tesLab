// eLearn: connect a student's real NUST eLearning (Moodle) account — see
// supabase/migrations/0017_moodle_connections.sql and moodle-server.ts for
// the full design. This module is the client-side entry point: it never
// touches the student's password beyond handing it to connectMoodleAccount
// (a TanStack Start server function — see that file for why), and never
// receives the Moodle token back — only a connected/fullName/reason result.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { connectMoodleAccount, loginWithNustCredentials } from "@/lib/moodle-server";

// Typed locally rather than added to supabase.ts's shared Database type —
// see ai-cloud.ts's identical comment for why.
type MoodleCloudFunctions = {
  has_moodle_connection: { Args: Record<string, never>; Returns: boolean };
  get_moodle_connection_status: {
    Args: Record<string, never>;
    Returns: {
      connected: boolean;
      needs_reconnect: boolean;
      full_name: string | null;
      last_sync_at: string | null;
      last_sync_error: string | null;
    }[];
  };
  clear_moodle_connection: { Args: Record<string, never>; Returns: void };
};
const rpc = supabase as unknown as SupabaseClient<{
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: MoodleCloudFunctions;
  };
}>;

export type MoodleConnectionStatus = {
  connected: boolean;
  needsReconnect: boolean;
  fullName: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

const DISCONNECTED_STATUS: MoodleConnectionStatus = {
  connected: false,
  needsReconnect: false,
  fullName: null,
  lastSyncAt: null,
  lastSyncError: null,
};

export async function hasMoodleConnection(): Promise<boolean> {
  const { data, error } = await rpc.rpc("has_moodle_connection");
  if (error) {
    console.error("Failed to check for a connected Moodle account", error);
    return false;
  }
  return Boolean(data);
}

export async function getMoodleConnectionStatus(): Promise<MoodleConnectionStatus> {
  const { data, error } = await rpc.rpc("get_moodle_connection_status");
  if (error) {
    console.error("Failed to read Moodle connection status", error);
    return DISCONNECTED_STATUS;
  }
  const row = data?.[0];
  if (!row) return DISCONNECTED_STATUS;
  return {
    connected: row.connected,
    needsReconnect: row.needs_reconnect,
    fullName: row.full_name,
    lastSyncAt: row.last_sync_at,
    lastSyncError: row.last_sync_error,
  };
}

export type ConnectMoodleResult =
  | { connected: true; fullName: string }
  | {
      connected: false;
      reason: "invalid_credentials" | "service_unavailable" | "unexpected" | "not_signed_in";
    };

/** Sends the student's NUST student number + password to our own server
 * once (never to Moodle directly from the browser — see moodle-server.ts)
 * to mint a token, which the server then stores encrypted under this
 * signed-in account. The password never returns from this call in any
 * form, success or failure. */
export async function connectMoodle(
  studentNumber: string,
  password: string,
): Promise<ConnectMoodleResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { connected: false, reason: "not_signed_in" };

  return connectMoodleAccount({
    data: { studentNumber: studentNumber.trim(), password, accessToken: session.access_token },
  });
}

export async function disconnectMoodle(): Promise<void> {
  const { error } = await rpc.rpc("clear_moodle_connection");
  if (error) throw error;
}

export type NustLoginResult =
  | { signedIn: true; fullName: string }
  | { signedIn: false; reason: "invalid_credentials" | "unexpected" };

/** Logs in with a NUST student number + password instead of an eLearn
 * email — see loginWithNustCredentials (moodle-server.ts) for the full
 * server-side design. That server function verifies against Moodle and
 * returns a one-time `token_hash`; redeeming it here via `verifyOtp` is
 * what actually establishes this browser's real Supabase session — the
 * server itself never holds or returns a session token directly. */
export async function loginWithNust(
  studentNumber: string,
  password: string,
): Promise<NustLoginResult> {
  const result = await loginWithNustCredentials({ data: { studentNumber, password } });
  if (!result.ok) {
    return { signedIn: false, reason: result.reason };
  }
  const { error } = await supabase.auth.verifyOtp({
    token_hash: result.tokenHash,
    type: "magiclink",
  });
  if (error) {
    console.error("Failed to redeem NUST login session", error);
    return { signedIn: false, reason: "unexpected" };
  }
  return { signedIn: true, fullName: result.fullName };
}
