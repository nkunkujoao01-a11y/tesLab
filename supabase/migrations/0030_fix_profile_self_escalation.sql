-- Security fix: close a student self-escalation hole in `profiles`.
--
-- "Users can update their own profile" (0001_init.sql) has always been
-- `using (auth.uid() = id)` with no `with check`. In Postgres RLS, an
-- UPDATE policy with no WITH CHECK reuses USING as the check on the *new*
-- row — which only restricts *which row* can be touched, not *which
-- columns* change. `is_lecturer` (0008_lecturer_role.sql) is a plain
-- column on that same row with no column-level restriction anywhere in
-- the database, so any signed-in student could call
-- `PATCH /rest/v1/profiles?id=eq.<own-uid>` with `{"is_lecturer": true}`
-- directly against the REST API — using only the public anon key and
-- their own JWT — and grant themselves full lecturer/admin access. The
-- only thing that ever discouraged this was a client-side TypeScript
-- `Update` type in supabase.ts, which is not a real enforcement boundary.
--
-- This adds a `with check` that pins `is_lecturer` to whatever value the
-- row already had, so a student can still update their own
-- full_name/program/university/faculty/etc., but can never change
-- is_lecturer on their own row through any path — RLS itself is now the
-- boundary. is_lecturer remains settable only by whoever administers the
-- Supabase project directly, exactly as 0008_lecturer_role.sql intended.

drop policy "Users can update their own profile" on public.profiles;

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_lecturer = (select is_lecturer from public.profiles where id = auth.uid())
  );
