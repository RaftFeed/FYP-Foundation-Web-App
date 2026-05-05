-- Table: student_preferences
-- Stores each student's subject preferences for matchmaking

create table if not exists public.student_preferences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, subject_id)
);

-- Index for quick lookup
create index if not exists idx_student_preferences_student_id on public.student_preferences(student_id);
create index if not exists idx_student_preferences_subject_id on public.student_preferences(subject_id);
