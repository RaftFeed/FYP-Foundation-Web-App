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
  student_email: string;
  student_name: string;
  status: string;
  joined_at: string;
}

export async function fetchSlotStudents(slotId: string): Promise<SlotStudent[]> {
  const { data, error } = await supabase.rpc('get_slot_students', { target_slot_id: slotId });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as SlotStudent[];
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
  member_count: number | null;
  expires_at: string;
  current_user_is_member: boolean;
  current_user_is_creator: boolean;
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
  const { error } = await supabase.rpc('refresh_expired_matchmaking_lobbies');
  if (isMissingMatchmakingPaymentDependency(error)) {
    return;
  }

  if (error) {
    return;
  }
}

export async function fetchAvailableTutorSlots() {
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
    .eq('status', 'available')
    .eq('tutor.status', 'approved')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  throwIfError(error);
  return mapTutorAvailabilityRows(data ?? []);
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
  return mapTutorAvailabilityRows(data ?? []);
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
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  throwIfError(error);
  return mapTutorAvailabilityRows(data ?? []);
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
    .select('lobby_id, student_id, status')
    .eq('status', 'active');

  const memberCount = (memberships ?? []).filter((m) => m.lobby_id === lobby.id).length;
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
    price_per_member: Math.ceil(
      Number(lobby.price_total ?? 0) / Math.max(memberCount, 1),
    ),
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
      .in('status', ['open', 'pending_payment', 'paid', 'cancelled', 'completed'])
      .order('created_at', { ascending: false }),
    supabase
      .from('matchmaking_lobby_members')
      .select('lobby_id, student_id, status')
      .eq('status', 'active'),
  ]);

  throwIfError(lobbiesError);
  throwIfError(membershipsError);

  const activeMemberships = new Set(
    (memberships ?? [])
      .filter((membership) => membership.student_id === currentUserId)
      .map((membership) => membership.lobby_id),
  );

  const memberCounts = new Map<string, number>();
  for (const membership of memberships ?? []) {
    memberCounts.set(membership.lobby_id, (memberCounts.get(membership.lobby_id) ?? 0) + 1);
  }

  return ((lobbies ?? []) as Array<{
    id: string;
    code: string;
    creator_id: string;
    subject_id: string;
    tutor_profile_id: string;
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
    price_per_member: Math.ceil(
      Number(lobby.price_total ?? 0) / Math.max(memberCounts.get(lobby.id) ?? Number(lobby.max_participants ?? 1), 1),
    ),
    member_count: memberCounts.get(lobby.id) ?? 0,
    expires_at: lobby.expires_at,
    current_user_is_member: activeMemberships.has(lobby.id),
    current_user_is_creator: lobby.creator_id === currentUserId,
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
  if (!currentUserId) {
    throw new Error('You must be signed in to leave a lobby.');
  }

  const { error } = await supabase
    .from('matchmaking_lobby_members')
    .update({
      status: 'left',
      left_at: new Date().toISOString(),
    })
    .eq('lobby_id', lobbyId)
    .eq('student_id', currentUserId)
    .eq('status', 'active');

  throwIfError(error);
}

export async function fetchMyTutorProfile(userId: string) {
  const { data, error } = await supabase
    .from('tutor_profiles')
    .select('id, user_id, subject_id, full_name, bio, hourly_rate, image_url, status')
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
