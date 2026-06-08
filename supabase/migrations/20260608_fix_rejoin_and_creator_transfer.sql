-- ============================================================================
-- FYP Foundation: Fix Rejoin Paid Lobbies & Automatic Creator Transfer on Leave
-- ============================================================================

-- 1. Update public.join_matchmaking_lobby to preserve 'paid' payment status
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
  DO UPDATE SET 
    status = CASE WHEN public.matchmaking_lobby_payments.status = 'paid' THEN 'paid' ELSE 'pending' END,
    amount = v_amount_per_member,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update public.force_lobby_to_pending_payment to preserve 'paid' payment status and handle immediate resolution
CREATE OR REPLACE FUNCTION public.force_lobby_to_pending_payment(
  p_lobby_id uuid
)
RETURNS void AS $$
DECLARE
  v_creator_id uuid;
  v_price_total integer;
  v_max_participants integer;
  v_amount_per_member integer;
  v_active_members integer;
  v_paid_members integer;
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

  -- Create/update matchmaking_lobby_payments for the creator/calling user
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
  DO UPDATE SET 
    status = CASE WHEN public.matchmaking_lobby_payments.status = 'paid' THEN 'paid' ELSE 'pending' END,
    amount = v_amount_per_member,
    updated_at = now();

  -- Count total active members
  SELECT count(*) INTO v_active_members
  FROM public.matchmaking_lobby_members
  WHERE lobby_id = p_lobby_id AND status = 'active';

  -- Count total paid active members
  SELECT count(*) INTO v_paid_members
  FROM public.matchmaking_lobby_members m
  JOIN public.matchmaking_lobby_payments p ON m.lobby_id = p.lobby_id AND m.student_id = p.student_id
  WHERE m.lobby_id = p_lobby_id AND m.status = 'active' AND p.status = 'paid';

  -- If all active members are paid, change status back to open/paid, otherwise pending_payment
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
  ELSE
    -- Set lobby status to pending_payment and expires_at to 1 hour from now
    UPDATE public.matchmaking_lobbies
    SET status = 'pending_payment',
        expires_at = now() + interval '1 hour',
        updated_at = now()
    WHERE id = p_lobby_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Create Trigger Function and Trigger for automatic empty lobby cancellation and creator transfer
CREATE OR REPLACE FUNCTION public.on_matchmaking_lobby_member_leave()
RETURNS trigger AS $$
DECLARE
  v_active_count integer;
  v_creator_id uuid;
  v_new_creator_id uuid;
  v_slot_id uuid;
BEGIN
  -- Only execute if the member status changed to 'left'
  IF NEW.status = 'left' AND OLD.status = 'active' THEN
    -- Get current active member count
    SELECT count(*) INTO v_active_count
    FROM public.matchmaking_lobby_members
    WHERE lobby_id = NEW.lobby_id AND status = 'active';

    IF v_active_count = 0 THEN
      -- Get slot ID associated with this lobby
      SELECT availability_slot_id INTO v_slot_id
      FROM public.matchmaking_lobbies
      WHERE id = NEW.lobby_id;

      -- Reset slot back to available
      UPDATE public.tutor_availability_slots
      SET status = 'available', updated_at = now()
      WHERE id = v_slot_id;

      -- Cancel lobby
      UPDATE public.matchmaking_lobbies
      SET status = 'cancelled', updated_at = now()
      WHERE id = NEW.lobby_id;
    ELSE
      -- Check if the leaving student was the creator of the lobby
      SELECT creator_id INTO v_creator_id
      FROM public.matchmaking_lobbies
      WHERE id = NEW.lobby_id;

      IF v_creator_id = NEW.student_id THEN
        -- Find the oldest active member (earliest joined_at)
        SELECT student_id INTO v_new_creator_id
        FROM public.matchmaking_lobby_members
        WHERE lobby_id = NEW.lobby_id AND status = 'active'
        ORDER BY joined_at ASC
        LIMIT 1;

        IF v_new_creator_id IS NOT NULL THEN
          -- Transfer creator status
          UPDATE public.matchmaking_lobbies
          SET creator_id = v_new_creator_id, updated_at = now()
          WHERE id = NEW.lobby_id;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_matchmaking_lobby_member_leave ON public.matchmaking_lobby_members;
CREATE TRIGGER trg_matchmaking_lobby_member_leave
AFTER UPDATE ON public.matchmaking_lobby_members
FOR EACH ROW
EXECUTE FUNCTION public.on_matchmaking_lobby_member_leave();
