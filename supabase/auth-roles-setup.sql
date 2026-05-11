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
  full_name text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_profiles
  add column if not exists full_name text;

alter table public.admin_profiles
  add column if not exists full_name text;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create or replace function public.sync_profile_role_children()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'student' then
    insert into public.student_profiles (id, full_name)
    values (new.id, new.full_name)
    on conflict (id) do update
      set full_name = excluded.full_name,
          updated_at = now();
    delete from public.tutor_profiles where id = new.id;
    delete from public.admin_profiles where id = new.id;
  elsif new.role = 'tutor' then
    insert into public.tutor_profiles (id, user_id, full_name, hourly_rate, rating, reviews_count, status)
    values (
      new.id,
      new.id,
      coalesce(new.full_name, new.email, 'Tutor'),
      0,
      0,
      0,
      'pending'::public.tutor_status
    )
    on conflict (id) do update
      set user_id = excluded.user_id,
          full_name = excluded.full_name,
          updated_at = now();
    delete from public.student_profiles where id = new.id;
    delete from public.admin_profiles where id = new.id;
  elsif new.role = 'admin' then
    insert into public.admin_profiles (id, full_name)
    values (new.id, new.full_name)
    on conflict (id) do update
      set full_name = excluded.full_name,
          updated_at = now();
    delete from public.student_profiles where id = new.id;
    delete from public.tutor_profiles where id = new.id;
  end if;

  return new;
end;
$$;

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

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    requested_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        role = excluded.role;

  return new;
end;
$$;

drop trigger if exists sync_profile_role_children_after_write on public.profiles;
create trigger sync_profile_role_children_after_write
after insert or update of role, full_name
on public.profiles
for each row execute function public.sync_profile_role_children();

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.student_profiles (id, full_name)
select id, full_name
from public.profiles
where role = 'student'
on conflict (id) do update
  set full_name = excluded.full_name,
      updated_at = now();

insert into public.tutor_profiles (id, user_id, full_name, hourly_rate, rating, reviews_count, status)
select
  id,
  id,
  coalesce(full_name, email, 'Tutor'),
  0,
  0,
  0,
  'pending'::public.tutor_status
from public.profiles
where role = 'tutor'
on conflict (id) do update
  set user_id = excluded.user_id,
  full_name = excluded.full_name,
      updated_at = now();

insert into public.admin_profiles (id, full_name)
select id, full_name
from public.profiles
where role = 'admin'
on conflict (id) do update
  set full_name = excluded.full_name,
      updated_at = now();

insert into public.profiles (id, email, full_name, role)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  case
    when raw_user_meta_data ->> 'role' in ('student', 'tutor') then (raw_user_meta_data ->> 'role')::public.user_role
    else 'student'::public.user_role
  end
from auth.users
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      role = excluded.role;

-- To make one existing account an admin, replace the email and run this after signup:
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
