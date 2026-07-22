// eLearn: pulls a Moodle resource's actual file into this app (see
// fetchMoodleFile, moodle-server.ts) instead of linking out to the NUST
// site — the whole point of this feature being "your materials, in this
// app," not a bookmark list back to elearning.nust.na.
import { supabase } from "@/lib/supabase";
import { fetchMoodleFile } from "@/lib/moodle-server";
import { getUserDb } from "@/lib/db";

type RawMoodleFileEntry = { fileurl?: string; filename?: string; mimetype?: string };

export type MoodleModuleFileMeta = { fileUrl: string; fileName: string; mimeType: string };

/** Moodle's core_course_get_contents returns each resource's actual
 * file(s) (if any) inside a `contents` array — stored as-is in
 * MoodleCourseModule.contents (see db.ts). A plain resource has exactly
 * one file; a folder can have several — all of them are extracted here so
 * the UI can offer a picker rather than silently dropping every file past
 * the first. */
export function extractModuleFiles(contents: unknown): MoodleModuleFileMeta[] {
  if (!Array.isArray(contents)) return [];
  return (contents as RawMoodleFileEntry[])
    .filter(
      (c): c is RawMoodleFileEntry & { fileurl: string } => !!c && typeof c.fileurl === "string",
    )
    .map((entry) => ({
      fileUrl: entry.fileurl,
      fileName: entry.filename ?? "file",
      mimeType: entry.mimetype ?? "application/octet-stream",
    }));
}

export function extractModuleFile(contents: unknown): MoodleModuleFileMeta | null {
  return extractModuleFiles(contents)[0] ?? null;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export type MoodleFileFetchResult =
  | { ok: true; objectUrl: string; mimeType: string }
  | { ok: false; reason: "not_connected" | "fetch_failed" | "unexpected" | "not_signed_in" };

/** Returns a browser Object URL for a module's file — from the local
 * Dexie cache if this device has already fetched it, otherwise via the
 * server-side proxy (which appends the student's own Moodle token
 * server-side, never client-visible), caching the result for next time. */
export async function getMoodleFileUrl(
  userId: string,
  moduleKey: string,
  fileMeta: MoodleModuleFileMeta,
): Promise<MoodleFileFetchResult> {
  const db = getUserDb(userId);
  const cached = await db.moodleFiles.get(moduleKey);
  if (cached) {
    return { ok: true, objectUrl: URL.createObjectURL(cached.blob), mimeType: cached.mimeType };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, reason: "not_signed_in" };

  const result = await fetchMoodleFile({
    data: { fileUrl: fileMeta.fileUrl, accessToken: session.access_token },
  });
  if (!result.ok) return { ok: false, reason: result.reason };

  const blob = base64ToBlob(result.base64, result.contentType);
  await db.moodleFiles.put({
    moduleKey,
    blob,
    mimeType: result.contentType,
    fetchedAt: Date.now(),
  });
  return { ok: true, objectUrl: URL.createObjectURL(blob), mimeType: result.contentType };
}
