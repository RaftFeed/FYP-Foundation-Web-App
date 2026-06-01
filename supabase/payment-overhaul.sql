-- ===========================================================
-- Payment System Overhaul — Fixed Price, Auto-Expire, Creator Transfer
-- ===========================================================

-- 1. Force a lobby into pending_payment for a specific student
--    Called when student joins/creates a lobby
CREATE OR REPLACE FUNCTION public.force_lobby_to_pending_payment(p_lobby_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.matchmaking_lobbies
  SET status = 'pending_payment',
      expires_at = NOW() + INTERVAL '1 hour',
      updated_at = NOW()
  WHERE id = p_lobby_id
    AND status = 'open';
END;
$$;

-- 2. Expire unpaid students and clean up empty lobbies
--    Run periodically (e.g., via pg_cron every minute) or on page load
CREATE OR REPLACE FUNCTION public.expire_unpaid_and_cleanup_lobbies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lobby RECORD;
  v_member_count INTEGER;
  v_next_creator RECORD;
BEGIN
  -- Step 1: For each expired pending_payment lobby, mark unpaid students as 'left'
  FOR v_lobby IN
    SELECT id FROM public.matchmaking_lobbies
    WHERE status = 'pending_payment'
      AND expires_at < NOW()
  LOOP
    -- Mark all active members who haven't paid as 'left'
    UPDATE public.matchmaking_lobby_members
    SET status = 'left',
        left_at = NOW(),
        updated_at = NOW()
    WHERE lobby_id = v_lobby.id
      AND status = 'active'
      AND student_id NOT IN (
        SELECT student_id FROM public.matchmaking_lobby_payments
        WHERE lobby_id = v_lobby.id AND status = 'paid'
      );

    -- Check how many paid members remain
    SELECT COUNT(DISTINCT m.student_id) INTO v_member_count
    FROM public.matchmaking_lobby_members m
    JOIN public.matchmaking_lobby_payments p
      ON p.lobby_id = m.lobby_id AND p.student_id = m.student_id AND p.status = 'paid'
    WHERE m.lobby_id = v_lobby.id AND m.status = 'active';

    IF v_member_count = 0 THEN
      -- No paid members → delete lobby
      DELETE FROM public.matchmaking_lobby_members WHERE lobby_id = v_lobby.id;
      DELETE FROM public.matchmaking_lobby_payments WHERE lobby_id = v_lobby.id;
      DELETE FROM public.matchmaking_lobbies WHERE id = v_lobby.id;
    ELSE
      -- Has paid members → mark lobby as expired for remaining unpaid
      UPDATE public.matchmaking_lobbies
      SET status = 'completed',
          updated_at = NOW()
      WHERE id = v_lobby.id;
    END IF;
  END LOOP;

  -- Step 2: Delete lobbies with 0 active members
  FOR v_lobby IN
    SELECT l.id FROM public.matchmaking_lobbies l
    LEFT JOIN public.matchmaking_lobby_members m
      ON m.lobby_id = l.id AND m.status = 'active'
    WHERE m.id IS NULL
      AND l.status IN ('open', 'pending_payment')
  LOOP
    DELETE FROM public.matchmaking_lobby_members WHERE lobby_id = v_lobby.id;
    DELETE FROM public.matchmaking_lobby_payments WHERE lobby_id = v_lobby.id;
    DELETE FROM public.matchmaking_lobbies WHERE id = v_lobby.id;
  END LOOP;
END;
$$;

-- 3. Leave lobby with creator transfer and auto-delete if empty
CREATE OR REPLACE FUNCTION public.leave_lobby(p_lobby_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id uuid;
  v_is_creator boolean;
  v_member_count INTEGER;
  v_next_creator_id uuid;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if current user is the creator
  SELECT (creator_id = v_current_user_id) INTO v_is_creator
  FROM public.matchmaking_lobbies WHERE id = p_lobby_id;

  -- Mark user as left
  UPDATE public.matchmaking_lobby_members
  SET status = 'left',
      left_at = NOW(),
      updated_at = NOW()
  WHERE lobby_id = p_lobby_id
    AND student_id = v_current_user_id
    AND status = 'active';

  -- Count remaining active members
  SELECT COUNT(*) INTO v_member_count
  FROM public.matchmaking_lobby_members
  WHERE lobby_id = p_lobby_id AND status = 'active';

  IF v_member_count = 0 THEN
    -- No members left → delete lobby entirely
    DELETE FROM public.matchmaking_lobby_members WHERE lobby_id = p_lobby_id;
    DELETE FROM public.matchmaking_lobby_payments WHERE lobby_id = p_lobby_id;
    DELETE FROM public.matchmaking_lobbies WHERE id = p_lobby_id;
  ELSIF v_is_creator THEN
    -- Creator left → transfer to next oldest active member
    SELECT student_id INTO v_next_creator_id
    FROM public.matchmaking_lobby_members
    WHERE lobby_id = p_lobby_id AND status = 'active'
    ORDER BY joined_at ASC
    LIMIT 1;

    UPDATE public.matchmaking_lobbies
    SET creator_id = v_next_creator_id,
        updated_at = NOW()
    WHERE id = p_lobby_id;
  END IF;
END;
$$;

-- 4. Pay lobby share — simplified for fixed price
CREATE OR REPLACE FUNCTION public.pay_lobby_share_fixed(p_lobby_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id uuid;
  v_price_total INTEGER;
  v_all_paid boolean;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the fixed price from the lobby
  SELECT price_total INTO v_price_total
  FROM public.matchmaking_lobbies WHERE id = p_lobby_id;

  -- Upsert payment record as paid
  INSERT INTO public.matchmaking_lobby_payments (lobby_id, student_id, amount, status, paid_at, updated_at)
  VALUES (p_lobby_id, v_current_user_id, v_price_total, 'paid', NOW(), NOW())
  ON CONFLICT (lobby_id, student_id)
  DO UPDATE SET status = 'paid', paid_at = NOW(), amount = v_price_total, updated_at = NOW();

  -- Check if all active members have paid
  SELECT NOT EXISTS (
    SELECT 1 FROM public.matchmaking_lobby_members m
    WHERE m.lobby_id = p_lobby_id
      AND m.status = 'active'
      AND m.student_id NOT IN (
        SELECT p.student_id FROM public.matchmaking_lobby_payments p
        WHERE p.lobby_id = p_lobby_id AND p.status = 'paid'
      )
  ) INTO v_all_paid;

  IF v_all_paid THEN
    UPDATE public.matchmaking_lobbies
    SET status = 'paid',
        updated_at = NOW()
    WHERE id = p_lobby_id;
  END IF;
END;
$$;

-- ===========================================================
-- Grant execute permissions
-- ===========================================================
GRANT EXECUTE ON FUNCTION public.force_lobby_to_pending_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_and_cleanup_lobbies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_lobby(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_lobby_share_fixed(uuid) TO authenticated;
