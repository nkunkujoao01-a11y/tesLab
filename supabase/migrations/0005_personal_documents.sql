-- eLearn: student-uploaded personal documents (FR22-26, phase 1 of the
-- real-PDF-extraction roadmap — see DEV_LOG.md, Feature 26).
--
-- A student uploads their own PDF; text is extracted client-side (pdf.js)
-- and only the extracted text syncs here, not the original file — there's
-- no Supabase Storage integration in this pass, a deliberate scope line.
-- Same pattern as 0004_progress_sync.sql: owner-only RLS, no public
-- access, mirrors the IndexedDB shape in src/lib/db.ts.

create table public.personal_documents (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  page_count integer not null,
  size_mb numeric not null,
  extracted_text text not null,
  uploaded_at timestamptz not null,
  -- Bumps on upload *and* on every summary regeneration, so sync can do a
  -- single "newer wins" comparison instead of tracking upload-time and
  -- summary-time separately (a document's summary can be regenerated
  -- after the initial upload, same as a material's summary).
  updated_at timestamptz not null,
  summary text,
  summary_method text
);

alter table public.personal_documents enable row level security;

create policy "Users can manage their own documents"
  on public.personal_documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
