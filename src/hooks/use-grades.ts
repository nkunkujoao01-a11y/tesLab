// Lecturer-entered grades for a catalog module — see
// 0027_module_grades.sql for the full reasoning on why this is a
// separate system from the read-only moodleGrades pulled from a
// student's real NUST Moodle account (sync.ts/db.ts).
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type ModuleGrade = {
  id: string;
  moduleId: string;
  userId: string;
  label: string;
  score: number;
  maxScore: number;
  gradedAt: string;
};

/** Every grade recorded for `moduleId`, newest-first. Scoped to the
 * signed-in student's own rows automatically by RLS (see the migration's
 * "Students can view their own grades" policy) — a lecturer calling this
 * instead sees every student's grades in the module (their own "manage
 * grades" policy), so the *same* hook naturally serves both the admin
 * grades panel and a student's own grade view without needing two
 * separate query shapes. */
export function useModuleGrades(moduleId: string | null) {
  const [grades, setGrades] = useState<ModuleGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!moduleId) {
      setGrades([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("module_grades")
      .select("id, module_id, user_id, label, score, max_score, graded_at")
      .eq("module_id", moduleId)
      .order("graded_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Failed to load grades", error);
        setGrades(
          (data ?? []).map((g) => ({
            id: g.id,
            moduleId: g.module_id,
            userId: g.user_id,
            label: g.label,
            score: g.score,
            maxScore: g.max_score,
            gradedAt: g.graded_at,
          })),
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId, refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { grades, loading, refetch };
}

export type NewGradeInput = {
  moduleId: string;
  userId: string;
  label: string;
  score: number;
  maxScore: number;
};

/** Records or removes one graded item — lecturer-only, enforced by
 * 0027_module_grades.sql's "Lecturers can manage grades" RLS policy, same
 * "fails cleanly with a real Postgres error, not a hidden button" model
 * use-catalog-admin.ts already established. */
export function useManageGrades() {
  const { user } = useAuth();
  const [mutating, setMutating] = useState(false);

  const recordGrade = useCallback(
    async (input: NewGradeInput) => {
      if (
        !input.label.trim() ||
        !Number.isFinite(input.score) ||
        !Number.isFinite(input.maxScore)
      ) {
        return false;
      }
      setMutating(true);
      try {
        const { error } = await supabase.from("module_grades").insert({
          id: crypto.randomUUID(),
          module_id: input.moduleId,
          user_id: input.userId,
          label: input.label.trim(),
          score: input.score,
          max_score: input.maxScore,
          graded_at: new Date().toISOString(),
          graded_by: user?.id ?? null,
        });
        if (error) {
          console.error("Failed to record grade", error);
          toast.error(
            error.code === "42501"
              ? "Your account isn't set up as a lecturer yet."
              : "Couldn't record that grade. Try again.",
          );
          return false;
        }
        return true;
      } finally {
        setMutating(false);
      }
    },
    [user],
  );

  const deleteGrade = useCallback(async (gradeId: string) => {
    setMutating(true);
    try {
      const { error } = await supabase.from("module_grades").delete().eq("id", gradeId);
      if (error) {
        console.error("Failed to delete grade", error);
        toast.error("Couldn't remove that grade. Try again.");
        return false;
      }
      return true;
    } finally {
      setMutating(false);
    }
  }, []);

  return { recordGrade, deleteGrade, mutating };
}
