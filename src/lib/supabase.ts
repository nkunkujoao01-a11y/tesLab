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
    };
    // supabase-js's GenericSchema requires these even when empty — omitting
    // them silently collapses every table's inferred Row type to `never`
    // instead of raising a clear error (learned the hard way debugging
    // Feature 23's new tables).
    Views: Record<string, never>;
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
