create extension if not exists pgcrypto;

do $$
begin
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_availability_time_check check (ends_at > starts_at)
);

alter table public.tutor_availability_slots
  add column if not exists tutor_profile_id uuid references public.tutor_profiles(id) on delete cascade,
  add column if not exists subject_id uuid references public.subjects(id) on delete restrict,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists location text not null default 'Online',
  add column if not exists meeting_url text,
  add column if not exists price_total integer not null default 0,
  add column if not exists max_participants integer not null default 4,
  add column if not exists status public.tutor_availability_status not null default 'available',
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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

alter table public.matchmaking_lobbies
  add column if not exists code text,
  add column if not exists creator_id uuid references public.profiles(id) on delete cascade,
  add column if not exists subject_id uuid references public.subjects(id) on delete restrict,
  add column if not exists tutor_profile_id uuid references public.tutor_profiles(id) on delete restrict,
  add column if not exists availability_slot_id uuid references public.tutor_availability_slots(id) on delete restrict,
  add column if not exists course_session_id uuid references public.course_sessions(id) on delete set null,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists visibility public.matchmaking_lobby_visibility not null default 'public',
  add column if not exists status public.matchmaking_lobby_status not null default 'open',
  add column if not exists min_participants integer not null default 2,
  add column if not exists max_participants integer not null default 4,
  add column if not exists price_total integer not null default 0,
  add column if not exists expires_at timestamptz not null default (now() + interval '6 hours'),
  add column if not exists payment_due_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.matchmaking_lobby_members (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.matchmaking_lobbies(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.matchmaking_lobby_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (lobby_id, student_id)
);

alter table public.matchmaking_lobby_members
  add column if not exists lobby_id uuid references public.matchmaking_lobbies(id) on delete cascade,
  add column if not exists student_id uuid references public.profiles(id) on delete cascade,
  add column if not exists status public.matchmaking_lobby_member_status not null default 'active',
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists left_at timestamptz;

create table if not exists public.matchmaking_lobby_payments (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.matchmaking_lobbies(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount >= 0),
  payment_method text not null default 'qris',
  status public.matchmaking_payment_status not null default 'pending',
  invoice_code text not null unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lobby_id, student_id)
);

alter table public.matchmaking_lobby_payments
  add column if not exists lobby_id uuid references public.matchmaking_lobbies(id) on delete cascade,
  add column if not exists student_id uuid references public.profiles(id) on delete cascade,
  add column if not exists amount integer not null default 0,
  add column if not exists payment_method text not null default 'qris',
  add column if not exists status public.matchmaking_payment_status not null default 'pending',
  add column if not exists invoice_code text,
  add column if not exists paid_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'matchmaking_lobbies_code_key'
      and conrelid = 'public.matchmaking_lobbies'::regclass
  ) then
    alter table public.matchmaking_lobbies add constraint matchmaking_lobbies_code_key unique (code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'matchmaking_lobby_members_lobby_id_student_id_key'
      and conrelid = 'public.matchmaking_lobby_members'::regclass
  ) then
    alter table public.matchmaking_lobby_members add constraint matchmaking_lobby_members_lobby_id_student_id_key unique (lobby_id, student_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'matchmaking_lobby_payments_lobby_id_student_id_key'
      and conrelid = 'public.matchmaking_lobby_payments'::regclass
  ) then
    alter table public.matchmaking_lobby_payments add constraint matchmaking_lobby_payments_lobby_id_student_id_key unique (lobby_id, student_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'matchmaking_lobby_payments_invoice_code_key'
      and conrelid = 'public.matchmaking_lobby_payments'::regclass
  ) then
    alter table public.matchmaking_lobby_payments add constraint matchmaking_lobby_payments_invoice_code_key unique (invoice_code);
  end if;
end
$$;

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

drop trigger if exists set_tutor_availability_updated_at on public.tutor_availability_slots;
create trigger set_tutor_availability_updated_at
before update on public.tutor_availability_slots
for each row execute function public.set_updated_at();

drop trigger if exists set_matchmaking_lobbies_updated_at on public.matchmaking_lobbies;
create trigger set_matchmaking_lobbies_updated_at
before update on public.matchmaking_lobbies
for each row execute function public.set_updated_at();

drop trigger if exists set_matchmaking_lobby_payments_updated_at on public.matchmaking_lobby_payments;
create trigger set_matchmaking_lobby_payments_updated_at
before update on public.matchmaking_lobby_payments
for each row execute function public.set_updated_at();

create or replace function public.generate_matchmaking_code(seed_text text default null)
returns text
language plpgsql
set search_path = public
as $$
declare
  prefix text;
  candidate text;
begin
  prefix := upper(regexp_replace(coalesce(seed_text, 'FYP'), '[^A-Za-z0-9]+', '', 'g'));
  prefix := left(coalesce(nullif(prefix, ''), 'FYP'), 4);

  loop
    candidate := prefix || '-' || lpad(floor(random() * 10000)::integer::text, 4, '0');
    exit when not exists (select 1 from public.matchmaking_lobbies where code = candidate);
  end loop;

  return candidate;
end;
$$;

create or replace function public.upsert_my_tutor_profile(
  p_full_name text,
  p_subject_id uuid,
  p_hourly_rate integer default 0,
  p_bio text default null,
  p_image_url text default null
)
returns public.tutor_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
  saved_profile public.tutor_profiles;
begin
  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null or current_profile.role <> 'tutor' then
    raise exception 'Only tutors can update tutor profiles.';
  end if;

  if length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'Tutor name is required.';
  end if;

  if p_subject_id is null or not exists (select 1 from public.subjects where id = p_subject_id) then
    raise exception 'Subject is required.';
  end if;

  insert into public.tutor_profiles (
    user_id,
    subject_id,
    full_name,
    hourly_rate,
    bio,
    image_url,
    status
  )
  values (
    current_profile.id,
    p_subject_id,
    trim(p_full_name),
    greatest(coalesce(p_hourly_rate, 0), 0),
    nullif(trim(coalesce(p_bio, '')), ''),
    nullif(trim(coalesce(p_image_url, '')), ''),
    'pending'
  )
  on conflict (user_id) do update
    set subject_id = excluded.subject_id,
        full_name = excluded.full_name,
        hourly_rate = excluded.hourly_rate,
        bio = excluded.bio,
        image_url = excluded.image_url
  returning * into saved_profile;

  return saved_profile;
end;
$$;

create or replace function public.create_tutor_availability(
  p_subject_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_price_total integer,
  p_max_participants integer default 4,
  p_location text default 'Online',
  p_meeting_url text default null,
  p_notes text default null
)
returns public.tutor_availability_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  current_tutor public.tutor_profiles;
  saved_slot public.tutor_availability_slots;
begin
  select *
  into current_tutor
  from public.tutor_profiles
  where user_id = auth.uid();

  if current_tutor.id is null then
    raise exception 'Complete your tutor profile before creating availability.';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Invalid schedule time.';
  end if;

  if p_starts_at < now() - interval '1 hour' then
    raise exception 'Schedule cannot be created in the past.';
  end if;

  if exists (
    select 1
    from public.tutor_availability_slots existing
    where existing.tutor_profile_id = current_tutor.id
      and existing.status in ('available', 'held', 'booked')
      and p_starts_at < existing.ends_at
      and p_ends_at > existing.starts_at
  ) then
    raise exception 'This schedule overlaps with an existing tutor slot.';
  end if;

  insert into public.tutor_availability_slots (
    tutor_profile_id,
    subject_id,
    starts_at,
    ends_at,
    location,
    meeting_url,
    price_total,
    max_participants,
    notes
  )
  values (
    current_tutor.id,
    coalesce(p_subject_id, current_tutor.subject_id),
    p_starts_at,
    p_ends_at,
    coalesce(nullif(trim(coalesce(p_location, '')), ''), 'Online'),
    nullif(trim(coalesce(p_meeting_url, '')), ''),
    greatest(coalesce(p_price_total, current_tutor.hourly_rate, 0), 0),
    greatest(coalesce(p_max_participants, 4), 1),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into saved_slot;

  return saved_slot;
end;
$$;

create or replace function public.cancel_tutor_availability(target_slot_id uuid)
returns public.tutor_availability_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_slot public.tutor_availability_slots;
begin
  select slots.*
  into selected_slot
  from public.tutor_availability_slots slots
  join public.tutor_profiles tutors on tutors.id = slots.tutor_profile_id
  where slots.id = target_slot_id
    and (tutors.user_id = auth.uid() or public.is_admin())
  for update;

  if selected_slot.id is null then
    raise exception 'Schedule not found.';
  end if;

  if selected_slot.status <> 'available' then
    raise exception 'Only available slots can be cancelled from the dashboard.';
  end if;

  update public.tutor_availability_slots
  set status = 'cancelled'
  where id = selected_slot.id
  returning * into selected_slot;

  return selected_slot;
end;
$$;

create or replace function public.refresh_expired_matchmaking_lobbies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer := 0;
begin
  update public.matchmaking_lobbies
  set status = 'expired'
  where status = 'open'
    and expires_at <= now();

  get diagnostics changed_count = row_count;

  update public.tutor_availability_slots slots
  set status = 'available'
  where slots.status = 'held'
    and exists (
      select 1
      from public.matchmaking_lobbies lobbies
      where lobbies.availability_slot_id = slots.id
        and lobbies.status in ('expired', 'cancelled')
    )
    and not exists (
      select 1
      from public.matchmaking_lobbies lobbies
      where lobbies.availability_slot_id = slots.id
        and lobbies.status in ('open', 'pending_payment', 'paid', 'completed')
    );

  update public.matchmaking_lobby_payments payments
  set status = 'expired'
  where payments.status = 'pending'
    and exists (
      select 1
      from public.matchmaking_lobbies lobbies
      where lobbies.id = payments.lobby_id
        and lobbies.status = 'expired'
    );

  return changed_count;
end;
$$;

create or replace function public.create_matchmaking_lobby(
  p_availability_slot_id uuid,
  p_title text default null,
  p_description text default null,
  p_visibility public.matchmaking_lobby_visibility default 'public',
  p_min_participants integer default 2,
  p_max_participants integer default 4,
  p_expires_at timestamptz default null
)
returns public.matchmaking_lobbies
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
  selected_slot public.tutor_availability_slots;
  selected_subject public.subjects;
  selected_tutor public.tutor_profiles;
  saved_lobby public.matchmaking_lobbies;
  cleaned_min integer;
  cleaned_max integer;
begin
  perform public.refresh_expired_matchmaking_lobbies();

  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null or current_profile.role <> 'student' then
    raise exception 'Only students can create group lobbies.';
  end if;

  select slots.*
  into selected_slot
  from public.tutor_availability_slots slots
  join public.tutor_profiles tutors on tutors.id = slots.tutor_profile_id
  where slots.id = p_availability_slot_id
    and slots.status = 'available'
    and tutors.status = 'approved'
  for update;

  if selected_slot.id is null then
    raise exception 'Tutor slot is not available.';
  end if;

  select * into selected_subject from public.subjects where id = selected_slot.subject_id;
  select * into selected_tutor from public.tutor_profiles where id = selected_slot.tutor_profile_id;

  cleaned_max := least(greatest(coalesce(p_max_participants, selected_slot.max_participants), 2), selected_slot.max_participants);
  cleaned_min := least(greatest(coalesce(p_min_participants, 2), 2), cleaned_max);

  insert into public.matchmaking_lobbies (
    code,
    creator_id,
    subject_id,
    tutor_profile_id,
    availability_slot_id,
    title,
    description,
    visibility,
    status,
    min_participants,
    max_participants,
    price_total,
    expires_at
  )
  values (
    public.generate_matchmaking_code(coalesce(selected_subject.code, selected_subject.name, 'FYP')),
    current_profile.id,
    selected_slot.subject_id,
    selected_slot.tutor_profile_id,
    selected_slot.id,
    coalesce(nullif(trim(coalesce(p_title, '')), ''), selected_subject.name || ' bersama ' || selected_tutor.full_name),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_visibility, 'public'),
    'open',
    cleaned_min,
    cleaned_max,
    selected_slot.price_total,
    coalesce(p_expires_at, now() + interval '6 hours')
  )
  returning * into saved_lobby;

  insert into public.matchmaking_lobby_members (lobby_id, student_id, status)
  values (saved_lobby.id, current_profile.id, 'active');

  update public.tutor_availability_slots
  set status = 'held'
  where id = selected_slot.id;

  return saved_lobby;
end;
$$;

create or replace function public.join_matchmaking_lobby(p_lobby_code text)
returns public.matchmaking_lobbies
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
  selected_lobby public.matchmaking_lobbies;
  active_members integer;
begin
  perform public.refresh_expired_matchmaking_lobbies();

  select *
  into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null or current_profile.role <> 'student' then
    raise exception 'Only students can join group lobbies.';
  end if;

  select *
  into selected_lobby
  from public.matchmaking_lobbies
  where upper(code) = upper(trim(p_lobby_code))
    and status = 'open'
  for update;

  if selected_lobby.id is null then
    raise exception 'Lobby code is not available.';
  end if;

  select count(*)
  into active_members
  from public.matchmaking_lobby_members
  where lobby_id = selected_lobby.id
    and status = 'active';

  if active_members >= selected_lobby.max_participants then
    raise exception 'Lobby is already full.';
  end if;

  insert into public.matchmaking_lobby_members (lobby_id, student_id, status, joined_at, left_at)
  values (selected_lobby.id, current_profile.id, 'active', now(), null)
  on conflict (lobby_id, student_id) do update
    set status = 'active',
        joined_at = case
          when public.matchmaking_lobby_members.status <> 'active' then now()
          else public.matchmaking_lobby_members.joined_at
        end,
        left_at = null;

  return selected_lobby;
end;
$$;

create or replace function public.cancel_matchmaking_lobby(target_lobby_id uuid)
returns public.matchmaking_lobbies
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_lobby public.matchmaking_lobbies;
begin
  select *
  into selected_lobby
  from public.matchmaking_lobbies
  where id = target_lobby_id
    and status = 'open'
    and (creator_id = auth.uid() or public.is_admin())
  for update;

  if selected_lobby.id is null then
    raise exception 'Only open lobbies can be cancelled by the creator.';
  end if;

  update public.matchmaking_lobbies
  set status = 'cancelled'
  where id = selected_lobby.id
  returning * into selected_lobby;

  update public.matchmaking_lobby_members
  set status = 'cancelled',
      left_at = now()
  where lobby_id = selected_lobby.id;

  update public.tutor_availability_slots
  set status = 'available'
  where id = selected_lobby.availability_slot_id
    and status = 'held';

  return selected_lobby;
end;
$$;

create or replace function public.close_matchmaking_lobby_for_payment(target_lobby_id uuid)
returns public.matchmaking_lobbies
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_lobby public.matchmaking_lobbies;
  active_members integer;
  split_amount integer;
  member_record record;
begin
  perform public.refresh_expired_matchmaking_lobbies();

  select *
  into selected_lobby
  from public.matchmaking_lobbies
  where id = target_lobby_id
    and status = 'open'
    and creator_id = auth.uid()
  for update;

  if selected_lobby.id is null then
    raise exception 'Only the lobby creator can finalize an open lobby.';
  end if;

  select count(*)
  into active_members
  from public.matchmaking_lobby_members
  where lobby_id = selected_lobby.id
    and status = 'active';

  if active_members < selected_lobby.min_participants then
    raise exception 'Minimum participants have not joined yet.';
  end if;

  split_amount := ceil(selected_lobby.price_total::numeric / greatest(active_members, 1))::integer;

  update public.matchmaking_lobbies
  set status = 'pending_payment',
      payment_due_at = now() + interval '24 hours'
  where id = selected_lobby.id
  returning * into selected_lobby;

  for member_record in
    select student_id
    from public.matchmaking_lobby_members
    where lobby_id = selected_lobby.id
      and status = 'active'
  loop
    insert into public.matchmaking_lobby_payments (
      lobby_id,
      student_id,
      amount,
      payment_method,
      status,
      invoice_code
    )
    values (
      selected_lobby.id,
      member_record.student_id,
      split_amount,
      'qris',
      'pending',
      'INV-' || replace(selected_lobby.code, '-', '') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
    )
    on conflict (lobby_id, student_id) do update
      set amount = excluded.amount,
          payment_method = excluded.payment_method,
          status = case
            when public.matchmaking_lobby_payments.status = 'paid' then 'paid'::public.matchmaking_payment_status
            else 'pending'::public.matchmaking_payment_status
          end;
  end loop;

  return selected_lobby;
end;
$$;

create or replace function public.pay_matchmaking_invoice(
  target_payment_id uuid,
  p_payment_method text default 'qris'
)
returns public.matchmaking_lobby_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_payment public.matchmaking_lobby_payments;
  selected_lobby public.matchmaking_lobbies;
  selected_slot public.tutor_availability_slots;
  unpaid_count integer;
  new_session_id uuid;
  session_code text;
  member_record record;
begin
  perform public.refresh_expired_matchmaking_lobbies();

  select *
  into selected_payment
  from public.matchmaking_lobby_payments
  where id = target_payment_id
    and student_id = auth.uid()
    and status = 'pending'
  for update;

  if selected_payment.id is null then
    raise exception 'Pending invoice not found.';
  end if;

  select *
  into selected_lobby
  from public.matchmaking_lobbies
  where id = selected_payment.lobby_id
    and status = 'pending_payment'
  for update;

  if selected_lobby.id is null then
    raise exception 'Lobby is not waiting for payment.';
  end if;

  update public.matchmaking_lobby_payments
  set status = 'paid',
      payment_method = coalesce(nullif(trim(coalesce(p_payment_method, '')), ''), 'qris'),
      paid_at = now()
  where id = selected_payment.id
  returning * into selected_payment;

  select count(*)
  into unpaid_count
  from public.matchmaking_lobby_payments
  where lobby_id = selected_lobby.id
    and status <> 'paid';

  if unpaid_count = 0 then
    select *
    into selected_slot
    from public.tutor_availability_slots
    where id = selected_lobby.availability_slot_id
    for update;

    session_code := 'GRP-' || selected_lobby.code;

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
    values (
      selected_lobby.tutor_profile_id,
      selected_lobby.subject_id,
      session_code,
      selected_lobby.title,
      selected_slot.starts_at,
      selected_slot.ends_at,
      selected_payment.amount,
      selected_lobby.max_participants,
      selected_slot.location,
      'scheduled'
    )
    on conflict (code) do update
      set title = excluded.title,
          price_per_seat = excluded.price_per_seat,
          capacity = excluded.capacity,
          status = excluded.status
    returning id into new_session_id;

    for member_record in
      select members.student_id, payments.amount
      from public.matchmaking_lobby_members members
      join public.matchmaking_lobby_payments payments
        on payments.lobby_id = members.lobby_id
       and payments.student_id = members.student_id
      where members.lobby_id = selected_lobby.id
        and members.status = 'active'
    loop
      insert into public.bookings (session_id, student_id, status, total_price)
      values (new_session_id, member_record.student_id, 'upcoming', member_record.amount)
      on conflict (session_id, student_id) do update
        set status = 'upcoming',
            total_price = excluded.total_price;
    end loop;

    update public.matchmaking_lobbies
    set status = 'paid',
        course_session_id = new_session_id
    where id = selected_lobby.id;

    update public.tutor_availability_slots
    set status = 'booked'
    where id = selected_slot.id;
  end if;

  return selected_payment;
end;
$$;

create or replace function public.can_read_matchmaking_lobby(target_lobby_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.matchmaking_lobbies lobbies
    join public.tutor_profiles tutors on tutors.id = lobbies.tutor_profile_id
    where lobbies.id = target_lobby_id
      and (
        public.is_admin()
        or lobbies.visibility = 'public'
        or lobbies.creator_id = auth.uid()
        or tutors.user_id = auth.uid()
        or exists (
          select 1
          from public.matchmaking_lobby_members members
          where members.lobby_id = lobbies.id
            and members.student_id = auth.uid()
            and members.status = 'active'
        )
      )
  );
$$;

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

drop view if exists public.matchmaking_lobby_overview;
create view public.matchmaking_lobby_overview
with (security_invoker = true)
as
select
  lobbies.id,
  lobbies.code,
  lobbies.creator_id,
  coalesce(creators.full_name, creators.email) as creator_name,
  lobbies.subject_id,
  subjects.name as subject_name,
  subjects.code as subject_code,
  lobbies.tutor_profile_id,
  tutors.full_name as tutor_name,
  tutors.rating as tutor_rating,
  tutors.reviews_count as tutor_reviews_count,
  tutors.image_url as tutor_image_url,
  lobbies.availability_slot_id,
  slots.starts_at,
  slots.ends_at,
  slots.location,
  lobbies.course_session_id,
  lobbies.title,
  lobbies.description,
  lobbies.visibility,
  lobbies.status,
  lobbies.min_participants,
  lobbies.max_participants,
  lobbies.price_total,
  lobbies.expires_at,
  lobbies.payment_due_at,
  lobbies.created_at,
  lobbies.updated_at,
  count(members.id) filter (where members.status = 'active')::integer as member_count,
  ceil(lobbies.price_total::numeric / greatest(count(members.id) filter (where members.status = 'active'), 1))::integer as price_per_member,
  exists (
    select 1
    from public.matchmaking_lobby_members own_member
    where own_member.lobby_id = lobbies.id
      and own_member.student_id = auth.uid()
      and own_member.status = 'active'
  ) as current_user_is_member,
  lobbies.creator_id = auth.uid() as current_user_is_creator
from public.matchmaking_lobbies lobbies
join public.subjects subjects on subjects.id = lobbies.subject_id
join public.tutor_profiles tutors on tutors.id = lobbies.tutor_profile_id
join public.tutor_availability_slots slots on slots.id = lobbies.availability_slot_id
join public.profiles creators on creators.id = lobbies.creator_id
left join public.matchmaking_lobby_members members on members.lobby_id = lobbies.id
where
  public.can_read_matchmaking_lobby(lobbies.id)
group by lobbies.id, subjects.id, tutors.id, slots.id, creators.id;

alter table public.tutor_availability_slots enable row level security;
alter table public.matchmaking_lobbies enable row level security;
alter table public.matchmaking_lobby_members enable row level security;
alter table public.matchmaking_lobby_payments enable row level security;

drop policy if exists "Availability slots are readable by students and owners" on public.tutor_availability_slots;
create policy "Availability slots are readable by students and owners"
on public.tutor_availability_slots
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.tutor_profiles tutors
    where tutors.id = tutor_availability_slots.tutor_profile_id
      and tutors.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.tutor_profiles tutors
    where tutors.id = tutor_availability_slots.tutor_profile_id
      and tutors.status = 'approved'
  )
);

drop policy if exists "Lobbies are readable by visible participants" on public.matchmaking_lobbies;
create policy "Lobbies are readable by visible participants"
on public.matchmaking_lobbies
for select
to authenticated
using (
  public.can_read_matchmaking_lobby(id)
);

drop policy if exists "Lobby members are readable by visible participants" on public.matchmaking_lobby_members;
create policy "Lobby members are readable by visible participants"
on public.matchmaking_lobby_members
for select
to authenticated
using (
  public.can_read_matchmaking_lobby(lobby_id)
);

drop policy if exists "Lobby payments are readable by owners and staff" on public.matchmaking_lobby_payments;
create policy "Lobby payments are readable by owners and staff"
on public.matchmaking_lobby_payments
for select
to authenticated
using (
  public.is_admin()
  or student_id = auth.uid()
  or exists (
    select 1
    from public.matchmaking_lobbies lobbies
    join public.tutor_profiles tutors on tutors.id = lobbies.tutor_profile_id
    where lobbies.id = matchmaking_lobby_payments.lobby_id
      and tutors.user_id = auth.uid()
  )
);

grant select on public.tutor_availability_overview to authenticated;
grant select on public.matchmaking_lobby_overview to authenticated;
grant select on public.tutor_availability_slots to authenticated;
grant select on public.matchmaking_lobbies to authenticated;
grant select on public.matchmaking_lobby_members to authenticated;
grant select on public.matchmaking_lobby_payments to authenticated;
grant execute on function public.upsert_my_tutor_profile(text, uuid, integer, text, text) to authenticated;
grant execute on function public.create_tutor_availability(uuid, timestamptz, timestamptz, integer, integer, text, text, text) to authenticated;
grant execute on function public.cancel_tutor_availability(uuid) to authenticated;
grant execute on function public.refresh_expired_matchmaking_lobbies() to authenticated;
grant execute on function public.create_matchmaking_lobby(uuid, text, text, public.matchmaking_lobby_visibility, integer, integer, timestamptz) to authenticated;
grant execute on function public.join_matchmaking_lobby(text) to authenticated;
grant execute on function public.cancel_matchmaking_lobby(uuid) to authenticated;
grant execute on function public.close_matchmaking_lobby_for_payment(uuid) to authenticated;
grant execute on function public.pay_matchmaking_invoice(uuid, text) to authenticated;
grant execute on function public.can_read_matchmaking_lobby(uuid) to authenticated;

notify pgrst, 'reload schema';
