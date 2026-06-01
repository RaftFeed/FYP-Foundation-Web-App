-- ===========================================================
-- Cleanup: Expired Lobbies, Orphaned Held Slots, Old Reports
-- ===========================================================
-- SAFE TO RUN: Uses CREATE OR REPLACE (idempotent).
-- All functions use SECURITY DEFINER to bypass RLS.
-- Read-only operations use STABLE.
-- No data is permanently deleted except old reports (>1 yr).

-- ===========================================================
-- 1. Cleanup expired lobbies, empty lobbies, and orphaned slots
--    Run periodically (via pg_cron) or call from frontend on page load
-- ===========================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_lobbies_and_slots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lobby RECORD;
  v_member_count INTEGER;
BEGIN
  -- =====================================================
  -- Step 1: Process expired pending_payment lobbies
  -- =====================================================
  FOR v_lobby IN
    SELECT l.id, l.availability_slot_id
    FROM public.matchmaking_lobbies l
    WHERE l.status = 'pending_payment'
      AND l.expires_at < NOW()
  LOOP
    -- Mark unpaid active members as 'left'
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

    -- Count remaining paid+active members
    SELECT COUNT(DISTINCT m.student_id) INTO v_member_count
    FROM public.matchmaking_lobby_members m
    JOIN public.matchmaking_lobby_payments p
      ON p.lobby_id = m.lobby_id AND p.student_id = m.student_id AND p.status = 'paid'
    WHERE m.lobby_id = v_lobby.id AND m.status = 'active';

    IF v_member_count = 0 THEN
      -- No paid members → release slot, delete members, mark lobby expired
      -- Payments preserved for financial audit trail
      UPDATE public.tutor_availability_slots
      SET status = 'available', updated_at = NOW()
      WHERE id = v_lobby.availability_slot_id AND status = 'held';

      DELETE FROM public.matchmaking_lobby_members WHERE lobby_id = v_lobby.id;

      -- Mark expired instead of hard-delete to preserve FK to payments
      UPDATE public.matchmaking_lobbies
      SET status = 'expired', updated_at = NOW()
      WHERE id = v_lobby.id;
    ELSE
      -- Has paid members → mark lobby as paid (class is active)
      UPDATE public.matchmaking_lobbies
      SET status = 'paid', updated_at = NOW()
      WHERE id = v_lobby.id;
    END IF;
  END LOOP;

  -- =====================================================
  -- Step 2: Handle lobbies with 0 active members
  --         (e.g., all members left voluntarily)
  -- =====================================================
  FOR v_lobby IN
    SELECT l.id, l.availability_slot_id
    FROM public.matchmaking_lobbies l
    LEFT JOIN public.matchmaking_lobby_members m
      ON m.lobby_id = l.id AND m.status = 'active'
    WHERE m.id IS NULL
      AND l.status IN ('open', 'pending_payment', 'paid')
  LOOP
    -- Release the held slot back to available
    UPDATE public.tutor_availability_slots
    SET status = 'available', updated_at = NOW()
    WHERE id = v_lobby.availability_slot_id AND status = 'held';

    -- Delete members only — preserve payments for audit trail
    DELETE FROM public.matchmaking_lobby_members WHERE lobby_id = v_lobby.id;

    -- Mark as expired instead of hard-delete to preserve FK to payments
    UPDATE public.matchmaking_lobbies
    SET status = 'expired', updated_at = NOW()
    WHERE id = v_lobby.id;
  END LOOP;

  -- =====================================================
  -- Step 3: Release orphaned held slots
  --         (slot is 'held' but no active lobby references it)
  -- =====================================================
  UPDATE public.tutor_availability_slots s
  SET status = 'available', updated_at = NOW()
  WHERE s.status = 'held'
    AND NOT EXISTS (
      SELECT 1 FROM public.matchmaking_lobbies l
      WHERE l.availability_slot_id = s.id
        AND l.status IN ('open', 'pending_payment', 'paid', 'completed')
    );
END;
$$;

-- ===========================================================
-- 2. Improved leave_lobby with payment refund + slot release
--    Replaces the existing leave_lobby function from payment-overhaul.sql
-- ===========================================================
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
  v_slot_id uuid;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get lobby info: check if user is creator + get slot
  SELECT creator_id, availability_slot_id
  INTO v_is_creator, v_slot_id
  FROM public.matchmaking_lobbies WHERE id = p_lobby_id;

  v_is_creator := (v_is_creator = v_current_user_id);

  -- Refund payment if student had paid (for admin refund reporting)
  UPDATE public.matchmaking_lobby_payments
  SET status = 'refunded',
      updated_at = NOW()
  WHERE lobby_id = p_lobby_id
    AND student_id = v_current_user_id
    AND status = 'paid';

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
    -- ========================================
    -- No members left → release slot, clean up members, mark expired
    -- Payments are NOT deleted — preserved for refund/financial reporting
    -- ========================================
    IF v_slot_id IS NOT NULL THEN
      UPDATE public.tutor_availability_slots
      SET status = 'available', updated_at = NOW()
      WHERE id = v_slot_id AND status = 'held';
    END IF;

    -- Delete members only (FK constraint: no ON DELETE CASCADE)
    DELETE FROM public.matchmaking_lobby_members WHERE lobby_id = p_lobby_id;

    -- Mark as expired instead of hard-delete (preserves referential integrity)
    UPDATE public.matchmaking_lobbies
    SET status = 'expired', updated_at = NOW()
    WHERE id = p_lobby_id;

  ELSIF v_is_creator THEN
    -- ========================================
    -- Creator left → transfer to oldest active member
    -- ========================================
    SELECT student_id INTO v_next_creator_id
    FROM public.matchmaking_lobby_members
    WHERE lobby_id = p_lobby_id AND status = 'active'
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_next_creator_id IS NOT NULL THEN
      UPDATE public.matchmaking_lobbies
      SET creator_id = v_next_creator_id,
          updated_at = NOW()
      WHERE id = p_lobby_id;
    END IF;
  END IF;
END;
$$;

-- ===========================================================
-- 3. Cleanup old reports (older than 1 year)
--    Only deletes from 'reports' table — no FK dependencies.
-- ===========================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.reports
  WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$;

-- ===========================================================
-- 4. Calculate tutor net income from actual paid payments
--    Returns: gross, platform_fee (20%), net_income (80%), student count
-- ===========================================================
CREATE OR REPLACE FUNCTION public.calculate_tutor_net_income(p_tutor_user_id uuid)
RETURNS TABLE (
  total_gross numeric,
  platform_fee numeric,
  net_income numeric,
  total_students bigint
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(p.amount), 0) AS total_gross,
    ROUND(COALESCE(SUM(p.amount), 0) * 0.2) AS platform_fee,
    ROUND(COALESCE(SUM(p.amount), 0) * 0.8) AS net_income,
    COUNT(DISTINCT p.student_id) AS total_students
  FROM public.matchmaking_lobby_payments p
  JOIN public.matchmaking_lobbies l ON l.id = p.lobby_id
  WHERE l.tutor_user_id = p_tutor_user_id
    AND p.status = 'paid';
END;
$$;

-- ===========================================================
-- 5. Get all payments with tutor info for admin reports
--    Includes both 'paid' and 'refunded' for full reporting
-- ===========================================================
CREATE OR REPLACE FUNCTION public.get_payment_report()
RETURNS TABLE (
  payment_id uuid,
  lobby_id uuid,
  lobby_title text,
  tutor_name text,
  tutor_user_id uuid,
  student_id uuid,
  amount integer,
  status text,
  paid_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS payment_id,
    p.lobby_id,
    l.title AS lobby_title,
    COALESCE(tp.full_name, 'Unknown') AS tutor_name,
    l.tutor_user_id,
    p.student_id,
    p.amount,
    p.status,
    p.paid_at,
    p.created_at
  FROM public.matchmaking_lobby_payments p
  JOIN public.matchmaking_lobbies l ON l.id = p.lobby_id
  LEFT JOIN public.tutor_profiles tp ON tp.id = l.tutor_profile_id
  WHERE p.status IN ('paid', 'refunded')
  ORDER BY p.paid_at DESC NULLS LAST;
END;
$$;

-- ===========================================================
-- Grant execute permissions to authenticated users
-- ===========================================================
GRANT EXECUTE ON FUNCTION public.cleanup_expired_lobbies_and_slots() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_lobby(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_tutor_net_income(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_report() TO authenticated;
