-- ============================================================================
-- FYP Foundation: Cleanup Overloaded create_matchmaking_lobby Functions
-- ============================================================================

-- Drop the variant that takes public.matchmaking_lobby_visibility
DROP FUNCTION IF EXISTS public.create_matchmaking_lobby(uuid, text, text, public.matchmaking_lobby_visibility, integer, integer, timestamp with time zone);

-- Drop the variant that takes text
DROP FUNCTION IF EXISTS public.create_matchmaking_lobby(uuid, text, text, text, integer, integer, timestamp with time zone);

-- Recreate the sole text variant
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
