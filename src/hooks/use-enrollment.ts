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
 * one that doesn't exist. */
export function useModuleRoster(moduleId: string | null) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, [moduleId]);

  return { roster, loading };
}
