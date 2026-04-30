create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'tutor', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'tutor_status') then
    create type public.tutor_status as enum ('pending', 'approved', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum ('scheduled', 'cancelled', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum ('pending_payment', 'upcoming', 'completed', 'cancelled');
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

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role public.user_role not null default 'student',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  description text,
  created_at timestamptz not null default now()
);

alter table public.subjects
  add column if not exists code text,
  add column if not exists description text,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.tutor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  full_name text not null,
  bio text,
  hourly_rate integer not null check (hourly_rate >= 0),
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  reviews_count integer not null default 0 check (reviews_count >= 0),
  image_url text,
  status public.tutor_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tutor_profiles
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists subject_id uuid references public.subjects(id) on delete set null,
  add column if not exists bio text,
  add column if not exists hourly_rate integer not null default 0,
  add column if not exists rating numeric(2, 1) not null default 0,
  add column if not exists reviews_count integer not null default 0,
  add column if not exists image_url text,
  add column if not exists status public.tutor_status not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  code text not null unique,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_per_seat integer not null check (price_per_seat >= 0),
  capacity integer not null default 4 check (capacity > 0),
  location text,
  status public.session_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_sessions_time_check check (ends_at > starts_at)
);

alter table public.course_sessions
  add column if not exists tutor_profile_id uuid references public.tutor_profiles(id) on delete cascade,
  add column if not exists subject_id uuid references public.subjects(id) on delete restrict,
  add column if not exists code text,
  add column if not exists title text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists price_per_seat integer not null default 0,
  add column if not exists capacity integer not null default 4,
  add column if not exists location text,
  add column if not exists status public.session_status not null default 'scheduled',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.booking_status not null default 'pending_payment',
  total_price integer not null check (total_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

alter table public.bookings
  add column if not exists session_id uuid references public.course_sessions(id) on delete cascade,
  add column if not exists student_id uuid references public.profiles(id) on delete cascade,
  add column if not exists status public.booking_status not null default 'pending_payment',
  add column if not exists total_price integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subjects_code_key' and conrelid = 'public.subjects'::regclass
  ) then
    alter table public.subjects add constraint subjects_code_key unique (code);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tutor_profiles_user_id_key' and conrelid = 'public.tutor_profiles'::regclass
  ) then
    alter table public.tutor_profiles add constraint tutor_profiles_user_id_key unique (user_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'course_sessions_code_key' and conrelid = 'public.course_sessions'::regclass
  ) then
    alter table public.course_sessions add constraint course_sessions_code_key unique (code);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bookings_session_id_student_id_key' and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings add constraint bookings_session_id_student_id_key unique (session_id, student_id);
  end if;
end
$$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_tutor_profiles_status on public.tutor_profiles(status);
create index if not exists idx_tutor_profiles_subject_id on public.tutor_profiles(subject_id);
create index if not exists idx_course_sessions_subject_id on public.course_sessions(subject_id);
create index if not exists idx_course_sessions_tutor_profile_id on public.course_sessions(tutor_profile_id);
create index if not exists idx_course_sessions_starts_at on public.course_sessions(starts_at);
create index if not exists idx_bookings_student_id on public.bookings(student_id);
create index if not exists idx_bookings_session_id on public.bookings(session_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_tutor_profiles_updated_at on public.tutor_profiles;
create trigger set_tutor_profiles_updated_at
before update on public.tutor_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_course_sessions_updated_at on public.course_sessions;
create trigger set_course_sessions_updated_at
before update on public.course_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
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
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

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
  tutor_profiles.full_name as tutor_name,
  tutor_profiles.image_url as tutor_image_url,
  tutor_profiles.rating as tutor_rating,
  tutor_profiles.reviews_count as tutor_reviews_count,
  count(bookings.id) filter (where bookings.status <> 'cancelled')::integer as booked_seats
from public.course_sessions
join public.subjects on subjects.id = course_sessions.subject_id
join public.tutor_profiles on tutor_profiles.id = course_sessions.tutor_profile_id
left join public.bookings on bookings.session_id = course_sessions.id
where tutor_profiles.status = 'approved'
group by course_sessions.id, subjects.id, tutor_profiles.id;

create or replace function public.book_course_session(target_session_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
  selected_session public.course_sessions;
  active_bookings integer;
  new_booking public.bookings;
begin
  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null or current_profile.role <> 'student' then
    raise exception 'Only students can book sessions.';
  end if;

  select *
  into selected_session
  from public.course_sessions
  where id = target_session_id
    and status = 'scheduled'
  for update;

  if selected_session.id is null then
    raise exception 'Session is not available.';
  end if;

  select count(*)
  into active_bookings
  from public.bookings
  where session_id = target_session_id
    and status <> 'cancelled';

  if active_bookings >= selected_session.capacity then
    raise exception 'Session is already full.';
  end if;

  insert into public.bookings (session_id, student_id, status, total_price)
  values (selected_session.id, current_profile.id, 'pending_payment', selected_session.price_per_seat)
  on conflict (session_id, student_id) do update
    set status = case
          when public.bookings.status = 'cancelled' then 'pending_payment'::public.booking_status
          else public.bookings.status
        end,
        total_price = selected_session.price_per_seat
  returning * into new_booking;

  return new_booking;
end;
$$;

create or replace function public.join_class(target_session_id uuid)
returns public.bookings
language sql
security definer
set search_path = public
as $$
  select public.book_course_session(target_session_id);
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.course_sessions enable row level security;
alter table public.bookings enable row level security;

grant select on public.course_session_overview to anon, authenticated;
grant execute on function public.book_course_session(uuid) to authenticated;
grant execute on function public.join_class(uuid) to authenticated;
notify pgrst, 'reload schema';

drop policy if exists "Profiles are readable by owner or admin" on public.profiles;
create policy "Profiles are readable by owner or admin"
on public.profiles
for select
to authenticated
using (auth.uid() = id or public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Subjects are public readable" on public.subjects;
create policy "Subjects are public readable"
on public.subjects
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage subjects" on public.subjects;
create policy "Admins can manage subjects"
on public.subjects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Approved tutors are public readable" on public.tutor_profiles;
create policy "Approved tutors are public readable"
on public.tutor_profiles
for select
to anon, authenticated
using (status = 'approved');

drop policy if exists "Tutors can read their own profile" on public.tutor_profiles;
create policy "Tutors can read their own profile"
on public.tutor_profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Tutors can create their own pending profile" on public.tutor_profiles;
create policy "Tutors can create their own pending profile"
on public.tutor_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'tutor'
  )
);

drop policy if exists "Tutors can update their own pending profile" on public.tutor_profiles;
create policy "Tutors can update their own pending profile"
on public.tutor_profiles
for update
to authenticated
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Admins can manage tutor profiles" on public.tutor_profiles;
create policy "Admins can manage tutor profiles"
on public.tutor_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Scheduled sessions are public readable" on public.course_sessions;
create policy "Scheduled sessions are public readable"
on public.course_sessions
for select
to anon, authenticated
using (
  status = 'scheduled'
  and exists (
    select 1
    from public.tutor_profiles
    where tutor_profiles.id = course_sessions.tutor_profile_id
      and tutor_profiles.status = 'approved'
  )
);

drop policy if exists "Tutors can manage their own sessions" on public.course_sessions;
create policy "Tutors can manage their own sessions"
on public.course_sessions
for all
to authenticated
using (
  exists (
    select 1
    from public.tutor_profiles
    where tutor_profiles.id = course_sessions.tutor_profile_id
      and tutor_profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tutor_profiles
    where tutor_profiles.id = course_sessions.tutor_profile_id
      and tutor_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Admins can manage sessions" on public.course_sessions;
create policy "Admins can manage sessions"
on public.course_sessions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Students can read their bookings" on public.bookings;
create policy "Students can read their bookings"
on public.bookings
for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.course_sessions
    join public.tutor_profiles on tutor_profiles.id = course_sessions.tutor_profile_id
    where course_sessions.id = bookings.session_id
      and tutor_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Students can create their bookings" on public.bookings;
create policy "Students can create their bookings"
on public.bookings
for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'student'
  )
);

drop policy if exists "Students can update their pending bookings" on public.bookings;
create policy "Students can update their pending bookings"
on public.bookings
for update
to authenticated
using (student_id = auth.uid() and status in ('pending_payment', 'upcoming'))
with check (student_id = auth.uid());

drop policy if exists "Admins can manage bookings" on public.bookings;
create policy "Admins can manage bookings"
on public.bookings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Students can cancel their bookings" on public.bookings;
create policy "Students can cancel their bookings"
on public.bookings
for update
to authenticated
using (student_id = auth.uid() and status in ('pending_payment', 'upcoming'))
with check (student_id = auth.uid() and status = 'cancelled');

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
on conflict (id) do nothing;

insert into public.subjects (name, code, description)
values
  ('Kalkulus Dasar', 'MAT201', 'Materi kalkulus dasar untuk mahasiswa foundation.'),
  ('Fisika Dasar', 'FIS101', 'Konsep mekanika, gelombang, dan dasar fisika kampus.'),
  ('Pemrograman', 'PRG220', 'Dasar algoritma dan pemrograman.'),
  ('Kimia Dasar', 'KIM110', 'Stoikiometri, struktur atom, dan konsep dasar kimia.'),
  ('Biologi Umum', 'BIO100', 'Konsep dasar biologi umum.'),
  ('Matematika Diskrit', 'MAT220', 'Logika, himpunan, relasi, dan kombinatorika.')
on conflict (name) do update
set code = excluded.code,
    description = excluded.description;

insert into public.tutor_profiles (full_name, subject_id, hourly_rate, rating, reviews_count, image_url, status)
select *
from (
  values
    ('Dr. Budi Santoso', (select id from public.subjects where name = 'Fisika Dasar'), 75000, 4.9, 127, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face', 'approved'::public.tutor_status),
    ('Siti Nurhaliza', (select id from public.subjects where name = 'Kalkulus Dasar'), 85000, 5.0, 89, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', 'approved'::public.tutor_status),
    ('Ahmad Fauzi', (select id from public.subjects where name = 'Kimia Dasar'), 70000, 4.8, 156, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face', 'approved'::public.tutor_status),
    ('Rani Wijaya', (select id from public.subjects where name = 'Pemrograman'), 90000, 4.9, 94, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', 'approved'::public.tutor_status),
    ('Dimas Pratama', (select id from public.subjects where name = 'Matematika Diskrit'), 80000, 5.0, 112, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face', 'approved'::public.tutor_status),
    ('Lestari Putri', (select id from public.subjects where name = 'Biologi Umum'), 65000, 4.7, 78, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face', 'approved'::public.tutor_status)
) as seed(full_name, subject_id, hourly_rate, rating, reviews_count, image_url, status)
where not exists (
  select 1
  from public.tutor_profiles
  where tutor_profiles.full_name = seed.full_name
);

insert into public.course_sessions (
  tutor_profile_id,
  subject_id,
  code,
  title,
  starts_at,
  ends_at,
  price_per_seat,
  capacity,
  location,
  status
)
select
  tutor_profiles.id,
  subjects.id,
  seed.code,
  seed.title,
  seed.starts_at::timestamptz,
  seed.ends_at::timestamptz,
  seed.price_per_seat,
  seed.capacity,
  seed.location,
  'scheduled'::public.session_status
from (
  values
    ('Kalkulus Dasar', 'Siti Nurhaliza', 'MAT201-3921', 'Kalkulus Dasar', '2026-02-23 10:00+07', '2026-02-23 11:30+07', 75000, 4, 'Online'),
    ('Fisika Dasar', 'Dr. Budi Santoso', 'FIS101-8840', 'Fisika Dasar', '2026-02-25 13:00+07', '2026-02-25 14:30+07', 70000, 4, 'Online'),
    ('Pemrograman', 'Rani Wijaya', 'PRG220-1208', 'Pemrograman', '2026-02-27 09:00+07', '2026-02-27 10:30+07', 90000, 4, 'Online'),
    ('Kimia Dasar', 'Ahmad Fauzi', 'KIM110-7712', 'Kimia Dasar', '2026-02-28 15:00+07', '2026-02-28 16:30+07', 65000, 4, 'Online')
) as seed(subject_name, tutor_name, code, title, starts_at, ends_at, price_per_seat, capacity, location)
join public.subjects on subjects.name = seed.subject_name
join public.tutor_profiles on tutor_profiles.full_name = seed.tutor_name
on conflict (code) do update
set title = excluded.title,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    price_per_seat = excluded.price_per_seat,
    capacity = excluded.capacity,
    location = excluded.location,
    status = excluded.status;

-- To make one existing account an admin, replace the email and run this after signup:
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
