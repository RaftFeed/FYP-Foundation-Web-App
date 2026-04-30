do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'tutor', 'admin');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  requested_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student');

  if requested_role = 'admin' then
    requested_role := 'student';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, requested_role);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, role)
select
  id,
  email,
  case
    when raw_user_meta_data ->> 'role' in ('student', 'tutor') then (raw_user_meta_data ->> 'role')::public.user_role
    else 'student'::public.user_role
  end
from auth.users
on conflict (id) do nothing;

-- To make one existing account an admin, replace the email and run this after signup:
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
