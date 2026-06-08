-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  role USER-DEFINED NOT NULL DEFAULT 'student'::user_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  full_name text,
  image_url text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subjects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tutor_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  subject_id uuid,
  full_name text,
  bio text,
  hourly_rate integer NOT NULL CHECK (hourly_rate >= 0),
  rating numeric NOT NULL DEFAULT 0 CHECK (rating >= 0::numeric AND rating <= 5::numeric),
  reviews_count integer NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
  image_url text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::tutor_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tutor_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT tutor_profiles_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT tutor_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  report_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  data jsonb,
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.tutor_availability_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tutor_profile_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  location text NOT NULL DEFAULT 'Online'::text,
  meeting_url text,
  price_total integer NOT NULL CHECK (price_total >= 0),
  max_participants integer NOT NULL DEFAULT 4 CHECK (max_participants > 0),
  status USER-DEFINED NOT NULL DEFAULT 'available'::tutor_availability_status,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  recurrence_group_id uuid,
  recurrence_pattern text NOT NULL DEFAULT 'none'::text CHECK (recurrence_pattern = ANY (ARRAY['none'::text, 'weekly'::text])),
  recurrence_index integer NOT NULL DEFAULT 0 CHECK (recurrence_index >= 0),
  CONSTRAINT tutor_availability_slots_pkey PRIMARY KEY (id),
  CONSTRAINT tutor_availability_slots_tutor_profile_id_fkey FOREIGN KEY (tutor_profile_id) REFERENCES public.tutor_profiles(id),
  CONSTRAINT tutor_availability_slots_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.matchmaking_lobbies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  creator_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  tutor_profile_id uuid NOT NULL,
  availability_slot_id uuid NOT NULL,
  course_session_id uuid,
  title text NOT NULL,
  description text,
  visibility USER-DEFINED NOT NULL DEFAULT 'public'::matchmaking_lobby_visibility,
  status USER-DEFINED NOT NULL DEFAULT 'open'::matchmaking_lobby_status,
  min_participants integer NOT NULL DEFAULT 2 CHECK (min_participants > 0),
  max_participants integer NOT NULL DEFAULT 4 CHECK (max_participants > 0),
  price_total integer NOT NULL CHECK (price_total >= 0),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  net_income integer DEFAULT 0 CHECK (net_income >= 0),
  CONSTRAINT matchmaking_lobbies_pkey PRIMARY KEY (id),
  CONSTRAINT matchmaking_lobbies_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id),
  CONSTRAINT matchmaking_lobbies_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT matchmaking_lobbies_availability_slot_id_fkey FOREIGN KEY (availability_slot_id) REFERENCES public.tutor_availability_slots(id),
  CONSTRAINT matchmaking_lobbies_tutor_profile_id_fkey FOREIGN KEY (tutor_profile_id) REFERENCES public.tutor_profiles(id)
);
CREATE TABLE public.matchmaking_lobby_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL,
  student_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'active'::matchmaking_lobby_member_status,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT matchmaking_lobby_members_pkey PRIMARY KEY (id),
  CONSTRAINT matchmaking_lobby_members_lobby_id_fkey FOREIGN KEY (lobby_id) REFERENCES public.matchmaking_lobbies(id),
  CONSTRAINT matchmaking_lobby_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.student_profiles (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  full_name text,
  CONSTRAINT student_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT student_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);
CREATE TABLE public.admin_profiles (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  full_name text,
  CONSTRAINT admin_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT admin_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);
CREATE TABLE public.matchmaking_lobby_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL,
  student_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'paid'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refund_pending'::text, 'refunded'::text])),
  payment_method text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  invoice_code text,
  paid_at timestamp with time zone,
  CONSTRAINT matchmaking_lobby_payments_pkey PRIMARY KEY (id),
  CONSTRAINT matchmaking_lobby_payments_lobby_id_fkey FOREIGN KEY (lobby_id) REFERENCES public.matchmaking_lobbies(id),
  CONSTRAINT matchmaking_lobby_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.study_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  uploaded_by uuid NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT study_materials_pkey PRIMARY KEY (id),
  CONSTRAINT study_materials_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id),
  CONSTRAINT study_materials_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);