import { createClient } from "@supabase/supabase-js";

export type ModuleRow = {
  id: string;
  code: string;
  faculty: string;
  title: string;
  chapter: string;
  lecturer: string;
  size_mb: number;
  summary: string;
  total_lessons: number;
  created_at: string;
};

export type MaterialContent = {
  heading: string;
  lead: string;
  body: string[];
  pull: string;
};

export type MaterialRow = {
  id: string;
  module_id: string;
  title: string;
  kind: string;
  pages: number;
  size_mb: number;
  content: MaterialContent;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  program: string;
  university: string;
  faculty: string;
  created_at: string;
  onboarding_completed_at: string | null;
  // Manually set in the database by whoever administers the project —
  // deliberately no in-app way to grant this to yourself or anyone else,
  // since it gates write access to the shared catalog every student
  // reads. See supabase/migrations/0008_lecturer_role.sql.
  is_lecturer: boolean;
};

// Mirror src/lib/db.ts's per-user IndexedDB tables — see Feature 23
// (multi-device progress sync). Downloads/cached content deliberately
// have no server-side counterpart; these three do.
export type ReadMaterialRow = {
  user_id: string;
  module_id: string;
  material_id: string;
  first_read_at: string;
  last_read_at: string;
};

export type ActivityEventRow = {
  id: string;
  user_id: string;
  type: string;
  event_at: string;
};

export type MaterialSummaryRow = {
  user_id: string;
  module_id: string;
  material_id: string;
  body: string;
  method: string | null;
  generated_at: string;
};

// A student's own uploaded PDF — see Feature 26. Only the extracted text
// syncs, not the original PDF file (no Supabase Storage integration;
// re-reading on another device works from the extracted text, re-viewing
// the literal source PDF does not — a deliberate scope line, see
// DEV_LOG.md).
export type PersonalDocumentRow = {
  id: string;
  user_id: string;
  title: string;
  page_count: number;
  size_mb: number;
  extracted_text: string;
  uploaded_at: string;
  updated_at: string;
  summary: string | null;
  summary_method: string | null;
  collection_id: string | null;
};

// The "library planner" — see Feature 33.
export type DocumentCollectionRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

// In-app feedback/bug reports, optionally with screenshots — see Feature
// 53. Submit-once: no Update type, matching the migration's lack of an
// update policy.
export type FeedbackRow = {
  id: string;
  user_id: string;
  message: string;
  image_paths: string[];
  // 0024_feedback_rating.sql — nullable, optional 1-5 satisfaction rating.
  rating: number | null;
  created_at: string;
};

// 0028_analytics_and_messaging.sql — see that migration's own comment for
// why the thread is keyed by (module, student), not a specific lecturer.
export type ModuleConversationRow = {
  module_id: string;
  student_id: string;
  replies_allowed: boolean;
};

export type ModuleMessageRow = {
  id: string;
  module_id: string;
  student_id: string;
  sender_role: "lecturer" | "student";
  sender_id: string;
  body: string;
  created_at: string;
};

// 0027_module_grades.sql — one row per graded item per student (not a
// single "final grade" column), so a module can carry a real breakdown
// ("Assignment 1", "Midterm", ...) over a term.
export type ModuleGradeRow = {
  id: string;
  module_id: string;
  user_id: string;
  label: string;
  score: number;
  max_score: number;
  graded_at: string;
  graded_by: string | null;
};

// 0025_research_study.sql — see research-study.ts for the full reasoning.
// Deliberately no user_id/email on either row: `anonymous_id` is a random
// per-device id, never derived from or joined back to the real account.
export type ResearchConsentRow = {
  id: string;
  anonymous_id: string;
  agreed: boolean;
  responded_at: string;
};

export type ResearchSurveyAnswers = {
  // SUS (System Usability Scale), 10 questions, 1-5.
  sus: Record<number, number>;
  // Perceived usefulness/ease of use (TAM/UTAUT), 5 questions, 1-5.
  tam: Record<number, number>;
  // Data efficiency & satisfaction, 5 questions, 1-5.
  dataEfficiency: Record<number, number>;
  // Open-ended, optional free text.
  openEnded: Record<number, string>;
};

export type ResearchSurveyResponseRow = {
  id: string;
  anonymous_id: string;
  answers: ResearchSurveyAnswers;
  submitted_at: string;
};

// An admin-authored quiz question for a module — see Feature 57. Distinct
// from the client-generated, per-student quizzes in `db.ts`; this is
// shared catalog content, same access model as `materials`.
export type ModuleQuizQuestionRow = {
  id: string;
  module_id: string;
  question: string;
  options: string[];
  correct_index: number;
  created_at: string;
};

// A student's self-service enrollment in a module — a roster concept, not
// an access gate (every module stays publicly readable). See Feature 58.
export type ModuleEnrollmentRow = {
  user_id: string;
  module_id: string;
  enrolled_at: string;
};

export type Database = {
  public: {
    Tables: {
      modules: {
        Row: ModuleRow;
        // Real insert type — used by the lecturer upload flow (see
        // use-catalog-admin.ts). `id` is a caller-chosen slug (matching
        // the existing seed data's short ids like "sen-301"), not a
        // database-generated one; `created_at` still defaults server-side.
        Insert: Omit<ModuleRow, "created_at">;
        // Only size_mb is ever updated in practice, after adding a
        // material — see use-catalog-admin.ts.
        Update: Partial<Pick<ModuleRow, "size_mb">>;
        Relationships: [];
      };
      materials: {
        Row: MaterialRow;
        Insert: Omit<MaterialRow, "created_at">;
        Update: never;
        Relationships: [];
      };
      module_quizzes: {
        Row: ModuleQuizQuestionRow;
        Insert: Omit<ModuleQuizQuestionRow, "created_at">;
        Update: never;
        Relationships: [];
      };
      module_enrollments: {
        Row: ModuleEnrollmentRow;
        Insert: Omit<ModuleEnrollmentRow, "enrolled_at">;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: Partial<
          Pick<
            ProfileRow,
            "full_name" | "program" | "university" | "faculty" | "onboarding_completed_at"
          >
        >;
        Relationships: [];
      };
      read_materials: {
        Row: ReadMaterialRow;
        Insert: ReadMaterialRow;
        Update: never;
        Relationships: [];
      };
      activity_events: {
        Row: ActivityEventRow;
        Insert: ActivityEventRow;
        Update: never;
        Relationships: [];
      };
      material_summaries: {
        Row: MaterialSummaryRow;
        Insert: MaterialSummaryRow;
        Update: never;
        Relationships: [];
      };
      personal_documents: {
        Row: PersonalDocumentRow;
        Insert: PersonalDocumentRow;
        Update: never;
        Relationships: [];
      };
      document_collections: {
        Row: DocumentCollectionRow;
        Insert: DocumentCollectionRow;
        Update: never;
        Relationships: [];
      };
      feedback: {
        Row: FeedbackRow;
        Insert: FeedbackRow;
        Update: never;
        Relationships: [];
      };
      research_consent: {
        Row: ResearchConsentRow;
        Insert: ResearchConsentRow;
        Update: never;
        Relationships: [];
      };
      research_survey_responses: {
        Row: ResearchSurveyResponseRow;
        Insert: ResearchSurveyResponseRow;
        Update: never;
        Relationships: [];
      };
      module_grades: {
        Row: ModuleGradeRow;
        Insert: ModuleGradeRow;
        Update: never;
        Relationships: [];
      };
      module_conversations: {
        Row: ModuleConversationRow;
        Insert: ModuleConversationRow;
        Update: Partial<Pick<ModuleConversationRow, "replies_allowed">>;
        Relationships: [];
      };
      module_messages: {
        Row: ModuleMessageRow;
        Insert: Omit<ModuleMessageRow, "created_at">;
        Update: never;
        Relationships: [];
      };
    };
    // supabase-js's GenericSchema requires these even when empty — omitting
    // them silently collapses every table's inferred Row type to `never`
    // instead of raising a clear error (learned the hard way debugging
    // Feature 23's new tables).
    Views: Record<string, never>;
    // Deliberately left empty here rather than typed with the BYOK RPCs
    // (supabase/migrations/0014_ai_provider_keys.sql) — populating this
    // with a concrete function map was found to change how the PostgREST
    // client resolves *unrelated* embedded-relationship `.select()` calls
    // elsewhere (admin-console-api.ts, modules-api.ts querying
    // modules→materials/module_quizzes), surfacing real type errors there
    // that this change shouldn't be responsible for fixing. Those RPCs are
    // instead typed locally, scoped to the one module that calls them —
    // see ai-cloud.ts's own `rpcClient`.
    Functions: Record<string, never>;
  };
};

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check your .env file.");
}

// Anon-key client only. Row Level Security on `modules`/`materials`/`profiles`
// governs access — never import the service_role key here or anywhere else
// that ships to the browser.
export const supabase = createClient<Database>(url, anonKey);
