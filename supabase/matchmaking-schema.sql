-- Table: matchmaking_rooms
-- Stores matchmaking rooms created by students

create table if not exists public.matchmaking_rooms (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  is_public boolean not null default true,
  status text not null default 'open', -- open, matched, closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_matchmaking_rooms_student_id on public.matchmaking_rooms(student_id);
create index if not exists idx_matchmaking_rooms_subject_id on public.matchmaking_rooms(subject_id);
create index if not exists idx_matchmaking_rooms_is_public on public.matchmaking_rooms(is_public);

-- Table: matchmaking_room_tutors
-- Stores tutors who join or are matched to a room

create table if not exists public.matchmaking_room_tutors (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.matchmaking_rooms(id) on delete cascade,
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (room_id, tutor_profile_id)
);

create index if not exists idx_matchmaking_room_tutors_room_id on public.matchmaking_room_tutors(room_id);
create index if not exists idx_matchmaking_room_tutors_tutor_profile_id on public.matchmaking_room_tutors(tutor_profile_id);
