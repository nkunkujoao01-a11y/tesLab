// Module enrollment/roster — see DEV_LOG.md, Feature 58. A roster
// concept, not an access gate: every module stays publicly readable, this
// just tracks who's told the app they're taking it, and lets a lecturer
// see the resulting list. Fetched directly from Supabase (not cached in
// IndexedDB like catalog content) — membership status needs to reflect
// reality across a student's devices immediately, not the "seen at least
// once, might be stale" contract modules-api.ts's cache deliberately
// accepts for read-only catalog browsing.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

/** Whether the signed-in user is enrolled in `moduleId`, plus a toggle. */
export function useModuleEnrollment(moduleId: string) {
  const { user } = useAuth();
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setEnrolled(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    void supabase
      .from("module_enrollments")
      .select("module_id")
      .eq("user_id", user.id)
      .eq("module_id", moduleId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Failed to read enrollment status", error);
        setEnrolled(Boolean(data));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, moduleId]);

  const toggle = useCallback(async () => {
    if (!user) return;
    setToggling(true);
    try {
      if (enrolled) {
        const { error } = await supabase
          .from("module_enrollments")
          .delete()
          .eq("user_id", user.id)
          .eq("module_id", moduleId);
        if (error) {
          console.error("Failed to unenrol", error);
          toast.error("Couldn't update your enrolment. Try again.");
          return;
        }
        setEnrolled(false);
      } else {
        const { error } = await supabase
          .from("module_enrollments")
          .insert({ user_id: user.id, module_id: moduleId });
        if (error) {
          console.error("Failed to enrol", error);
          toast.error("Couldn't update your enrolment. Try again.");
          return;
        }
        setEnrolled(true);
      }
    } finally {
      setToggling(false);
    }
  }, [user, moduleId, enrolled]);

  return { enrolled, loading, toggling, toggle };
}

export type RosterEntry = {
  userId: string;
  fullName: string;
  enrolledAt: string;
};

/** Every student enrolled in `moduleId`, newest-first — for the admin
 * roster view. Requires the "Lecturers can view all enrollments"/"...all
 * profiles" RLS policies (0011_module_enrollments.sql); a non-lecturer
 * calling this just gets an empty list back from RLS, not an error.
 * Two real queries, not a PostgREST embedded join — `module_enrollments`
 * has no direct foreign key to `public.profiles` (both merely reference
 * `auth.users` independently), so a `profiles(full_name)` embed isn't a
 * relationship PostgREST can infer; joining client-side avoids relying on
 * one that doesn't exist. Exposes `refetch` so a caller that just
 * assigned/removed a student (useAdminManageEnrollment below) can refresh
 * this same list instead of it silently going stale until next mount. */
export function useModuleRoster(moduleId: string | null) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!moduleId) {
      setRoster([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("module_enrollments")
        .select("user_id, enrolled_at")
        .eq("module_id", moduleId)
        .order("enrolled_at", { ascending: false });
      if (cancelled) return;
      if (enrollmentsError || !enrollments || enrollments.length === 0) {
        if (enrollmentsError) console.error("Failed to load roster", enrollmentsError);
        setRoster([]);
        setLoading(false);
        return;
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          enrollments.map((e) => e.user_id),
        );
      if (cancelled) return;
      if (profilesError) console.error("Failed to load roster profiles", profilesError);
      const nameById = new Map((profileRows ?? []).map((p) => [p.id, p.full_name]));

      setRoster(
        enrollments.map((e) => ({
          userId: e.user_id,
          fullName: nameById.get(e.user_id) ?? "Unknown student",
          enrolledAt: e.enrolled_at,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [moduleId, refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { roster, loading, refetch };
}

export type StudentSearchResult = { userId: string; fullName: string };

// A short debounce, not "search on every keystroke" — a real query per
// keystroke against `profiles` is wasted work for a name still being
// typed, and this is a lecturer typing a student's name, not a
// latency-critical interaction.
const SEARCH_DEBOUNCE_MS = 300;

/** Searches student profiles by name for the "assign a student" flow —
 * `full_name` is the only searchable, non-identifying field `profiles`
 * actually has (see 0001_init.sql; no student-number/email column
 * exists on this table), same "Lecturers can view all profiles" RLS
 * policy the roster view above already relies on. Empty query returns no
 * results rather than the whole student body. */
export function useSearchStudents(query: string): {
  results: StudentSearchResult[];
  searching: boolean;
} {
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeoutId = setTimeout(() => {
      void supabase
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${trimmed}%`)
        .limit(8)
        .then(({ data, error }) => {
          if (error) console.error("Failed to search students", error);
          setResults((data ?? []).map((p) => ({ userId: p.id, fullName: p.full_name })));
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [query]);

  return { results, searching };
}

/** Lecturer-initiated enrollment management — assign a student found via
 * useSearchStudents, or remove one from the roster. Distinct from
 * useModuleEnrollment above (a student's own self-service toggle): same
 * underlying table, but this acts *on behalf of* another user, which only
 * the "Lecturers can manage any enrollment" RLS policy
 * (0026_admin_manage_enrollment.sql) permits. */
export function useAdminManageEnrollment(moduleId: string) {
  const [mutating, setMutating] = useState(false);

  const assignStudent = useCallback(
    async (userId: string) => {
      setMutating(true);
      try {
        const { error } = await supabase
          .from("module_enrollments")
          .insert({ user_id: userId, module_id: moduleId });
        if (error) {
          // A student already enrolled hits the primary-key conflict —
          // not a real failure, the end state is exactly what was asked
          // for, so this is treated as success rather than an error toast.
          if (error.code === "23505") return true;
          console.error("Failed to assign student", error);
          toast.error("Couldn't assign that student. Try again.");
          return false;
        }
        return true;
      } finally {
        setMutating(false);
      }
    },
    [moduleId],
  );

  const removeStudent = useCallback(
    async (userId: string) => {
      setMutating(true);
      try {
        const { error } = await supabase
          .from("module_enrollments")
          .delete()
          .eq("user_id", userId)
          .eq("module_id", moduleId);
        if (error) {
          console.error("Failed to remove student", error);
          toast.error("Couldn't remove that student. Try again.");
          return false;
        }
        return true;
      } finally {
        setMutating(false);
      }
    },
    [moduleId],
  );

  return { assignStudent, removeStudent, mutating };
}
