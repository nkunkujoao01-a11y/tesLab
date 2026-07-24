import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase, type MaterialContent } from "@/lib/supabase";
import type { QuizQuestion } from "@/lib/quiz-gen";

/** Slugifies a module code into a short, url-safe id matching the seed
 * data's convention ("SEN 301" -> "sen-301") — real modules need a real
 * primary key, and reusing the code itself (rather than a random uuid)
 * keeps ids readable in URLs the same way the seed data's do. Falls back
 * to a random suffix on a genuine collision (caught via the insert's own
 * error, not guessed at in advance) rather than silently overwriting an
 * existing module that happens to share a code. */
function slugify(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type NewModuleInput = {
  code: string;
  faculty: string;
  title: string;
  chapter: string;
  lecturer: string;
  totalLessons: number;
  summary: string;
};

/** Creates a new shared-catalog module. Requires the signed-in user's own
 * `profiles.is_lecturer` flag to be true — enforced by RLS
 * (0008_lecturer_role.sql), not just hidden in the UI, so this call
 * fails cleanly with a real Postgres error for anyone without it rather
 * than silently succeeding for someone who bypassed a hidden button. */
export function useCreateModule() {
  const [creating, setCreating] = useState(false);

  const createModule = useCallback(async (input: NewModuleInput) => {
    setCreating(true);
    try {
      let id = slugify(input.code);
      if (!id) {
        toast.error("Module code can't be empty.");
        return null;
      }
      const { error } = await supabase.from("modules").insert({
        id,
        code: input.code.trim(),
        faculty: input.faculty.trim(),
        title: input.title.trim(),
        chapter: input.chapter.trim(),
        lecturer: input.lecturer.trim(),
        size_mb: 0,
        summary: input.summary.trim(),
        total_lessons: input.totalLessons,
      });
      if (error) {
        // A real collision (same code used twice) rather than a guessed-at
        // check beforehand — retry once with a short random suffix.
        if (error.code === "23505") {
          id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
          const retry = await supabase.from("modules").insert({
            id,
            code: input.code.trim(),
            faculty: input.faculty.trim(),
            title: input.title.trim(),
            chapter: input.chapter.trim(),
            lecturer: input.lecturer.trim(),
            size_mb: 0,
            summary: input.summary.trim(),
            total_lessons: input.totalLessons,
          });
          if (retry.error) {
            console.error("Failed to create module", retry.error);
            toast.error("Couldn't create the module. Try again.");
            return null;
          }
          return id;
        }
        console.error("Failed to create module", error);
        toast.error(
          error.code === "42501"
            ? "Your account isn't set up as a lecturer yet."
            : "Couldn't create the module. Try again.",
        );
        return null;
      }
      return id;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createModule, creating };
}

export type NewMaterialInput = {
  moduleId: string;
  title: string;
  kind: string;
  pages: number;
  sizeMb: number;
  content: MaterialContent;
};

export function useCreateMaterial() {
  const [creating, setCreating] = useState(false);

  const createMaterial = useCallback(async (input: NewMaterialInput) => {
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from("materials").insert({
        id,
        module_id: input.moduleId,
        title: input.title.trim(),
        kind: input.kind,
        pages: input.pages,
        size_mb: input.sizeMb,
        content: input.content,
      });
      if (error) {
        console.error("Failed to create material", error);
        toast.error(
          error.code === "42501"
            ? "Your account isn't set up as a lecturer yet."
            : "Couldn't add the material. Try again.",
        );
        return null;
      }
      // Update the module's own size_mb — materials.size_mb rows are the
      // real source, but the module row keeps its own total for the
      // catalog grid's badge (see courses.index.tsx), same as how the
      // seed data's module.size_mb values were pre-summed by hand.
      const { data: rows } = await supabase
        .from("materials")
        .select("size_mb")
        .eq("module_id", input.moduleId);
      const total = (rows ?? []).reduce((sum, r) => sum + r.size_mb, 0);
      await supabase.from("modules").update({ size_mb: total }).eq("id", input.moduleId);
      return id;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createMaterial, creating };
}

export type NewModuleQuizQuestionInput = QuizQuestion & { moduleId: string };

/** Adds one question to a module's shared, admin-authored quiz — see
 * Feature 57. Same lecturer-only RLS gate as materials
 * (0010_module_quizzes.sql), one row per question rather than one row per
 * whole quiz, matching how materials are added one at a time too. */
export function useCreateModuleQuizQuestion() {
  const [creating, setCreating] = useState(false);

  const createModuleQuizQuestion = useCallback(async (input: NewModuleQuizQuestionInput) => {
    setCreating(true);
    try {
      const { error } = await supabase.from("module_quizzes").insert({
        id: crypto.randomUUID(),
        module_id: input.moduleId,
        question: input.question.trim(),
        options: input.options.map((o) => o.trim()),
        correct_index: input.correctIndex,
      });
      if (error) {
        console.error("Failed to add module quiz question", error);
        toast.error(
          error.code === "42501"
            ? "Your account isn't set up as a lecturer yet."
            : "Couldn't add the question. Try again.",
        );
        return false;
      }
      return true;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createModuleQuizQuestion, creating };
}

/** Publishes a whole reviewed AI-generated draft (see
 * use-admin-quiz-gen.ts) to a module in one call — a single batch insert
 * rather than N sequential useCreateModuleQuizQuestion calls, since these
 * questions were already generated and reviewed together as one set and
 * should land in the same all-or-nothing request rather than risking a
 * half-published quiz if one of N sequential inserts happened to fail. */
export function useCreateModuleQuizQuestions() {
  const [creating, setCreating] = useState(false);

  const createModuleQuizQuestions = useCallback(
    async (moduleId: string, questions: QuizQuestion[]) => {
      if (questions.length === 0) return false;
      setCreating(true);
      try {
        const { error } = await supabase.from("module_quizzes").insert(
          questions.map((q) => ({
            id: crypto.randomUUID(),
            module_id: moduleId,
            question: q.question.trim(),
            options: q.options.map((o) => o.trim()),
            correct_index: q.correctIndex,
          })),
        );
        if (error) {
          console.error("Failed to publish module quiz", error);
          toast.error(
            error.code === "42501"
              ? "Your account isn't set up as a lecturer yet."
              : "Couldn't publish the quiz. Try again.",
          );
          return false;
        }
        return true;
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  return { createModuleQuizQuestions, creating };
}
