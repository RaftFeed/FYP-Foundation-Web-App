import { supabase } from './supabase';

export type TutorAvailabilityStatus = 'available' | 'held' | 'booked' | 'cancelled';
export type MatchmakingLobbyVisibility = 'public' | 'private';
export type MatchmakingLobbyStatus = 'open' | 'pending_payment' | 'paid' | 'expired' | 'cancelled' | 'completed';

export interface TutorAvailabilitySlot {
  id: string;
  tutor_profile_id: string;
  tutor_user_id: string | null;
  tutor_name: string;
  tutor_rating: number;
  tutor_reviews_count: number;
  tutor_image_url: string | null;
  tutor_status: string;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  starts_at: string;
  ends_at: string;
  location: string;
  meeting_url: string | null;
  price_total: number;
  max_participants: number;
  status: TutorAvailabilityStatus;
  notes: string | null;
  recurrence_group_id: string | null;
  recurrence_pattern: 'none' | 'weekly';
  recurrence_index: number;
  active_lobby_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlotStudent {
  student_id: string;
  student_email: string;
  student_name: string;
  student_image_url: string | null;
  status: string;
  joined_at: string;
  payment_status?: 'pending' | 'paid' | 'failed' | null;
}

async function resolveProfileDisplayNames(profileIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(profileIds.filter(Boolean)));
  const displayNames = new Map<string, string>();

  if (uniqueIds.length === 0) {
    return displayNames;
  }

  const profilesResult = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', uniqueIds);

  if (profilesResult.error) throw new Error(profilesResult.error.message);

  for (const profile of profilesResult.data ?? []) {
    const resolvedName = profile.full_name?.trim() || profile.email?.trim() || '';
    if (resolvedName) {
      displayNames.set(profile.id, resolvedName);
    }
  }

  return displayNames;
}

export async function fetchProfileDisplayName(profileId: string | null | undefined): Promise<string | null> {
  if (!profileId) {
    return null;
  }

  const names = await resolveProfileDisplayNames([profileId]);
  return names.get(profileId) ?? null;
}

async function fetchLobbyMembers(lobbyIds: string[], tutorUserIds: string[] = []): Promise<SlotStudent[]> {
  if (lobbyIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('matchmaking_lobby_members')
    .select('lobby_id, student_id, status, joined_at, student:profiles!student_id(email, full_name, image_url)')
    .in('lobby_id', lobbyIds)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);

  const excludedStudentIds = new Set(tutorUserIds.filter(Boolean));
  const studentIds = (data ?? [])
    .filter((m) => !excludedStudentIds.has(m.student_id))
    .map((m) => m.student_id);
  const displayNames = await resolveProfileDisplayNames(studentIds);

  // Fetch payments for these lobbies and students
  let payments: Array<{ lobby_id: string; student_id: string; status: string }> = [];
  if (studentIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from('matchmaking_lobby_payments')
      .select('lobby_id, student_id, status')
      .in('lobby_id', lobbyIds)
      .in('student_id', studentIds);
    if (paymentsData) {
      payments = paymentsData;
    }
  }

  const paymentStatuses = new Map<string, string>();
  for (const p of payments) {
    paymentStatuses.set(`${p.lobby_id}:${p.student_id}`, p.status);
  }

  return (data ?? [])
    .filter((m) => !excludedStudentIds.has(m.student_id))
    .map((m) => ({
      student_id: m.student_id,
      student_email: (m.student as any)?.email ?? '',
      student_name: displayNames.get(m.student_id) ?? (m.student as any)?.full_name ?? (m.student as any)?.email ?? 'Tidak diketahui',
      student_image_url: (m.student as any)?.image_url ?? null,
      status: m.status,
      joined_at: m.joined_at,
      payment_status: (paymentStatuses.get(`${m.lobby_id}:${m.student_id}`) as any) ?? null,
    }));
}

export async function fetchSlotStudents(slotId: string): Promise<SlotStudent[]> {
  // Query directly instead of relying on get_slot_students RPC.
  // Resolves the tutor's user_id via tutor_profiles to exclude them from results.
  const { data: lobbies, error: lobbyError } = await supabase
    .from('matchmaking_lobbies')
    .select('id, tutor:tutor_profiles!tutor_profile_id(user_id)')
    .eq('availability_slot_id', slotId);

  if (lobbyError) throw new Error(lobbyError.message);
  if (!lobbies || lobbies.length === 0) return [];

  const lobbyIds = lobbies.map((l) => l.id);
  const tutorUserIds = lobbies
    .map((l) => (l.tutor as any)?.user_id)
    .filter(Boolean) as string[];

  return fetchLobbyMembers(lobbyIds, tutorUserIds);
}

export async function fetchLobbyStudents(lobbyId: string, tutorUserId?: string | null): Promise<SlotStudent[]> {
  return fetchLobbyMembers([lobbyId], tutorUserId ? [tutorUserId] : []);
}

export async function fetchLobbyMemberCount(lobbyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('matchmaking_lobby_members')
    .select('id', { count: 'exact', head: true })
    .eq('lobby_id', lobbyId)
    .eq('status', 'active');

  if (error) throw new Error(error.message);
  return count ?? 0;
}

type TutorAvailabilityRow = {
  id: string;
  tutor_profile_id: string;
  subject_id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  price_total: number;
  max_participants: number;
  status: TutorAvailabilityStatus;
  notes: string | null;
  recurrence_group_id: string | null;
  recurrence_pattern: 'none' | 'weekly';
  recurrence_index: number;
  created_at: string;
  updated_at: string;
  subject: { name: string; code: string | null } | null;
  tutor: { user_id: string | null; full_name: string; rating: number; reviews_count: number; image_url: string | null; status: string } | null;
};

export interface MatchmakingLobby {
  id: string;
  code: string;
  creator_id: string;
  creator_name: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  tutor_profile_id: string;
  tutor_user_id: string | null;
  tutor_name: string;
  tutor_rating: number;
  tutor_reviews_count: number;
  tutor_image_url: string | null;
  availability_slot_id: string;
  starts_at: string;
  ends_at: string;
  location: string;
  course_session_id: string | null;
  title: string;
  description: string | null;
  visibility: MatchmakingLobbyVisibility;
  status: MatchmakingLobbyStatus;
  min_participants: number;
  max_participants: number;
  price_total: number;
  price_per_member: number;
  price_if_full: number;
  member_count: number | null;
  expires_at: string;
  current_user_is_member: boolean;
  current_user_is_creator: boolean;
  current_user_has_paid?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TutorSelfProfile {
  id: string;
  user_id: string | null;
  subject_id: string | null;
  full_name: string;
  bio: string | null;
  hourly_rate: number;
  image_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function isMissingMatchmakingPaymentDependency(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === '42P01'
    || error.message?.includes('relation "public.matchmaking_lobby_payments" does not exist') === true
    || error.message?.includes('relation "matchmaking_lobby_payments" does not exist') === true
  );
}

export async function refreshExpiredLobbies() {
  await expireUnpaidAndCleanup();
}

export async function fetchAvailableTutorSlots() {
  await refreshExpiredLobbies();

  // Fetch available slots + held slots (held = has a lobby that may have been deleted)
  const { data, error } = await supabase
    .from('tutor_availability_slots')
    .select(`
      id,
      tutor_profile_id,
      subject_id,
      starts_at,
      ends_at,
      location,
      meeting_url,
      price_total,
      max_participants,
      status,
      notes,
      recurrence_group_id,
      recurrence_pattern,
      recurrence_index,
      created_at,
      updated_at,
      subject:subjects (
        name,
        code
      ),
      tutor:tutor_profiles!inner (
        user_id,
        full_name,
        rating,
        reviews_count,
        image_url,
        status
      )
    `)
    .in('status', ['available', 'held'])
    .eq('tutor.status', 'approved')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  throwIfError(error);

  const allSlots = mapTutorAvailabilityRows(data ?? []);

  // For held slots, check if there's still an active lobby. If not, the slot is free to use.
  const heldSlots = allSlots.filter((s) => s.status === 'held');
  if (heldSlots.length > 0) {
    const heldSlotIds = heldSlots.map((s) => s.id);
    const { data: activeLobbies } = await supabase
      .from('matchmaking_lobbies')
      .select('availability_slot_id')
      .in('availability_slot_id', heldSlotIds)
      .in('status', ['open', 'pending_payment', 'paid']);

    const busySlotIds = new Set((activeLobbies ?? []).map((l: any) => l.availability_slot_id));
    // Mark held slots without active lobbies as available
    for (const slot of heldSlots) {
      if (!busySlotIds.has(slot.id)) {
        slot.status = 'available';
      }
    }
  }

  // Return only slots that are effectively available (original available + freed held slots)
  return allSlots.filter((s) => s.status === 'available');
}

export async function fetchMyTutorAvailability(tutorUserId: string, startIso: string, endIso: string) {
  const { data, error } = await supabase
    .from('tutor_availability_slots')
    .select(`
      id,
      tutor_profile_id,
      subject_id,
      starts_at,
      ends_at,
      location,
      meeting_url,
      price_total,
      max_participants,
      status,
      notes,
      recurrence_group_id,
      recurrence_pattern,
      recurrence_index,
      created_at,
      updated_at,
      subject:subjects (
        name,
        code
      ),
      tutor:tutor_profiles!inner (
        user_id,
        full_name,
        rating,
        reviews_count,
        image_url,
        status
      )
    `)
    .eq('tutor.user_id', tutorUserId)
    .gte('starts_at', startIso)
    .lt('starts_at', endIso)
    .order('starts_at', { ascending: true });

  throwIfError(error);

  const allSlots = mapTutorAvailabilityRows(data ?? []);

  // For held slots, check if there's still an active lobby. If not, reset to available.
  const heldSlots = allSlots.filter((s) => s.status === 'held');
  if (heldSlots.length > 0) {
    const heldSlotIds = heldSlots.map((s) => s.id);
    const { data: activeLobbies } = await supabase
      .from('matchmaking_lobbies')
      .select('availability_slot_id')
      .in('availability_slot_id', heldSlotIds)
      .in('status', ['open', 'pending_payment', 'paid']);

    const busySlotIds = new Set((activeLobbies ?? []).map((l: any) => l.availability_slot_id));
    const freedSlotIds: string[] = [];
    for (const slot of heldSlots) {
      if (!busySlotIds.has(slot.id)) {
        slot.status = 'available';
        freedSlotIds.push(slot.id);
      }
    }
    // Persist the reset so create_matchmaking_lobby RPC won't reject the slot.
    // Tutor has RLS access to update their own slots — this is the authoritative fix.
    if (freedSlotIds.length > 0) {
      await supabase
        .from('tutor_availability_slots')
        .update({ status: 'available', updated_at: new Date().toISOString() })
        .in('id', freedSlotIds);
    }
  }

  return allSlots;
}

export function isSlotExpired(slot: TutorAvailabilitySlot): boolean {
  return new Date(slot.ends_at).getTime() < Date.now();
}

export async function fetchAdminTutorAvailability() {
  const { data, error } = await supabase
    .from('tutor_availability_slots')
    .select(`
      id,
      tutor_profile_id,
      subject_id,
      starts_at,
      ends_at,
      location,
      meeting_url,
      price_total,
      max_participants,
      status,
      notes,
      recurrence_group_id,
      recurrence_pattern,
      recurrence_index,
      created_at,
      updated_at,
      subject:subjects (
        name,
        code
      ),
      tutor:tutor_profiles (
        user_id,
        full_name,
        rating,
        reviews_count,
        image_url,
        status
      )
    `)
    .order('starts_at', { ascending: true });

  throwIfError(error);
  return mapTutorAvailabilityRows(data ?? []);
}

export async function fetchStudentTutorScheduleSlots() {
  await refreshExpiredLobbies();

  const { data, error } = await supabase
    .from('tutor_availability_slots')
    .select(`
      id,
      tutor_profile_id,
      subject_id,
      starts_at,
      ends_at,
      location,
      meeting_url,
      price_total,
      max_participants,
      status,
      notes,
      recurrence_group_id,
      recurrence_pattern,
      recurrence_index,
      created_at,
      updated_at,
      subject:subjects (
        name,
        code
      ),
      tutor:tutor_profiles!inner (
        user_id,
        full_name,
        rating,
        reviews_count,
        image_url,
        status
      )
    `)
    .in('status', ['available', 'held', 'booked'])
    .eq('tutor.status', 'approved')
    .order('starts_at', { ascending: true });

  throwIfError(error);

  const allSlots = mapTutorAvailabilityRows(data ?? []);

  // For held slots, check if there's still an active lobby. If not, the slot is free.
  const heldSlots = allSlots.filter((s) => s.status === 'held');
  if (heldSlots.length > 0) {
    const heldSlotIds = heldSlots.map((s) => s.id);
    const { data: activeLobbies } = await supabase
      .from('matchmaking_lobbies')
      .select('availability_slot_id')
      .in('availability_slot_id', heldSlotIds)
      .in('status', ['open', 'pending_payment', 'paid']);

    const busySlotIds = new Set((activeLobbies ?? []).map((l: any) => l.availability_slot_id));
    for (const slot of heldSlots) {
      if (!busySlotIds.has(slot.id)) {
        slot.status = 'available';
      }
    }
  }

  return allSlots;
}

export async function fetchLobbyForSlot(slotId: string): Promise<MatchmakingLobby | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  throwIfError(authError);
  const currentUserId = authData.user?.id ?? null;

  const { data: lobbies, error: lobbiesError } = await supabase
    .from('matchmaking_lobbies')
    .select(`
      *,
      creator:profiles!matchmaking_lobbies_creator_id_fkey (
        full_name,
        email
      ),
      subject:subjects (
        name,
        code
      ),
      tutor:tutor_profiles (
        full_name,
        rating,
        reviews_count,
        image_url
      ),
      slot:tutor_availability_slots (
        starts_at,
        ends_at,
        location
      )
    `)
    .eq('availability_slot_id', slotId)
    .in('status', ['open', 'pending_payment', 'paid'])
    .order('created_at', { ascending: false })
    .limit(1);

  throwIfError(lobbiesError);

  const lobby = (lobbies ?? [])[0] as {
    id: string;
    code: string;
    creator_id: string;
    subject_id: string;
    tutor_profile_id: string;
    tutor_user_id: string | null;
    availability_slot_id: string;
    course_session_id: string | null;
    title: string;
    description: string | null;
    visibility: MatchmakingLobbyVisibility;
    status: MatchmakingLobbyStatus;
    min_participants: number;
    max_participants: number;
    price_total: number;
    expires_at: string;
    created_at: string;
    updated_at: string;
    creator: { full_name: string | null; email: string | null } | null;
    subject: { name: string; code: string | null } | null;
    tutor: { full_name: string; rating: number; reviews_count: number; image_url: string | null } | null;
    slot: { starts_at: string; ends_at: string; location: string | null } | null;
  } | undefined;

  if (!lobby) return null;

  const { data: memberships } = await supabase
    .from('matchmaking_lobby_members')
    .select('lobby_id, student_id, status, student:profiles!student_id(role)')
    .eq('status', 'active');

  const studentMembers = (memberships ?? []).filter(
    (m) => m.lobby_id === lobby.id && (m.student as any)?.role === 'student'
  );
  const memberCount = studentMembers.length;
  const isMember = (memberships ?? []).some((m) => m.lobby_id === lobby.id && m.student_id === currentUserId);

  return {
    id: lobby.id,
    code: lobby.code,
    creator_id: lobby.creator_id,
    creator_name: lobby.creator?.full_name ?? lobby.creator?.email ?? null,
    subject_id: lobby.subject_id,
    subject_name: lobby.subject?.name ?? lobby.title,
    subject_code: lobby.subject?.code ?? null,
    tutor_profile_id: lobby.tutor_profile_id,
    tutor_user_id: lobby.tutor_user_id ?? null,
    tutor_name: lobby.tutor?.full_name ?? '-',
    tutor_rating: Number(lobby.tutor?.rating ?? 0),
    tutor_reviews_count: Number(lobby.tutor?.reviews_count ?? 0),
    tutor_image_url: lobby.tutor?.image_url ?? null,
    availability_slot_id: lobby.availability_slot_id,
    starts_at: lobby.slot?.starts_at ?? lobby.created_at,
    ends_at: lobby.slot?.ends_at ?? lobby.expires_at,
    location: lobby.slot?.location ?? 'Online',
    course_session_id: lobby.course_session_id,
    title: lobby.title,
    description: lobby.description,
    visibility: lobby.visibility,
    status: lobby.status,
    min_participants: lobby.min_participants,
    max_participants: lobby.max_participants,
    price_total: Number(lobby.price_total ?? 0),
    price_per_member: Number(lobby.price_total ?? 0),
    price_if_full: Number(lobby.price_total ?? 0),
    member_count: memberCount,
    expires_at: lobby.expires_at,
    current_user_is_member: isMember,
    current_user_is_creator: lobby.creator_id === currentUserId,
    created_at: lobby.created_at,
    updated_at: lobby.updated_at,
  } satisfies MatchmakingLobby;
}

export async function fetchMatchmakingLobbies() {
  await refreshExpiredLobbies();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  throwIfError(authError);
  const currentUserId = authData.user?.id ?? null;

  const [
    { data: lobbies, error: lobbiesError },
    { data: memberships, error: membershipsError },
    { data: userPayments, error: userPaymentsError },
  ] = await Promise.all([
    supabase
      .from('matchmaking_lobbies')
      .select(`
        *,
        creator:profiles!matchmaking_lobbies_creator_id_fkey (
          full_name,
          email
        ),
        subject:subjects (
          name,
          code
        ),
        tutor:tutor_profiles (
          full_name,
          rating,
          reviews_count,
          image_url
        ),
        slot:tutor_availability_slots (
          starts_at,
          ends_at,
          location
        )
      `)
      .in('status', ['open', 'pending_payment', 'paid', 'cancelled', 'completed', 'expired'])
      .order('created_at', { ascending: false }),
    supabase
      .from('matchmaking_lobby_members')
      .select('lobby_id, student_id, status, student:profiles!student_id(role)')
      .eq('status', 'active'),
    currentUserId
      ? supabase
          .from('matchmaking_lobby_payments')
          .select('lobby_id, status')
          .eq('student_id', currentUserId)
          .eq('status', 'paid')
      : Promise.resolve({ data: [], error: null }),
  ]);

  throwIfError(lobbiesError);
  throwIfError(membershipsError);
  if (userPaymentsError) throwIfError(userPaymentsError);

  const activeMemberships = new Set(
    (memberships ?? [])
      .filter((membership) => membership.student_id === currentUserId)
      .map((membership) => membership.lobby_id),
  );

  const paidLobbyIds = new Set(
    (userPayments ?? []).map((payment) => payment.lobby_id),
  );

  const memberCounts = new Map<string, number>();
  for (const membership of memberships ?? []) {
    // Only count members who have the 'student' role (exclude tutors/admins)
    const studentRole = (membership.student as any)?.role;
    if (studentRole && studentRole !== 'student') continue;
    memberCounts.set(membership.lobby_id, (memberCounts.get(membership.lobby_id) ?? 0) + 1);
  }

  return ((lobbies ?? []) as Array<{
    id: string;
    code: string;
    creator_id: string;
    subject_id: string;
    tutor_profile_id: string;
    tutor_user_id: string | null;
    availability_slot_id: string;
    course_session_id: string | null;
    title: string;
    description: string | null;
    visibility: MatchmakingLobbyVisibility;
    status: MatchmakingLobbyStatus;
    min_participants: number;
    max_participants: number;
    price_total: number;
    expires_at: string;
    created_at: string;
    updated_at: string;
    creator: { full_name: string | null; email: string | null } | null;
    subject: { name: string; code: string | null } | null;
    tutor: { full_name: string; rating: number; reviews_count: number; image_url: string | null } | null;
    slot: { starts_at: string; ends_at: string; location: string | null } | null;
  }>).map((lobby) => ({
    id: lobby.id,
    code: lobby.code,
    creator_id: lobby.creator_id,
    creator_name: lobby.creator?.full_name ?? lobby.creator?.email ?? null,
    subject_id: lobby.subject_id,
    subject_name: lobby.subject?.name ?? lobby.title,
    subject_code: lobby.subject?.code ?? null,
    tutor_profile_id: lobby.tutor_profile_id,
    tutor_user_id: lobby.tutor_user_id ?? null,
    tutor_name: lobby.tutor?.full_name ?? '-',
    tutor_rating: Number(lobby.tutor?.rating ?? 0),
    tutor_reviews_count: Number(lobby.tutor?.reviews_count ?? 0),
    tutor_image_url: lobby.tutor?.image_url ?? null,
    availability_slot_id: lobby.availability_slot_id,
    starts_at: lobby.slot?.starts_at ?? lobby.created_at,
    ends_at: lobby.slot?.ends_at ?? lobby.expires_at,
    location: lobby.slot?.location ?? 'Online',
    course_session_id: lobby.course_session_id,
    title: lobby.title,
    description: lobby.description,
    visibility: lobby.visibility,
    status: lobby.status,
    min_participants: lobby.min_participants,
    max_participants: lobby.max_participants,
    price_total: Number(lobby.price_total ?? 0),
    price_per_member: Number(lobby.price_total ?? 0),
    price_if_full: Number(lobby.price_total ?? 0),
    member_count: memberCounts.get(lobby.id) ?? 0,
    expires_at: lobby.expires_at,
    current_user_is_member: activeMemberships.has(lobby.id),
    current_user_is_creator: lobby.creator_id === currentUserId,
    current_user_has_paid: paidLobbyIds.has(lobby.id),
    created_at: lobby.created_at,
    updated_at: lobby.updated_at,
  } satisfies MatchmakingLobby));
}

export async function createMatchmakingLobby(input: {
  availabilitySlotId: string;
  title: string;
  description: string;
  visibility: MatchmakingLobbyVisibility;
  minParticipants: number;
  maxParticipants: number;
  expiresAt: string;
}) {
  const { error } = await supabase.rpc('create_matchmaking_lobby', {
    p_availability_slot_id: input.availabilitySlotId,
    p_title: input.title,
    p_description: input.description || null,
    p_visibility: input.visibility,
    p_min_participants: input.minParticipants,
    p_max_participants: input.maxParticipants,
    p_expires_at: input.expiresAt,
  });

  throwIfError(error);
}

export async function joinMatchmakingLobby(code: string) {
  const { error } = await supabase.rpc('join_matchmaking_lobby', {
    p_lobby_code: code.trim(),
  });

  throwIfError(error);
}

export async function cancelMatchmakingLobby(lobbyId: string) {
  const { error } = await supabase.rpc('cancel_matchmaking_lobby', {
    target_lobby_id: lobbyId,
  });

  throwIfError(error);
}

export async function leaveMatchmakingLobby(lobbyId: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  throwIfError(authError);
  const currentUserId = authData.user?.id;
  if (!currentUserId) throw new Error('Not authenticated');

  // Mark user as left
  const { error: leaveError } = await supabase
    .from('matchmaking_lobby_members')
    .update({ status: 'left', left_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('lobby_id', lobbyId)
    .eq('student_id', currentUserId)
    .eq('status', 'active');
  throwIfError(leaveError);

  // Refund payment if student had paid — ensures admin reports subtract correctly
  await supabase
    .from('matchmaking_lobby_payments')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('lobby_id', lobbyId)
    .eq('student_id', currentUserId)
    .eq('status', 'paid');

  // Get lobby info (creator + slot) before any deletes
  const { data: lobby } = await supabase
    .from('matchmaking_lobbies')
    .select('creator_id, availability_slot_id')
    .eq('id', lobbyId)
    .maybeSingle();
  const slotId = lobby?.availability_slot_id;

  // Count remaining active members (excluding the user who just left)
  const { count: remainingCount } = await supabase
    .from('matchmaking_lobby_members')
    .select('id', { count: 'exact', head: true })
    .eq('lobby_id', lobbyId)
    .eq('status', 'active');

  if (!remainingCount || remainingCount === 0) {
    // No members left → release slot, mark lobby as expired.
    // We handle everything in frontend to preserve payment records for
    // admin refund reporting (cancel_matchmaking_lobby RPC would delete them).
    if (slotId) {
      await supabase
        .from('tutor_availability_slots')
        .update({ status: 'available', updated_at: new Date().toISOString() })
        .eq('id', slotId);
    }

    // Mark lobby as expired so it disappears from admin Bookings panel
    // and student lobby lists. Members already marked 'left', payments
    // already marked 'refunded' above.
    await supabase
      .from('matchmaking_lobbies')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', lobbyId);
  }
  // Note: When the creator leaves and other members remain, the database
  // trigger trg_matchmaking_lobby_member_leave automatically transfers
  // creator_id to the oldest active member. No client-side update needed.
}

export async function kickMatchmakingLobbyMember(lobbyId: string, studentId: string) {
  const { error } = await supabase.rpc('kick_matchmaking_lobby_member', {
    p_lobby_id: lobbyId,
    p_student_id: studentId,
  });

  throwIfError(error);
}

export async function payLobbyShare(lobbyId: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  throwIfError(authError);
  const currentUserId = authData.user?.id;
  if (!currentUserId) throw new Error('Not authenticated');

  // Get the lobby to check status, price, and max participants
  const { data: lobby, error: lobbyError } = await supabase
    .from('matchmaking_lobbies')
    .select('price_total, status, max_participants')
    .eq('id', lobbyId)
    .maybeSingle();
  throwIfError(lobbyError);
  if (!lobby) throw new Error('Lobby tidak ditemukan.');
  if (lobby.status !== 'pending_payment' && lobby.status !== 'open') {
    throw new Error('Pembayaran tidak dapat dilakukan pada status lobby saat ini (' + lobby.status + ').');
  }

  // Upsert payment record as paid (fixed price = price_total)
  const { error: paymentError } = await supabase
    .from('matchmaking_lobby_payments')
    .upsert(
      {
        lobby_id: lobbyId,
        student_id: currentUserId,
        amount: lobby.price_total,
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'lobby_id,student_id' },
    );
  throwIfError(paymentError);

  // Get all active member IDs
  const { data: activeMembers, error: membersError } = await supabase
    .from('matchmaking_lobby_members')
    .select('student_id')
    .eq('lobby_id', lobbyId)
    .eq('status', 'active');
  throwIfError(membersError);

  // Get all paid member IDs
  const { data: paidMembers, error: paidMembersError } = await supabase
    .from('matchmaking_lobby_payments')
    .select('student_id')
    .eq('lobby_id', lobbyId)
    .eq('status', 'paid');
  throwIfError(paidMembersError);

  const paidIds = new Set((paidMembers ?? []).map((p: { student_id: string }) => p.student_id));
  const allPaid = (activeMembers ?? []).every((m: { student_id: string }) => paidIds.has(m.student_id));

  if (allPaid && (activeMembers ?? []).length > 0) {
    const isFull = (activeMembers ?? []).length >= (lobby.max_participants ?? 4);
    await supabase
      .from('matchmaking_lobbies')
      .update({ 
        status: isFull ? 'paid' : 'open', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', lobbyId);
  }
}

export async function forceLobbyToPendingPayment(lobbyId: string) {
  const { error } = await supabase.rpc('force_lobby_to_pending_payment', {
    p_lobby_id: lobbyId,
  });

  throwIfError(error);
}

export async function forceLobbyToPendingPaymentV2(lobbyId: string) {
  const { error } = await supabase.rpc('force_lobby_to_pending_payment', {
    p_lobby_id: lobbyId,
  });
  throwIfError(error);
}

export async function payLobbyShareFixed(lobbyId: string) {
  const { error } = await supabase.rpc('pay_lobby_share_fixed', {
    p_lobby_id: lobbyId,
  });
  throwIfError(error);
}

export async function expireUnpaidAndCleanup() {
  // Use the improved cleanup function that also releases orphaned held slots
  const { error } = await supabase.rpc('cleanup_expired_lobbies_and_slots');
  if (error) {
    // Fallback to old function if new one doesn't exist yet
    const { error: fallbackError } = await supabase.rpc('expire_unpaid_and_cleanup_lobbies');
    if (fallbackError) {
      console.warn('Cleanup failed:', error.message);
    }
  }
}

export async function fetchMyPaymentStatus(lobbyId: string): Promise<'pending' | 'paid' | 'failed' | 'expired' | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  throwIfError(authError);
  const userId = authData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('matchmaking_lobby_payments')
    .select('status')
    .eq('lobby_id', lobbyId)
    .eq('student_id', userId)
    .maybeSingle();

  if (isMissingMatchmakingPaymentDependency(error)) {
    return null;
  }

  throwIfError(error);
  return (data?.status as 'pending' | 'paid' | 'failed' | 'expired') ?? null;
}

export async function fetchMyTutorProfile(userId: string) {
  const { data, error } = await supabase
    .from('tutor_profiles')
    .select('id, user_id, subject_id, full_name, bio, hourly_rate, image_url, status, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  throwIfError(error);
  return (data ?? null) as TutorSelfProfile | null;
}

export async function upsertMyTutorProfile(input: {
  fullName: string;
  subjectId: string;
  hourlyRate: number;
  bio: string;
  imageUrl: string;
}) {
  const { data, error } = await supabase.rpc('upsert_my_tutor_profile', {
    p_full_name: input.fullName,
    p_subject_id: input.subjectId,
    p_hourly_rate: input.hourlyRate,
    p_bio: input.bio || null,
    p_image_url: input.imageUrl || null,
  });

  throwIfError(error);
  return data as TutorSelfProfile;
}

export async function createTutorAvailability(input: {
  subjectId: string;
  startsAt: string;
  endsAt: string;
  priceTotal: number;
  maxParticipants: number;
  location: string;
  meetingUrl: string;
  notes: string;
  recurrenceGroupId?: string | null;
  recurrencePattern?: 'none' | 'weekly';
  recurrenceIndex?: number;
}) {
  const { error } = await supabase.rpc('create_tutor_availability', {
    p_subject_id: input.subjectId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_price_total: input.priceTotal,
    p_max_participants: input.maxParticipants,
    p_location: input.location || 'Online',
    p_meeting_url: input.meetingUrl || null,
    p_notes: input.notes || null,
    p_recurrence_group_id: input.recurrenceGroupId ?? null,
    p_recurrence_pattern: input.recurrencePattern ?? 'none',
    p_recurrence_index: input.recurrenceIndex ?? 0,
  });

  throwIfError(error);
}

export async function cancelTutorAvailability(slotId: string) {
  const { error } = await supabase.rpc('cancel_tutor_availability', {
    target_slot_id: slotId,
  });

  throwIfError(error);

  // Verify the update actually took effect — guards against RPC that silently
  // succeeds without affecting any row (e.g. RLS filter, already-cancelled row).
  const { data: verify, error: verifyError } = await supabase
    .from('tutor_availability_slots')
    .select('status')
    .eq('id', slotId)
    .maybeSingle();

  throwIfError(verifyError);

  if (!verify) {
    throw new Error('Slot tidak ditemukan. Mungkin sudah dihapus atau bukan milik Anda.');
  }
  if (verify.status !== 'cancelled') {
    throw new Error('Gagal membatalkan slot. Slot mungkin sudah di-booking oleh siswa atau Anda tidak memiliki izin.');
  }
}

export async function deleteTutorAvailability(slotId: string) {
  const { error } = await supabase
    .from('tutor_availability_slots')
    .delete()
    .eq('id', slotId);

  throwIfError(error);
}

function mapTutorAvailabilityRows(rows: any[]): TutorAvailabilitySlot[] {
  return rows.map((row) => {
    const subject = Array.isArray(row.subject) ? row.subject[0] : row.subject;
    const tutor = Array.isArray(row.tutor) ? row.tutor[0] : row.tutor;
    return {
      id: row.id,
      tutor_profile_id: row.tutor_profile_id,
      tutor_user_id: tutor?.user_id ?? null,
      tutor_name: tutor?.full_name ?? '-',
      tutor_rating: Number(tutor?.rating ?? 0),
      tutor_reviews_count: Number(tutor?.reviews_count ?? 0),
      tutor_image_url: tutor?.image_url ?? null,
      tutor_status: tutor?.status ?? 'pending',
      subject_id: row.subject_id,
      subject_name: subject?.name ?? 'Mata Kuliah',
      subject_code: subject?.code ?? null,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      location: row.location ?? 'Online',
      meeting_url: row.meeting_url,
      price_total: Number(row.price_total ?? 0),
      max_participants: Number(row.max_participants ?? 0),
      status: row.status,
      notes: row.notes,
      recurrence_group_id: row.recurrence_group_id,
      recurrence_pattern: row.recurrence_pattern,
      recurrence_index: row.recurrence_index,
      active_lobby_id: null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } satisfies TutorAvailabilitySlot;
  });
}
