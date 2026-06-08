-- ============================================================================
-- FYP Foundation: Matchmaking Lobbies RLS Policies Migration
-- 
-- This migration enables Row Level Security (RLS) and defines policies for:
-- 1. profiles: Allows authenticated users to select/read other profiles.
-- 2. matchmaking_lobbies: Allows authenticated users to view public/joined lobbies.
-- 3. matchmaking_lobby_members: Allows view memberships and join/leave operations.
-- 4. matchmaking_lobby_payments: Allows view and pay-on-join transactions.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Profiles Policies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
CREATE POLICY "Allow authenticated users to read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Matchmaking Lobbies Policies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.matchmaking_lobbies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view public lobbies or lobbies they belong to" ON public.matchmaking_lobbies;
CREATE POLICY "Allow authenticated users to view public lobbies or lobbies they belong to"
ON public.matchmaking_lobbies
FOR SELECT
TO authenticated
USING (
  visibility = 'public' 
  OR creator_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.matchmaking_lobby_members 
    WHERE matchmaking_lobby_members.lobby_id = matchmaking_lobbies.id 
      AND matchmaking_lobby_members.student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Allow authenticated users to create lobbies" ON public.matchmaking_lobbies;
CREATE POLICY "Allow authenticated users to create lobbies"
ON public.matchmaking_lobbies
FOR INSERT
TO authenticated
WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Allow creators to update their own lobbies" ON public.matchmaking_lobbies;
CREATE POLICY "Allow creators to update their own lobbies"
ON public.matchmaking_lobbies
FOR UPDATE
TO authenticated
USING (creator_id = auth.uid())
WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Allow creators to delete their own lobbies" ON public.matchmaking_lobbies;
CREATE POLICY "Allow creators to delete their own lobbies"
ON public.matchmaking_lobbies
FOR DELETE
TO authenticated
USING (creator_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Matchmaking Lobby Members Policies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.matchmaking_lobby_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view active lobby memberships" ON public.matchmaking_lobby_members;
CREATE POLICY "Allow authenticated users to view active lobby memberships"
ON public.matchmaking_lobby_members
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow students to join lobbies" ON public.matchmaking_lobby_members;
CREATE POLICY "Allow students to join lobbies"
ON public.matchmaking_lobby_members
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Allow students to update their own membership" ON public.matchmaking_lobby_members;
CREATE POLICY "Allow students to update their own membership"
ON public.matchmaking_lobby_members
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Allow students to leave lobbies" ON public.matchmaking_lobby_members;
CREATE POLICY "Allow students to leave lobbies"
ON public.matchmaking_lobby_members
FOR DELETE
TO authenticated
USING (student_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Matchmaking Lobby Payments Policies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.matchmaking_lobby_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow students to view their own payments" ON public.matchmaking_lobby_payments;
CREATE POLICY "Allow students to view their own payments"
ON public.matchmaking_lobby_payments
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Allow students to insert their own payments" ON public.matchmaking_lobby_payments;
CREATE POLICY "Allow students to insert their own payments"
ON public.matchmaking_lobby_payments
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Allow students to update their own payments" ON public.matchmaking_lobby_payments;
CREATE POLICY "Allow students to update their own payments"
ON public.matchmaking_lobby_payments
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());
