-- eLearn: lets a student attach images (e.g. a screenshot) to an
-- anonymous suggestion (0039_anonymous_suggestions.sql), not just text.
--
-- Deliberately NOT the same shape as feedback-images (0009_feedback.sql):
-- that bucket's storage path is keyed by auth.uid() (`{user_id}/...`),
-- which is exactly the kind of identifying link an *anonymous* submission
-- must not have. Object paths here are keyed by the suggestion's own
-- random id instead (`{suggestionId}/{index}-{filename}`), same as the
-- table row itself carries no user_id anywhere.
--
-- No read policy for the uploader at all, unlike feedback-images (where a
-- student can view their own past screenshots) — only a real super admin
-- can ever read these back, matching anonymous_suggestions' own
-- select policy exactly. Letting even the uploader read their own upload
-- back would require scoping storage RLS to *something* identifying them
-- (their own auth.uid() in the path), which defeats the anonymity this
-- whole feature exists for.

alter table public.anonymous_suggestions
  add column image_paths text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('anonymous-suggestion-images', 'anonymous-suggestion-images', false);

create policy "Users can upload anonymous suggestion images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'anonymous-suggestion-images');

create policy "Super admins can view anonymous suggestion images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'anonymous-suggestion-images'
    and public.is_super_admin()
  );
