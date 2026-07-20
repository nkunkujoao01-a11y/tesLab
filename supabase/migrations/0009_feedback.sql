-- eLearn: in-app feedback / bug reports, optionally with screenshots (see
-- DEV_LOG.md, Feature 53). A student can report a problem or suggest an
-- improvement from Profile; submissions are reviewed manually by whoever
-- administers the project (via the Supabase dashboard or a direct query)
-- — there is no in-app review UI in this pass, same deliberate scope line
-- 0005_personal_documents.sql drew around Supabase Storage.
--
-- Online-only, submit-once: no offline queue (this app's sync.ts pattern
-- is "local-first, reconcile later" for content the user reads back later
-- — feedback has no local read path, it's sent once and done, so it just
-- gates on being online like the AI model download buttons already do)
-- and no update/delete policy (a submitted report shouldn't be editable
-- after the fact, same as a real bug report once filed).

create table public.feedback (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  -- Paths into the `feedback-images` bucket below, not signed URLs (those
  -- expire) — resolved to a viewable URL at review time instead.
  image_paths text[] not null default '{}',
  created_at timestamptz not null
);

alter table public.feedback enable row level security;

create policy "Users can submit their own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

-- Private bucket — a bug-report screenshot can easily contain personal
-- info (the student's own name/program elsewhere on screen), so this is
-- deliberately not public like a course material would be. Reviewer
-- access goes through the service role (bypasses RLS) or a signed URL
-- generated at review time, not a public bucket URL.
insert into storage.buckets (id, name, public)
values ('feedback-images', 'feedback-images', false);

-- Path convention enforced here, not just by convention: {user_id}/...
-- so a user can only write into their own folder.
create policy "Users can upload their own feedback images"
  on storage.objects for insert
  with check (
    bucket_id = 'feedback-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own feedback images"
  on storage.objects for select
  using (
    bucket_id = 'feedback-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
