-- eLearn: the "library planner" — student-created collections for
-- organizing their own personal documents (see DEV_LOG.md, Feature 33).
-- Scoped to personal documents only, not the shared catalog — confirmed
-- with the user before building, same as 0005's upload-scope question.
--
-- Same pattern as 0005_personal_documents.sql: owner-only RLS, mirrors the
-- IndexedDB shape in src/lib/db.ts. A document belongs to at most one
-- collection (a plain nullable foreign key, not a join table) — matches
-- how the feature was actually described, not a hypothetical
-- many-to-many nobody asked for.

create table public.document_collections (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table public.document_collections enable row level security;

create policy "Users can manage their own collections"
  on public.document_collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.personal_documents
  add column collection_id uuid references public.document_collections (id) on delete set null;
