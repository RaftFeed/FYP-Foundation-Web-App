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

  if not exists (select 1 from pg_type where typname = 'tutor_availability_status') then
    create type public.tutor_availability_status as enum ('available', 'held', 'booked', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'matchmaking_lobby_visibility') then
    create type public.matchmaking_lobby_visibility as enum ('public', 'private');
  end if;

  if not exists (select 1 from pg_type where typname = 'matchmaking_lobby_status') then
    create type public.matchmaking_lobby_status as enum ('open', 'pending_payment', 'paid', 'expired', 'cancelled', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'matchmaking_lobby_member_status') then
    create type public.matchmaking_lobby_member_status as enum ('active', 'left', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'matchmaking_payment_status') then
    create type public.matchmaking_payment_status as enum ('pending', 'paid', 'failed', 'expired');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
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

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.tutor_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  user_id uuid unique references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  full_name text not null,
  bio text,
  hourly_rate integer not null default 0 check (hourly_rate >= 0),
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  reviews_count integer not null default 0 check (reviews_count >= 0),
  image_url text,
  status public.tutor_status not null default 'pending',
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

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.course_sessions(id) on delete cascade,
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  status public.booking_status not null default 'pending_payment',
  total_price integer not null check (total_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_method text not null,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_availability_slots (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null default 'Online',
  meeting_url text,
  price_total integer not null check (price_total >= 0),
  max_participants integer not null default 4 check (max_participants > 0),
  status public.tutor_availability_status not null default 'available',
  notes text,
  recurrence_group_id uuid,
  recurrence_pattern text not null default 'none' check (recurrence_pattern in ('none', 'weekly')),
  recurrence_index integer not null default 0 check (recurrence_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_availability_time_check check (ends_at > starts_at)
);

alter table public.tutor_availability_slots
  add column if not exists recurrence_group_id uuid,
  add column if not exists recurrence_pattern text not null default 'none',
  add column if not exists recurrence_index integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_availability_recurrence_pattern_check'
      and conrelid = 'public.tutor_availability_slots'::regclass
  ) then
    alter table public.tutor_availability_slots
      add constraint tutor_availability_recurrence_pattern_check
      check (recurrence_pattern in ('none', 'weekly'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tutor_availability_recurrence_index_check'
      and conrelid = 'public.tutor_availability_slots'::regclass
  ) then
    alter table public.tutor_availability_slots
      add constraint tutor_availability_recurrence_index_check
      check (recurrence_index >= 0);
  end if;
end
$$;

create table if not exists public.matchmaking_lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete restrict,
  availability_slot_id uuid not null references public.tutor_availability_slots(id) on delete restrict,
  course_session_id uuid references public.course_sessions(id) on delete set null,
  title text not null,
  description text,
  visibility public.matchmaking_lobby_visibility not null default 'public',
  status public.matchmaking_lobby_status not null default 'open',
  min_participants integer not null default 2 check (min_participants > 0),
  max_participants integer not null default 4 check (max_participants > 0),
  price_total integer not null check (price_total >= 0),
  expires_at timestamptz not null,
  payment_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matchmaking_lobby_participant_check check (min_participants <= max_participants)
);

create table if not exists public.matchmaking_lobby_members (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.matchmaking_lobbies(id) on delete cascade,
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  status public.matchmaking_lobby_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (lobby_id, student_id)
);

create table if not exists public.matchmaking_lobby_payments (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.matchmaking_lobbies(id) on delete cascade,
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  amount integer not null check (amount >= 0),
  payment_method text not null default 'qris',
  status public.matchmaking_payment_status not null default 'pending',
  invoice_code text not null unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lobby_id, student_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin_profiles(id) on delete restrict,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  data jsonb
);

create table if not exists public.student_preferences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, subject_id)
);

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
    insert into public.tutor_profiles (
      id,
      user_id,
      full_name,
      hourly_rate,
      rating,
      reviews_count,
      status
    )
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

create or replace function public.payments_summary_by_day(start_date date, end_date date)
returns table(day date, total numeric)
language sql
as $$
  select date(created_at) as day, coalesce(sum(amount), 0) as total
  from public.payments
  where status = 'paid'
    and date(created_at) between start_date and end_date
  group by date(created_at)
  order by date(created_at);
$$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_student_preferences_student_id on public.student_preferences(student_id);
create index if not exists idx_student_preferences_subject_id on public.student_preferences(subject_id);
create index if not exists idx_tutor_profiles_status on public.tutor_profiles(status);
create index if not exists idx_tutor_profiles_subject_id on public.tutor_profiles(subject_id);
create index if not exists idx_course_sessions_subject_id on public.course_sessions(subject_id);
create index if not exists idx_course_sessions_tutor_profile_id on public.course_sessions(tutor_profile_id);
create index if not exists idx_course_sessions_starts_at on public.course_sessions(starts_at);
create index if not exists idx_bookings_student_id on public.bookings(student_id);
create index if not exists idx_bookings_session_id on public.bookings(session_id);
create index if not exists idx_payments_booking_id on public.payments(booking_id);
create index if not exists idx_reports_admin_id on public.reports(admin_id);
create index if not exists idx_reports_type on public.reports(report_type);
create index if not exists idx_tutor_availability_tutor on public.tutor_availability_slots(tutor_profile_id);
create index if not exists idx_tutor_availability_subject on public.tutor_availability_slots(subject_id);
create index if not exists idx_tutor_availability_starts_at on public.tutor_availability_slots(starts_at);
create index if not exists idx_tutor_availability_status on public.tutor_availability_slots(status);
create index if not exists idx_matchmaking_lobbies_creator on public.matchmaking_lobbies(creator_id);
create index if not exists idx_matchmaking_lobbies_slot on public.matchmaking_lobbies(availability_slot_id);
create index if not exists idx_matchmaking_lobbies_status on public.matchmaking_lobbies(status);
create index if not exists idx_matchmaking_lobbies_visibility on public.matchmaking_lobbies(visibility);
create index if not exists idx_matchmaking_members_lobby on public.matchmaking_lobby_members(lobby_id);
create index if not exists idx_matchmaking_members_student on public.matchmaking_lobby_members(student_id);
create index if not exists idx_matchmaking_payments_lobby on public.matchmaking_lobby_payments(lobby_id);
create index if not exists idx_matchmaking_payments_student on public.matchmaking_lobby_payments(student_id);
create index if not exists idx_matchmaking_payments_status on public.matchmaking_lobby_payments(status);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists sync_profile_role_children_after_write on public.profiles;
create trigger sync_profile_role_children_after_write
after insert or update of role, full_name
on public.profiles
for each row execute function public.sync_profile_role_children();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_student_profiles_updated_at on public.student_profiles;
create trigger set_student_profiles_updated_at
before update on public.student_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_tutor_profiles_updated_at on public.tutor_profiles;
create trigger set_tutor_profiles_updated_at
before update on public.tutor_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_profiles_updated_at on public.admin_profiles;
create trigger set_admin_profiles_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_subjects_updated_at on public.subjects;
drop trigger if exists set_course_sessions_updated_at on public.course_sessions;
create trigger set_course_sessions_updated_at
before update on public.course_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_tutor_availability_updated_at on public.tutor_availability_slots;
create trigger set_tutor_availability_updated_at
before update on public.tutor_availability_slots
for each row execute function public.set_updated_at();

drop trigger if exists set_matchmaking_lobbies_updated_at on public.matchmaking_lobbies;
create trigger set_matchmaking_lobbies_updated_at
before update on public.matchmaking_lobbies
for each row execute function public.set_updated_at();

drop trigger if exists set_matchmaking_lobby_members_updated_at on public.matchmaking_lobby_members;
create trigger set_matchmaking_lobby_members_updated_at
before update on public.matchmaking_lobby_members
for each row execute function public.set_updated_at();

drop trigger if exists set_matchmaking_lobby_payments_updated_at on public.matchmaking_lobby_payments;
create trigger set_matchmaking_lobby_payments_updated_at
before update on public.matchmaking_lobby_payments
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.course_sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.tutor_availability_slots enable row level security;
alter table public.matchmaking_lobbies enable row level security;
alter table public.matchmaking_lobby_members enable row level security;
alter table public.matchmaking_lobby_payments enable row level security;
alter table public.reports enable row level security;
alter table public.student_preferences enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Students can read their own subtype profile" on public.student_profiles;
create policy "Students can read their own subtype profile"
on public.student_profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Students can manage their own subtype profile" on public.student_profiles;
create policy "Students can manage their own subtype profile"
on public.student_profiles
for all
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

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
using (status = 'approved' or id = auth.uid() or public.is_admin());

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
  and id = auth.uid()
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

drop policy if exists "Admins can read own subtype profile" on public.admin_profiles;
create policy "Admins can read own subtype profile"
on public.admin_profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Admins can manage own subtype profile" on public.admin_profiles;
create policy "Admins can manage own subtype profile"
on public.admin_profiles
for all
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

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

drop policy if exists "Students can cancel their bookings" on public.bookings;
create policy "Students can cancel their bookings"
on public.bookings
for update
to authenticated
using (student_id = auth.uid() and status in ('pending_payment', 'upcoming'))
with check (student_id = auth.uid() and status = 'cancelled');

drop policy if exists "Admins can manage bookings" on public.bookings;
create policy "Admins can manage bookings"
on public.bookings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Payments are readable by admins or booking owners" on public.payments;
create policy "Payments are readable by admins or booking owners"
on public.payments
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.bookings
    where bookings.id = payments.booking_id
      and bookings.student_id = auth.uid()
  )
);

drop policy if exists "Admins can manage payments" on public.payments;
create policy "Admins can manage payments"
on public.payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read their own availability slots" on public.tutor_availability_slots;
create policy "Users can read their own availability slots"
on public.tutor_availability_slots
for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.tutor_profiles
    where tutor_profiles.id = tutor_availability_slots.tutor_profile_id
      and tutor_profiles.status = 'approved'
  )
);

drop policy if exists "Tutors can manage their own availability" on public.tutor_availability_slots;
create policy "Tutors can manage their own availability"
on public.tutor_availability_slots
for all
to authenticated
using (
  exists (
    select 1
    from public.tutor_profiles
    where tutor_profiles.id = tutor_availability_slots.tutor_profile_id
      and tutor_profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tutor_profiles
    where tutor_profiles.id = tutor_availability_slots.tutor_profile_id
      and tutor_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Admins can manage availability" on public.tutor_availability_slots;
create policy "Admins can manage availability"
on public.tutor_availability_slots
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop view if exists public.tutor_availability_overview;
create view public.tutor_availability_overview
with (security_invoker = true)
as
select
  slots.id,
  slots.tutor_profile_id,
  tutors.user_id as tutor_user_id,
  tutors.full_name as tutor_name,
  tutors.rating as tutor_rating,
  tutors.reviews_count as tutor_reviews_count,
  tutors.image_url as tutor_image_url,
  tutors.status as tutor_status,
  slots.subject_id,
  subjects.name as subject_name,
  subjects.code as subject_code,
  slots.starts_at,
  slots.ends_at,
  slots.location,
  case
    when public.is_admin() or tutors.user_id = auth.uid() then slots.meeting_url
    else null
  end as meeting_url,
  slots.price_total,
  slots.max_participants,
  slots.status,
  slots.notes,
  slots.recurrence_group_id,
  slots.recurrence_pattern,
  slots.recurrence_index,
  slots.created_at,
  slots.updated_at,
  (
    select lobbies.id
    from public.matchmaking_lobbies lobbies
    where lobbies.availability_slot_id = slots.id
      and lobbies.status in ('open', 'pending_payment', 'paid')
    order by lobbies.created_at desc
    limit 1
  ) as active_lobby_id
from public.tutor_availability_slots slots
join public.tutor_profiles tutors on tutors.id = slots.tutor_profile_id
join public.subjects subjects on subjects.id = slots.subject_id
where
  public.is_admin()
  or tutors.user_id = auth.uid()
  or (
    tutors.status = 'approved'
    and slots.status in ('available', 'held', 'booked')
  );

drop policy if exists "Scheduled lobbies are public readable" on public.matchmaking_lobbies;
create policy "Scheduled lobbies are public readable"
on public.matchmaking_lobbies
for select
to anon, authenticated
using (visibility = 'public' or public.is_admin() or creator_id = auth.uid());

drop policy if exists "Creators can manage their own lobbies" on public.matchmaking_lobbies;
create policy "Creators can manage their own lobbies"
on public.matchmaking_lobbies
for all
to authenticated
using (creator_id = auth.uid() or public.is_admin())
with check (creator_id = auth.uid() or public.is_admin());

drop policy if exists "Lobby members can read their own rows" on public.matchmaking_lobby_members;
create policy "Lobby members can read their own rows"
on public.matchmaking_lobby_members
for select
to authenticated
using (student_id = auth.uid() or public.is_admin());

drop policy if exists "Lobby members can manage their own rows" on public.matchmaking_lobby_members;
create policy "Lobby members can manage their own rows"
on public.matchmaking_lobby_members
for all
to authenticated
using (student_id = auth.uid() or public.is_admin())
with check (student_id = auth.uid() or public.is_admin());

drop policy if exists "Lobby payments can be read by owners and admins" on public.matchmaking_lobby_payments;
create policy "Lobby payments can be read by owners and admins"
on public.matchmaking_lobby_payments
for select
to authenticated
using (student_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can manage lobby payments" on public.matchmaking_lobby_payments;
create policy "Admins can manage lobby payments"
on public.matchmaking_lobby_payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage reports" on public.reports;
create policy "Admins can manage reports"
on public.reports
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Students can manage their own preferences" on public.student_preferences;
create policy "Students can manage their own preferences"
on public.student_preferences
for all
to authenticated
using (student_id = auth.uid() or public.is_admin())
with check (student_id = auth.uid() or public.is_admin());

grant select on public.tutor_availability_overview to anon, authenticated;

insert into public.profiles (id, email, full_name, role)
select
  id,
  email,
  full_name,
  role
from (
  select
    id,
    email,
    coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name') as full_name,
    case
      when raw_user_meta_data ->> 'role' in ('student', 'tutor') then (raw_user_meta_data ->> 'role')::public.user_role
      else 'student'::public.user_role
    end as role
  from auth.users
) seed
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      role = excluded.role;

insert into public.student_profiles (id, full_name)
select id, full_name
from public.profiles
where role = 'student'
on conflict (id) do update
  set full_name = excluded.full_name,
      updated_at = now();

insert into public.tutor_profiles (id, user_id, full_name, subject_id, hourly_rate, rating, reviews_count, image_url, status)
select
  profiles.id,
  profiles.id,
  coalesce(profiles.full_name, profiles.email, 'Tutor'),
  null,
  0,
  0,
  0,
  null,
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

create or replace view public.subject_matchmaking_overview
with (security_invoker = true)
as
select
  subjects.id,
  subjects.name,
  subjects.code,
  subjects.description,
  subjects.created_at,
  count(matchmaking_lobbies.id)::integer as matchmaking_count
from public.subjects
left join public.matchmaking_lobbies
  on matchmaking_lobbies.subject_id = subjects.id
  and matchmaking_lobbies.status in ('open', 'pending_payment', 'paid')
group by subjects.id;

create or replace view public.tutor_profiles_with_profiles as
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
left join public.profiles on profiles.id = tutor_profiles.user_id;

grant select on public.course_session_overview to anon, authenticated;
grant select on public.subject_matchmaking_overview to anon, authenticated;
grant select on public.tutor_profiles_with_profiles to anon, authenticated;
grant execute on function public.book_course_session(uuid) to authenticated;
grant execute on function public.join_class(uuid) to authenticated;
grant execute on function public.payments_summary_by_day(date, date) to authenticated;

notify pgrst, 'reload schema';
