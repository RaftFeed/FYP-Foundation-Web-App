-- Migration: Create decoy payment processing RPCs
-- This migration implements `pay_lobby_share` to act as a dummy payment verification mechanism
-- and a test helper `force_lobby_to_pending_payment` to manually trigger the payment state for testing.

-- 1. Create pay_lobby_share function
CREATE OR REPLACE FUNCTION public.pay_lobby_share(
  p_lobby_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_price_total integer;
  v_member_count integer;
  v_amount integer;
  v_lobby_status text;
  v_availability_slot_id uuid;
  v_all_paid boolean;
BEGIN
  -- Verify user is authenticated
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Anda harus login untuk melakukan pembayaran';
  END IF;

  -- Fetch lobby details
  SELECT price_total, status, availability_slot_id
  INTO v_price_total, v_lobby_status, v_availability_slot_id
  FROM public.matchmaking_lobbies
  WHERE id = p_lobby_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby tidak ditemukan';
  END IF;

  -- Verify lobby is in pending_payment state (or open for debugging support)
  IF v_lobby_status NOT IN ('open', 'pending_payment') THEN
    RAISE EXCEPTION 'Pembayaran tidak dapat dilakukan pada status lobby saat ini (%)', v_lobby_status;
  END IF;

  -- Verify student is an active member
  IF NOT EXISTS (
    SELECT 1 FROM public.matchmaking_lobby_members
    WHERE lobby_id = p_lobby_id AND student_id = v_student_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Anda bukan anggota aktif dari lobby ini';
  END IF;

  -- Calculate member count
  SELECT COUNT(*)
  INTO v_member_count
  FROM public.matchmaking_lobby_members
  WHERE lobby_id = p_lobby_id AND status = 'active';

  IF v_member_count > 0 THEN
    v_amount := ceil(v_price_total::numeric / v_member_count);
  ELSE
    v_amount := v_price_total;
  END IF;

  -- Upsert payment record by first deleting any existing payment row
  DELETE FROM public.matchmaking_lobby_payments
  WHERE lobby_id = p_lobby_id AND student_id = v_student_id;

  INSERT INTO public.matchmaking_lobby_payments (
    lobby_id,
    student_id,
    amount,
    status,
    payment_method,
    created_at,
    updated_at
  )
  VALUES (
    p_lobby_id,
    v_student_id,
    v_amount,
    'paid',
    'Decoy Dummy Button',
    now(),
    now()
  );

  -- Check if all active members have paid
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.matchmaking_lobby_members m
    LEFT JOIN public.matchmaking_lobby_payments p
      ON m.lobby_id = p.lobby_id 
      AND m.student_id = p.student_id 
      AND p.status = 'paid'
    WHERE m.lobby_id = p_lobby_id
      AND m.status = 'active'
      AND p.id IS NULL
  ) INTO v_all_paid;

  -- If all members have paid, update the status of lobby and tutor availability slot
  IF v_all_paid THEN
    UPDATE public.matchmaking_lobbies
    SET status = 'paid',
        updated_at = now()
    WHERE id = p_lobby_id;

    UPDATE public.tutor_availability_slots
    SET status = 'booked',
        updated_at = now()
    WHERE id = v_availability_slot_id;
  END IF;
END;
$$;

-- 2. Create testing helper function to force a lobby into pending_payment status
CREATE OR REPLACE FUNCTION public.force_lobby_to_pending_payment(
  p_lobby_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lobby_status text;
BEGIN
  SELECT status
  INTO v_lobby_status
  FROM public.matchmaking_lobbies
  WHERE id = p_lobby_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lobby tidak ditemukan';
  END IF;

  IF v_lobby_status != 'open' THEN
    RAISE EXCEPTION 'Lobby hanya bisa dikunci pembayaran jika dalam status open';
  END IF;

  -- Update lobby status
  UPDATE public.matchmaking_lobbies
  SET status = 'pending_payment',
      expires_at = now() + interval '6 hours',
      updated_at = now()
  WHERE id = p_lobby_id;
END;
$$;
