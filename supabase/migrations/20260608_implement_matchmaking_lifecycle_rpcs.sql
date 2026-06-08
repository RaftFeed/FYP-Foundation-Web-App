-- ============================================================================
-- FYP Foundation: Matchmaking Lifecycle RPCs & Database Functions
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Setup Types and Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_custom_types()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('student', 'tutor', 'admin');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tutor_status') THEN
    CREATE TYPE public.tutor_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tutor_availability_status') THEN
    CREATE TYPE public.tutor_availability_status AS ENUM ('available', 'held', 'booked', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'matchmaking_lobby_visibility') THEN
    CREATE TYPE public.matchmaking_lobby_visibility AS ENUM ('public', 'private');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'matchmaking_lobby_status') THEN
    CREATE TYPE public.matchmaking_lobby_status AS ENUM ('open', 'pending_payment', 'paid', 'expired', 'cancelled', 'completed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'matchmaking_lobby_member_status') THEN
    CREATE TYPE public.matchmaking_lobby_member_status AS ENUM ('active', 'left');
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT create_custom_types();
DROP FUNCTION create_custom_types();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: create_tutor_availability
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_tutor_availability(uuid, timestamp with time zone, timestamp with time zone, integer, integer, text, text, text, uuid, text, integer);

CREATE OR REPLACE FUNCTION public.create_tutor_availability(
  p_subject_id uuid,
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone,
  p_price_total integer,
  p_max_participants integer,
  p_location text DEFAULT 'Online'::text,
  p_meeting_url text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_recurrence_group_id uuid DEFAULT NULL::uuid,
  p_recurrence_pattern text DEFAULT 'none'::text,
  p_recurrence_index integer DEFAULT 0
)
RETURNS void AS $$
DECLARE
  v_tutor_profile_id uuid;
BEGIN
  -- Get tutor profile ID associated with calling user
  SELECT id INTO v_tutor_profile_id
  FROM public.tutor_profiles
  WHERE user_id = auth.uid();
  
  IF v_tutor_profile_id IS NULL THEN
    RAISE EXCEPTION 'User is not registered as a tutor';
  END IF;

  INSERT INTO public.tutor_availability_slots (
    tutor_profile_id,
    subject_id,
    starts_at,
    ends_at,
    price_total,
    max_participants,
    location,
    meeting_url,
    notes,
    recurrence_group_id,
    recurrence_pattern,
    recurrence_index,
    status
  ) VALUES (
    v_tutor_profile_id,
    p_subject_id,
    p_starts_at,
    p_ends_at,
    p_price_total,
    p_max_participants,
    COALESCE(p_location, 'Online'),
    p_meeting_url,
    p_notes,
    p_recurrence_group_id,
    COALESCE(p_recurrence_pattern, 'none'),
    COALESCE(p_recurrence_index, 0),
    'available'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: cancel_tutor_availability
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.cancel_tutor_availability(uuid);

CREATE OR REPLACE FUNCTION public.cancel_tutor_availability(
  target_slot_id uuid
)
RETURNS void AS $$
DECLARE
  v_tutor_profile_id uuid;
  v_slot_status public.tutor_availability_status;
BEGIN
  SELECT id INTO v_tutor_profile_id
  FROM public.tutor_profiles
  WHERE user_id = auth.uid();

  -- Check if slot exists and belongs to the tutor
  SELECT status INTO v_slot_status
  FROM public.tutor_availability_slots
  WHERE id = target_slot_id AND tutor_profile_id = v_tutor_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found or does not belong to you';
  END IF;

  IF v_slot_status = 'booked' THEN
    RAISE EXCEPTION 'Cannot cancel a slot that is already booked';
  END IF;

  UPDATE public.tutor_availability_slots
  SET status = 'cancelled', updated_at = now()
  WHERE id = target_slot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: create_matchmaking_lobby
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_matchmaking_lobby(uuid, text, text, text, integer, integer, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.create_matchmaking_lobby(
  p_availability_slot_id uuid,
  p_title text,
  p_description text,
  p_visibility text,
  p_min_participants integer,
  p_max_participants integer,
  p_expires_at timestamp with time zone
)
RETURNS void AS $$
DECLARE
  v_slot_status public.tutor_availability_status;
  v_tutor_profile_id uuid;
  v_subject_id uuid;
  v_price_total integer;
  v_lobby_id uuid;
  v_lobby_code text;
BEGIN
  -- Get slot details
  SELECT status, tutor_profile_id, subject_id, price_total
  INTO v_slot_status, v_tutor_profile_id, v_subject_id, v_price_total
  FROM public.tutor_availability_slots
  WHERE id = p_availability_slot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot availability not found';
  END IF;

  IF v_slot_status <> 'available' THEN
    RAISE EXCEPTION 'Slot is not available';
  END IF;

  -- Generate unique code e.g. LOB-XXXXXX
  LOOP
    v_lobby_code := 'LOB-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.matchmaking_lobbies WHERE code = v_lobby_code);
  END LOOP;

  -- Update slot to held
  UPDATE public.tutor_availability_slots
  SET status = 'held', updated_at = now()
  WHERE id = p_availability_slot_id;

  -- Create lobby
  INSERT INTO public.matchmaking_lobbies (
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
  ) VALUES (
    v_lobby_code,
    auth.uid(),
    v_subject_id,
    v_tutor_profile_id,
    p_availability_slot_id,
    p_title,
    p_description,
    p_visibility::public.matchmaking_lobby_visibility,
    'open'::public.matchmaking_lobby_status,
    p_min_participants,
    p_max_participants,
    v_price_total,
    p_expires_at
  ) RETURNING id INTO v_lobby_id;

  -- Join the creator as active
  INSERT INTO public.matchmaking_lobby_members (
    lobby_id,
    student_id,
    status
  ) VALUES (
    v_lobby_id,
    auth.uid(),
    'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: force_lobby_to_pending_payment
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.force_lobby_to_pending_payment(uuid);

CREATE OR REPLACE FUNCTION public.force_lobby_to_pending_payment(
  p_lobby_id uuid
)
RETURNS void AS $$
DECLARE
  v_creator_id uuid;
  v_price_total integer;
  v_max_participants integer;
  v_amount_per_member integer;
BEGIN
  -- Get lobby details
  SELECT creator_id, price_total, max_participants
  INTO v_creator_id, v_price_total, v_max_participants
  FROM public.matchmaking_lobbies
  WHERE id = p_lobby_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  v_amount_per_member := ceil(v_price_total::numeric / v_max_participants::numeric);

  -- Set lobby status to pending_payment and expires_at to 1 hour from now
  UPDATE public.matchmaking_lobbies
  SET status = 'pending_payment',
      expires_at = now() + interval '1 hour',
      updated_at = now()
  WHERE id = p_lobby_id;

  -- Create/update matchmaking_lobby_payments for the creator as pending if it doesn't exist yet
  INSERT INTO public.matchmaking_lobby_payments (
    lobby_id,
    student_id,
    amount,
    status,
    updated_at
  ) VALUES (
    p_lobby_id,
    auth.uid(),
    v_amount_per_member,
    'pending',
    now()
  )
  ON CONFLICT (lobby_id, student_id) 
  DO UPDATE SET status = EXCLUDED.status, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: join_matchmaking_lobby
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.join_matchmaking_lobby(text);
DROP FUNCTION IF EXISTS public.join_matchmaking_lobby(uuid);

CREATE OR REPLACE FUNCTION public.join_matchmaking_lobby(
  p_lobby_code text
)
RETURNS void AS $$
DECLARE
  v_lobby_id uuid;
  v_lobby_status public.matchmaking_lobby_status;
  v_starts_at timestamp with time zone;
  v_price_total integer;
  v_max_participants integer;
  v_current_members integer;
  v_amount_per_member integer;
BEGIN
  -- Find lobby by code
  SELECT l.id, l.status, s.starts_at, l.price_total, l.max_participants
  INTO v_lobby_id, v_lobby_status, v_starts_at, v_price_total, v_max_participants
  FROM public.matchmaking_lobbies l
  JOIN public.tutor_availability_slots s ON l.availability_slot_id = s.id
  WHERE l.code = upper(trim(p_lobby_code));

  IF v_lobby_id IS NULL THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  -- Verify lobby status
  IF v_lobby_status IN ('expired', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'Lobby is no longer active';
  END IF;

  -- Enforce lock deadline: 1 day (24 hours) before class starts
  IF v_starts_at <= now() + interval '1 day' THEN
    RAISE EXCEPTION 'Lobby is locked. Joining is closed 24 hours before tutoring starts.';
  END IF;

  -- Count current active members
  SELECT count(*) INTO v_current_members
  FROM public.matchmaking_lobby_members
  WHERE lobby_id = v_lobby_id AND status = 'active';

  IF v_current_members >= v_max_participants THEN
    RAISE EXCEPTION 'Lobby is full';
  END IF;

  -- Check if already an active member
  IF EXISTS (
    SELECT 1 FROM public.matchmaking_lobby_members
    WHERE lobby_id = v_lobby_id AND student_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You are already a member of this lobby';
  END IF;

  -- Upsert member to active
  INSERT INTO public.matchmaking_lobby_members (
    lobby_id,
    student_id,
    status,
    joined_at,
    updated_at
  ) VALUES (
    v_lobby_id,
    auth.uid(),
    'active',
    now(),
    now()
  )
  ON CONFLICT (lobby_id, student_id)
  DO UPDATE SET status = 'active', joined_at = now(), left_at = NULL, updated_at = now();

  -- Calculate fee per member
  v_amount_per_member := ceil(v_price_total::numeric / v_max_participants::numeric);

  -- Create pending payment for the joiner
  INSERT INTO public.matchmaking_lobby_payments (
    lobby_id,
    student_id,
    amount,
    status,
    updated_at
  ) VALUES (
    v_lobby_id,
    auth.uid(),
    v_amount_per_member,
    'pending',
    now()
  )
  ON CONFLICT (lobby_id, student_id)
  DO UPDATE SET status = 'pending', amount = v_amount_per_member, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: pay_lobby_share_fixed
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.pay_lobby_share_fixed(uuid);

CREATE OR REPLACE FUNCTION public.pay_lobby_share_fixed(
  p_lobby_id uuid
)
RETURNS void AS $$
DECLARE
  v_amount integer;
  v_lobby_status public.matchmaking_lobby_status;
  v_max_participants integer;
  v_active_members integer;
  v_paid_members integer;
BEGIN
  -- Get lobby price_total / max_participants
  SELECT status, max_participants
  INTO v_lobby_status, v_max_participants
  FROM public.matchmaking_lobbies
  WHERE id = p_lobby_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  IF v_lobby_status NOT IN ('pending_payment', 'open') THEN
    RAISE EXCEPTION 'Payment cannot be processed for lobby status: %', v_lobby_status;
  END IF;

  -- Update payment status to paid for the caller
  UPDATE public.matchmaking_lobby_payments
  SET status = 'paid', paid_at = now(), updated_at = now()
  WHERE lobby_id = p_lobby_id AND student_id = auth.uid();

  -- Count total active members
  SELECT count(*) INTO v_active_members
  FROM public.matchmaking_lobby_members
  WHERE lobby_id = p_lobby_id AND status = 'active';

  -- Count total paid active members
  SELECT count(*) INTO v_paid_members
  FROM public.matchmaking_lobby_members m
  JOIN public.matchmaking_lobby_payments p ON m.lobby_id = p.lobby_id AND m.student_id = p.student_id
  WHERE m.lobby_id = p_lobby_id AND m.status = 'active' AND p.status = 'paid';

  -- If all active members are paid, change status
  IF v_active_members = v_paid_members AND v_active_members > 0 THEN
    IF v_active_members >= v_max_participants THEN
      UPDATE public.matchmaking_lobbies
      SET status = 'paid', updated_at = now()
      WHERE id = p_lobby_id;
    ELSE
      UPDATE public.matchmaking_lobbies
      SET status = 'open', updated_at = now()
      WHERE id = p_lobby_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RPC: cancel_matchmaking_lobby
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.cancel_matchmaking_lobby(uuid);

CREATE OR REPLACE FUNCTION public.cancel_matchmaking_lobby(
  target_lobby_id uuid
)
RETURNS void AS $$
DECLARE
  v_creator_id uuid;
  v_slot_id uuid;
BEGIN
  -- Verify lobby belongs to the creator
  SELECT creator_id, availability_slot_id INTO v_creator_id, v_slot_id
  FROM public.matchmaking_lobbies
  WHERE id = target_lobby_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;

  IF v_creator_id <> auth.uid() THEN
    -- Check if calling user is admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only the creator or an admin can cancel the lobby';
    END IF;
  END IF;

  -- Reset tutor availability slot to available
  UPDATE public.tutor_availability_slots
  SET status = 'available', updated_at = now()
  WHERE id = v_slot_id;

  -- Set lobby status to cancelled
  UPDATE public.matchmaking_lobbies
  SET status = 'cancelled', updated_at = now()
  WHERE id = target_lobby_id;

  -- Update active members status to left
  UPDATE public.matchmaking_lobby_members
  SET status = 'left', left_at = now(), updated_at = now()
  WHERE lobby_id = target_lobby_id AND status = 'active';

  -- Mark payments as refund_pending if they were paid
  UPDATE public.matchmaking_lobby_payments
  SET status = 'refunded', updated_at = now()
  WHERE lobby_id = target_lobby_id AND status = 'paid';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RPC: kick_matchmaking_lobby_member
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.kick_matchmaking_lobby_member(uuid, uuid);

CREATE OR REPLACE FUNCTION public.kick_matchmaking_lobby_member(
  p_lobby_id uuid,
  p_student_id uuid
)
RETURNS void AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  -- Verify calling user is the lobby creator
  SELECT creator_id INTO v_creator_id
  FROM public.matchmaking_lobbies
  WHERE id = p_lobby_id;

  IF v_creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the lobby creator can kick members';
  END IF;

  IF p_student_id = v_creator_id THEN
    RAISE EXCEPTION 'Creator cannot kick themselves. Use leave/dissolve instead.';
  END IF;

  -- Update member status
  UPDATE public.matchmaking_lobby_members
  SET status = 'left', left_at = now(), updated_at = now()
  WHERE lobby_id = p_lobby_id AND student_id = p_student_id AND status = 'active';

  -- Refund their payment
  UPDATE public.matchmaking_lobby_payments
  SET status = 'refunded', updated_at = now()
  WHERE lobby_id = p_lobby_id AND student_id = p_student_id AND status = 'paid';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RPC: cleanup_expired_lobbies_and_slots
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.cleanup_expired_lobbies_and_slots();

CREATE OR REPLACE FUNCTION public.cleanup_expired_lobbies_and_slots()
RETURNS void AS $$
DECLARE
  v_lobby RECORD;
  v_payment RECORD;
BEGIN
  -- 1. Expire unpaid lobbies (creator has 1 hour to pay from lobby expires_at)
  FOR v_lobby IN 
    SELECT l.id, l.availability_slot_id
    FROM public.matchmaking_lobbies l
    WHERE l.status = 'pending_payment'
      AND l.expires_at < now()
  LOOP
    -- Check if creator payment is paid
    IF NOT EXISTS (
      SELECT 1 FROM public.matchmaking_lobby_payments
      WHERE lobby_id = v_lobby.id AND student_id = (SELECT creator_id FROM public.matchmaking_lobbies WHERE id = v_lobby.id) AND status = 'paid'
    ) THEN
      -- Mark lobby as expired
      UPDATE public.matchmaking_lobbies
      SET status = 'expired', updated_at = now()
      WHERE id = v_lobby.id;

      -- Release slot back to available
      UPDATE public.tutor_availability_slots
      SET status = 'available', updated_at = now()
      WHERE id = v_lobby.availability_slot_id;

      -- Refund any other participants who might have paid
      UPDATE public.matchmaking_lobby_payments
      SET status = 'refunded', updated_at = now()
      WHERE lobby_id = v_lobby.id AND status = 'paid';

      -- Deactivate members
      UPDATE public.matchmaking_lobby_members
      SET status = 'left', left_at = now(), updated_at = now()
      WHERE lobby_id = v_lobby.id AND status = 'active';
    END IF;
  END LOOP;

  -- 2. Handle joiner individual payment deadlines (1 hour from payment creation)
  FOR v_payment IN
    SELECT p.lobby_id, p.student_id, l.creator_id
    FROM public.matchmaking_lobby_payments p
    JOIN public.matchmaking_lobbies l ON p.lobby_id = l.id
    WHERE p.status = 'pending'
      AND p.created_at < now() - interval '1 hour'
  LOOP
    -- If they are not the creator (creator is handled above)
    IF v_payment.student_id <> v_payment.creator_id THEN
      -- Deactivate their membership
      UPDATE public.matchmaking_lobby_members
      SET status = 'left', left_at = now(), updated_at = now()
      WHERE lobby_id = v_payment.lobby_id AND student_id = v_payment.student_id AND status = 'active';

      -- Update payment status to failed
      UPDATE public.matchmaking_lobby_payments
      SET status = 'failed', updated_at = now()
      WHERE lobby_id = v_payment.lobby_id AND student_id = v_payment.student_id;
    END IF;
  END LOOP;

  -- 3. Transition slots and lobbies to completed when tutoring ends
  -- Check if slot ends_at has passed
  UPDATE public.matchmaking_lobbies l
  SET status = 'completed', updated_at = now()
  FROM public.tutor_availability_slots s
  WHERE l.availability_slot_id = s.id
    AND l.status IN ('open', 'paid')
    AND s.ends_at < now();

  -- Update tutor slot status to booked if it was completed / held by a paid class
  UPDATE public.tutor_availability_slots s
  SET status = 'booked', updated_at = now()
  FROM public.matchmaking_lobbies l
  WHERE l.availability_slot_id = s.id
    AND l.status IN ('paid', 'completed')
    AND s.status = 'held';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RPC: expire_unpaid_and_cleanup_lobbies (Alias for backwards compatibility)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.expire_unpaid_and_cleanup_lobbies();

CREATE OR REPLACE FUNCTION public.expire_unpaid_and_cleanup_lobbies()
RETURNS void AS $$
BEGIN
  PERFORM public.cleanup_expired_lobbies_and_slots();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RPC: upsert_my_tutor_profile
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.upsert_my_tutor_profile(text, uuid, integer, text, text);

CREATE OR REPLACE FUNCTION public.upsert_my_tutor_profile(
  p_full_name text,
  p_subject_id uuid,
  p_hourly_rate integer,
  p_bio text,
  p_image_url text
)
RETURNS public.tutor_profiles AS $$
DECLARE
  v_profile public.tutor_profiles;
BEGIN
  INSERT INTO public.tutor_profiles (
    user_id,
    full_name,
    subject_id,
    hourly_rate,
    bio,
    image_url,
    status,
    updated_at
  ) VALUES (
    auth.uid(),
    p_full_name,
    p_subject_id,
    p_hourly_rate,
    p_bio,
    p_image_url,
    'pending'::public.tutor_status,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    full_name = EXCLUDED.full_name,
    subject_id = EXCLUDED.subject_id,
    hourly_rate = EXCLUDED.hourly_rate,
    bio = EXCLUDED.bio,
    image_url = EXCLUDED.image_url,
    updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
