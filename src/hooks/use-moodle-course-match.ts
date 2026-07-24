// Suggests students to bulk-assign to an admin-authored catalog module by
// cross-referencing real NUST Moodle course data already synced per
// student (0019_moodle_content.sql) — a genuine "these students are all
// in the same real course/with the same lecturer" signal the previous
// one-student-at-a-time name search didn't use at all. See
// 0029_lecturer_moodle_course_access.sql for the new lecturer-read policy
// this depends on.
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Typed locally rather than added to supabase.ts's shared Database type —
// same reasoning as sync.ts's identical moodleContentClient (its own
// comment has the full explanation): this is the only place outside
// sync.ts that ever reads moodle_courses from the client, so a second,
// narrower local type here is more honest than widening the shared one
// for a single caller.
type MoodleCoursesTable = {
  moodle_courses: {
    Row: {
      id: number;
      user_id: string;
      short_name: string;
      full_name: string;
      lecturer_name: string | null;
    };
    Insert: never;
    Update: never;
    Relationships: [];
  };
};
const moodleCoursesClient = supabase as unknown as SupabaseClient<{
  public: {
    Tables: MoodleCoursesTable;
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}>;

export type MatchingStudent = {
  userId: string;
  fullName: string;
  courseFullName: string;
  courseLecturerName: string | null;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// A real course code/name rarely matches this app's own free-text module
// fields character-for-character (e.g. "CHE 205" here vs a real Moodle
// short name like "CHE205S_S1_2026") — bidirectional substring matching
// on the normalized (lowercased, punctuation/space-stripped) code is a
// deliberately loose heuristic, not an exact join. Every result is
// labeled a suggestion for the lecturer to review, never auto-added
// silently — same "admin confirms before it's real" discipline as the
// AI-generated quiz draft.
function isLikelyMatch(
  moduleCode: string,
  moduleLecturer: string,
  courseShortName: string,
  courseLecturerName: string | null,
): boolean {
  const normCode = normalize(moduleCode);
  const normShort = normalize(courseShortName);
  const codeMatches =
    normCode.length >= 3 && (normShort.includes(normCode) || normCode.includes(normShort));
  const lecturerSurname = moduleLecturer.trim().split(/\s+/).pop() ?? "";
  const lecturerMatches =
    lecturerSurname.length >= 3 &&
    !!courseLecturerName &&
    normalize(courseLecturerName).includes(normalize(lecturerSurname));
  return codeMatches || lecturerMatches;
}

/** Real students found via a matching real NUST course/lecturer, minus
 * anyone already on `excludeUserIds` (the module's current roster) — for
 * the admin console's "bulk-assign from a matching real course" flow. */
export function useMoodleCourseMatch(
  moduleCode: string,
  moduleLecturer: string,
  excludeUserIds: Set<string>,
): { matches: MatchingStudent[]; loading: boolean } {
  const [matches, setMatches] = useState<MatchingStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const excludeKey = [...excludeUserIds].sort().join(",");

  useEffect(() => {
    if (!moduleCode.trim() && !moduleLecturer.trim()) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void moodleCoursesClient
      .from("moodle_courses")
      .select("id, user_id, short_name, full_name, lecturer_name")
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load Moodle courses for matching", error);
          setMatches([]);
          setLoading(false);
          return;
        }
        const matchingRows = (data ?? []).filter(
          (row) =>
            isLikelyMatch(moduleCode, moduleLecturer, row.short_name, row.lecturer_name) &&
            !excludeUserIds.has(row.user_id),
        );
        if (matchingRows.length === 0) {
          setMatches([]);
          setLoading(false);
          return;
        }
        const userIds = [...new Set(matchingRows.map((r) => r.user_id))];
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        if (cancelled) return;
        if (profilesError) console.error("Failed to load profiles for course match", profilesError);
        const nameById = new Map((profileRows ?? []).map((p) => [p.id, p.full_name]));
        const seen = new Set<string>();
        const results: MatchingStudent[] = [];
        for (const row of matchingRows) {
          if (seen.has(row.user_id)) continue;
          seen.add(row.user_id);
          results.push({
            userId: row.user_id,
            fullName: nameById.get(row.user_id) ?? "Unknown student",
            courseFullName: row.full_name,
            courseLecturerName: row.lecturer_name,
          });
        }
        setMatches(results);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- excludeKey is the real dependency, see use-module-analytics.ts's identical reasoning for excludeUserIds's own unstable identity
  }, [moduleCode, moduleLecturer, excludeKey]);

  return { matches, loading };
}
