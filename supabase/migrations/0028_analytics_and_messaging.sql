-- eLearn: (1) lets a lecturer read enough already-synced student data to
-- show real per-module analytics, and (2) a direct lecturer<->student
-- messaging thread per module.

-- ── Analytics: lecturer read access ─────────────────────────────────────
-- activity_events/read_materials (0004_progress_sync.sql) already sync
-- real per-student activity to Supabase, but only ever granted the
-- student themselves read access ("Users can manage their own X") — there
-- was no admin-analytics use for it yet at the time. Adding read-only
-- "Lecturers can view all" policies, same shape as the ones
-- 0011_module_enrollments.sql already added for profiles/enrollments,
-- rather than a new parallel reporting table: this *is* the real data,
-- reading it directly means analytics can never drift from what a
-- student's own devices actually recorded.
create policy "Lecturers can view all activity"
  on public.activity_events for select
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

create policy "Lecturers can view all read history"
  on public.read_materials for select
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

-- ── Messaging ────────────────────────────────────────────────────────────
-- One conversation per (module, student) pair — not per specific
-- lecturer, matching the "any lecturer, any module" admin model already
-- used everywhere else in this schema (0008_lecturer_role.sql onward): a
-- student's thread belongs to the module's admin side collectively, not
-- to whichever individual lecturer happened to write the first message.
-- `replies_allowed` is a property of the thread, not of an individual
-- message, so a client can check "can I reply right now" with one row
-- lookup instead of scanning message history for the latest permission.
create table public.module_conversations (
  module_id text not null references public.modules (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  replies_allowed boolean not null default true,
  primary key (module_id, student_id)
);

alter table public.module_conversations enable row level security;

create policy "Lecturers can manage conversations"
  on public.module_conversations for all
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ))
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

-- A student only ever needs to read their own thread's current
-- reply-permission state — never granted insert/update, that's an
-- admin-only lever ("student can reply unless the admin refuses").
create policy "Students can view their own conversation state"
  on public.module_conversations for select
  using (auth.uid() = student_id);

create table public.module_messages (
  id uuid primary key,
  module_id text not null references public.modules (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  sender_role text not null check (sender_role in ('lecturer', 'student')),
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index module_messages_thread_idx
  on public.module_messages (module_id, student_id, created_at);

alter table public.module_messages enable row level security;

create policy "Lecturers can manage all messages"
  on public.module_messages for all
  to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ))
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and is_lecturer = true
  ));

-- A student reads only their own thread, and can only ever post as
-- themselves, with sender_role correctly 'student' — and only into a
-- thread the admin hasn't closed to replies.
create policy "Students can view their own thread"
  on public.module_messages for select
  using (auth.uid() = student_id);

create policy "Students can reply if allowed"
  on public.module_messages for insert
  with check (
    auth.uid() = student_id
    and auth.uid() = sender_id
    and sender_role = 'student'
    and exists (
      select 1 from public.module_conversations c
      where c.module_id = module_messages.module_id
        and c.student_id = module_messages.student_id
        and c.replies_allowed = true
    )
  );
