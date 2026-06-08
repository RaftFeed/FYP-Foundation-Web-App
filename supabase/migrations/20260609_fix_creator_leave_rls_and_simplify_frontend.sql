-- ============================================================================
-- Fix: Allow creator to leave lobby without RLS violation
--
-- Problem: When a creator leaves a lobby with other members remaining, the
-- frontend tries to update matchmaking_lobbies.creator_id to the new owner.
-- The RLS policy "Allow creators to update their own lobbies" has
--   WITH CHECK (creator_id = auth.uid())
-- which rejects the update because the new creator_id is a different user.
--
-- Fix: Change the WITH CHECK to allow the current creator to update the row
-- regardless of what creator_id becomes (transferring ownership). The USING
-- clause still ensures only the current creator can initiate the update.
-- ============================================================================

DROP POLICY IF EXISTS "Allow creators to update their own lobbies" ON public.matchmaking_lobbies;
CREATE POLICY "Allow creators to update their own lobbies"
ON public.matchmaking_lobbies
FOR UPDATE
TO authenticated
USING (creator_id = auth.uid())
WITH CHECK (true);
