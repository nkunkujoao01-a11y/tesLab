-- eLearn: a student's real NUST eLearning (Moodle) courses, materials, and
-- grades — synced in by the background job (see moodle-cron-handler.ts),
-- never written by students directly. Owner-only RLS, same pattern as
-- document_collections (0007)/personal_documents (0005), select-only for
-- authenticated since only the trusted sync job (service_role, which
-- bypasses RLS by design) ever writes here.
--
-- Course modules store Moodle's own `contents` array fairly directly as
-- jsonb rather than normalizing every file/folder/assignment/link shape
-- into its own columns — same "store the upstream shape plainly" style
-- already used elsewhere in this app (see CachedCatalogModule in db.ts).

create table public.moodle_courses (
  id bigint not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  short_name text not null,
  summary text,
  course_image text,
  lecturer_name text,
  last_synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.moodle_course_sections (
  course_id bigint not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  section_id bigint not null,
  name text,
  position integer not null,
  summary text,
  primary key (user_id, course_id, section_id),
  foreign key (user_id, course_id) references public.moodle_courses (user_id, id) on delete cascade
);

create table public.moodle_course_modules (
  course_id bigint not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  section_id bigint not null,
  module_id bigint not null,
  name text not null,
  modname text not null,
  url text,
  contents jsonb,
  primary key (user_id, course_id, module_id),
  foreign key (user_id, course_id) references public.moodle_courses (user_id, id) on delete cascade
);

create table public.moodle_grades (
  course_id bigint not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_name text not null,
  item_type text,
  grade_raw numeric,
  grade_formatted text,
  grade_max numeric,
  weight numeric,
  feedback text,
  primary key (user_id, course_id, item_name),
  foreign key (user_id, course_id) references public.moodle_courses (user_id, id) on delete cascade
);

alter table public.moodle_courses enable row level security;
alter table public.moodle_course_sections enable row level security;
alter table public.moodle_course_modules enable row level security;
alter table public.moodle_grades enable row level security;

create policy "Users can view their own Moodle courses"
  on public.moodle_courses for select using (auth.uid() = user_id);
create policy "Users can view their own Moodle course sections"
  on public.moodle_course_sections for select using (auth.uid() = user_id);
create policy "Users can view their own Moodle course modules"
  on public.moodle_course_modules for select using (auth.uid() = user_id);
create policy "Users can view their own Moodle grades"
  on public.moodle_grades for select using (auth.uid() = user_id);
