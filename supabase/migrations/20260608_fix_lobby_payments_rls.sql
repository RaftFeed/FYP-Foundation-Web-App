-- ============================================================================
-- FYP Foundation: Fix Lobby Payments RLS SELECT Policy
-- ============================================================================

DROP POLICY IF EXISTS "Allow students to view their own payments" ON public.matchmaking_lobby_payments;
DROP POLICY IF EXISTS "Allow students to view payments for their lobbies" ON public.matchmaking_lobby_payments;

CREATE POLICY "Allow students to view payments for their lobbies"
ON public.matchmaking_lobby_payments
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.matchmaking_lobby_members m
    WHERE m.lobby_id = matchmaking_lobby_payments.lobby_id
      AND m.student_id = auth.uid()
      AND m.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.tutor_profiles tp
    JOIN public.matchmaking_lobbies l ON tp.id = l.tutor_profile_id
    WHERE l.id = matchmaking_lobby_payments.lobby_id
      AND tp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);
