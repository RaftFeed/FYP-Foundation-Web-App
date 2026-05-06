-- Tutor profile normalization migration
-- Goal:
-- 1. Make public.profiles the authoritative source for tutor basic info.
-- 2. Cascade deletes from profiles -> tutor_profiles -> all tutor-related tables.
-- 3. Keep the current app compatible by syncing tutor_profiles.full_name from profiles.
--
-- Important:
-- This migration does NOT drop tutor_profiles.full_name yet because the current app
-- and several SQL objects still read that column directly. Instead, it prevents
-- divergence by syncing the value from profiles automatically.
--
-- After the application is refactored to read tutor names from profiles joins/views,
-- tutor_profiles.full_name can be removed in a follow-up migration.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_tutor_profile_name_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_name text;
begin
  if new.user_id is null then
    return new;
  end if;

  select profiles.full_name
  into linked_name
  from public.profiles
  where profiles.id = new.user_id;

  if linked_name is not null then
    new.full_name := linked_name;
  end if;

  return new;
end;
$$;

create or replace function public.propagate_profile_name_to_tutor_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tutor_profiles
  set full_name = coalesce(new.full_name, public.tutor_profiles.full_name)
  where user_id = new.id;

  return new;
end;
$$;

do $$
declare
  linked_tutor_count integer;
begin
  select count(*)
  into linked_tutor_count
  from public.tutor_profiles
  where user_id is not null;

  raise notice 'Linked tutor_profiles rows found: %', linked_tutor_count;
end
$$;

-- Backfill tutor_profiles.full_name from profiles for every linked tutor.
update public.tutor_profiles tutor_profiles
set full_name = profiles.full_name
from public.profiles profiles
where tutor_profiles.user_id = profiles.id
  and profiles.full_name is not null
  and tutor_profiles.full_name is distinct from profiles.full_name;

drop trigger if exists sync_tutor_profile_name_before_write on public.tutor_profiles;
create trigger sync_tutor_profile_name_before_write
before insert or update of user_id, full_name
on public.tutor_profiles
for each row execute function public.sync_tutor_profile_name_from_profile();

drop trigger if exists propagate_profile_name_after_update on public.profiles;
create trigger propagate_profile_name_after_update
after update of full_name
on public.profiles
for each row execute function public.propagate_profile_name_to_tutor_profile();

-- Rebuild tutor_profiles.user_id FK so deleting profiles cascades into tutor_profiles.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'tutor_profiles_user_id_fkey'
      and conrelid = 'public.tutor_profiles'::regclass
  ) then
    alter table public.tutor_profiles drop constraint tutor_profiles_user_id_fkey;
  end if;
end
$$;

alter table public.tutor_profiles
  add constraint tutor_profiles_user_id_fkey
  foreign key (user_id)
  references public.profiles(id)
  on delete cascade;

-- Make downstream tutor references cascade as well.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'matchmaking_lobbies_tutor_profile_id_fkey'
      and conrelid = 'public.matchmaking_lobbies'::regclass
  ) then
    alter table public.matchmaking_lobbies drop constraint matchmaking_lobbies_tutor_profile_id_fkey;
  end if;
exception
  when undefined_table then null;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'matchmaking_lobbies'
  ) then
    alter table public.matchmaking_lobbies
      add constraint matchmaking_lobbies_tutor_profile_id_fkey
      foreign key (tutor_profile_id)
      references public.tutor_profiles(id)
      on delete cascade;
  end if;
exception
  when duplicate_object then null;
  when undefined_table then null;
end
$$;

-- Transitional read view for code that wants profile-linked tutor info directly.
create or replace view public.tutor_profiles_with_profiles
as
select
  tutor_profiles.id,
  tutor_profiles.user_id,
  tutor_profiles.subject_id,
  coalesce(profiles.full_name, tutor_profiles.full_name) as full_name,
  profiles.email,
  profiles.role,
  tutor_profiles.bio,
  tutor_profiles.hourly_rate,
  tutor_profiles.rating,
  tutor_profiles.reviews_count,
  tutor_profiles.image_url,
  tutor_profiles.status,
  tutor_profiles.created_at,
  tutor_profiles.updated_at
from public.tutor_profiles
left join public.profiles
  on profiles.id = tutor_profiles.user_id;

-- Rebuild base overview so tutor names always come from profiles when linked.
create or replace view public.course_session_overview as
select
  course_sessions.id,
  course_sessions.code,
  course_sessions.title,
  course_sessions.starts_at,
  course_sessions.ends_at,
  course_sessions.price_per_seat,
  course_sessions.capacity,
  course_sessions.location,
  course_sessions.status,
  course_sessions.subject_id,
  subjects.name as subject_name,
  subjects.code as subject_code,
  course_sessions.tutor_profile_id,
  coalesce(profiles.full_name, tutor_profiles.full_name) as tutor_name,
  tutor_profiles.image_url as tutor_image_url,
  tutor_profiles.rating as tutor_rating,
  tutor_profiles.reviews_count as tutor_reviews_count,
  count(bookings.id) filter (where bookings.status <> 'cancelled')::integer as booked_seats
from public.course_sessions
join public.subjects on subjects.id = course_sessions.subject_id
join public.tutor_profiles on tutor_profiles.id = course_sessions.tutor_profile_id
left join public.profiles on profiles.id = tutor_profiles.user_id
left join public.bookings on bookings.session_id = course_sessions.id
where tutor_profiles.status = 'approved'
group by course_sessions.id, subjects.id, tutor_profiles.id, profiles.id;

grant select on public.tutor_profiles_with_profiles to anon, authenticated;
grant select on public.course_session_overview to anon, authenticated;

notify pgrst, 'reload schema';
