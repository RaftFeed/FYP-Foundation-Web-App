-- ============================================================================
-- FYP Foundation: Cleanup Expired Lobbies Migration
-- 
-- This migration:
-- 1. Marks all lobbies whose linked tutor slot has already ended as 'expired'
--    (only if they are still in an active state: open, pending_payment)
-- 2. Provides an optional DELETE statement (commented out) for fully removing
--    old expired/cancelled lobby data
-- 
-- Run this manually or schedule it as a cron job via Supabase pg_cron.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Expire lobbies whose class time has already passed
-- This updates lobbies that are still "open" or "pending_payment" but the
-- associated tutor availability slot's starts_at is in the past.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.matchmaking_lobbies l
SET
  status   = 'expired',
  updated_at = now()
FROM public.tutor_availability_slots s
WHERE l.availability_slot_id = s.id
  AND l.status IN ('open', 'pending_payment')
  AND s.starts_at < now();

-- Also expire lobbies whose expires_at has passed (even if no slot link)
UPDATE public.matchmaking_lobbies
SET
  status   = 'expired',
  updated_at = now()
WHERE status IN ('open', 'pending_payment')
  AND expires_at < now();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Mark lobby members as 'left' for expired lobbies
-- This ensures member roster is consistent with lobby status
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.matchmaking_lobby_members m
SET
  status   = 'left',
  left_at  = now(),
  updated_at = now()
FROM public.matchmaking_lobbies l
WHERE m.lobby_id = l.id
  AND l.status = 'expired'
  AND m.status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 (OPTIONAL — DESTRUCTIVE): Delete old expired/cancelled lobbies
-- Uncomment the lines below ONLY if you want to permanently remove old data.
-- WARNING: This will delete lobby records, members, and payments permanently.
-- ─────────────────────────────────────────────────────────────────────────────

-- Delete payments for old expired/cancelled lobbies
-- DELETE FROM public.matchmaking_lobby_payments
-- WHERE lobby_id IN (
--   SELECT l.id
--   FROM public.matchmaking_lobbies l
--   JOIN public.tutor_availability_slots s ON l.availability_slot_id = s.id
--   WHERE l.status IN ('expired', 'cancelled')
--     AND s.starts_at < now() - INTERVAL '30 days'
-- );

-- Delete members for old expired/cancelled lobbies
-- DELETE FROM public.matchmaking_lobby_members
-- WHERE lobby_id IN (
--   SELECT l.id
--   FROM public.matchmaking_lobbies l
--   JOIN public.tutor_availability_slots s ON l.availability_slot_id = s.id
--   WHERE l.status IN ('expired', 'cancelled')
--     AND s.starts_at < now() - INTERVAL '30 days'
-- );

-- Delete the lobbies themselves (older than 30 days)
-- DELETE FROM public.matchmaking_lobbies l
-- USING public.tutor_availability_slots s
-- WHERE l.availability_slot_id = s.id
--   AND l.status IN ('expired', 'cancelled')
--   AND s.starts_at < now() - INTERVAL '30 days';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 (OPTIONAL): Create a scheduled function for recurring cleanup
-- This can be called by pg_cron to automatically expire lobbies hourly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_expired_lobbies()
RETURNS void AS $$
BEGIN
  -- Expire lobbies whose slot time has passed
  UPDATE public.matchmaking_lobbies l
  SET status = 'expired', updated_at = now()
  FROM public.tutor_availability_slots s
  WHERE l.availability_slot_id = s.id
    AND l.status IN ('open', 'pending_payment')
    AND s.starts_at < now();

  -- Expire lobbies whose expires_at has passed
  UPDATE public.matchmaking_lobbies
  SET status = 'expired', updated_at = now()
  WHERE status IN ('open', 'pending_payment')
    AND expires_at < now();

  -- Mark members of expired lobbies as left
  UPDATE public.matchmaking_lobby_members m
  SET status = 'left', left_at = now(), updated_at = now()
  FROM public.matchmaking_lobbies l
  WHERE m.lobby_id = l.id
    AND l.status = 'expired'
    AND m.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- To schedule hourly cleanup with pg_cron (run this in Supabase SQL Editor):
-- SELECT cron.schedule('cleanup-expired-lobbies', '0 * * * *', 'SELECT public.cleanup_expired_lobbies()');
