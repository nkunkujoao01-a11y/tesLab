-- Lecturer/admin catalog uploads — see DEV_LOG.md, Feature 26's original
-- "step two" gap: modules/materials could only ever be seeded via SQL,
-- with no in-app way for a real lecturer to add real course content.
--
-- Access model: a manual `is_lecturer` flag, not self-service signup —
-- confirmed with the user rather than assumed. Set directly in this
-- table by whoever administers the Supabase project; there is no in-app
-- way to grant it to yourself or anyone else, deliberately, since this
-- controls write access to the shared catalog every student reads.

alter table public.profiles add column is_lecturer boolean not null default false;

-- Existing policies only ever granted select (see 0001_init.sql) — modules
-- and materials were publicly readable but not writable by anyone through
-- the anon-key client. These add real, gated write access without
-- loosening the existing public-read policies at all.

create policy "Lecturers can insert modules"
  on public.modules for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

create policy "Lecturers can update modules"
  on public.modules for update
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

create policy "Lecturers can delete modules"
  on public.modules for delete
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

create policy "Lecturers can insert materials"
  on public.materials for insert
  to authenticated
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

create policy "Lecturers can update materials"
  on public.materials for update
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

create policy "Lecturers can delete materials"
  on public.materials for delete
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));
