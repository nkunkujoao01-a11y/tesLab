-- eLearn: store each student's email on public.profiles.
--
-- full_name was already captured on signup (0001_init.sql's handle_new_user
-- trigger), for both email/password and Google sign-in. email was not —
-- it only ever lived on auth.users, which the app's anon/authenticated
-- roles can't read directly, so nothing built on public.profiles (e.g. a
-- future lecturer roster view) could show a student's email at all.

alter table public.profiles add column email text;

-- Backfill existing rows (created before this column existed) from the
-- one place email already lived.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

alter table public.profiles alter column email set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, program, university, faculty)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'program', ''),
    coalesce(new.raw_user_meta_data ->> 'university', ''),
    coalesce(new.raw_user_meta_data ->> 'faculty', '')
  );
  return new;
end;
$$;
