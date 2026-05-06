import { supabase } from './supabase';

export type TutorAvailabilityStatus = 'available' | 'held' | 'booked' | 'cancelled';
export type MatchmakingLobbyVisibility = 'public' | 'private';
export type MatchmakingLobbyStatus = 'open' | 'pending_payment' | 'paid' | 'expired' | 'cancelled' | 'completed';
export type MatchmakingPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

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
  active_lobby_id: string | null;
  created_at: string;
  updated_at: string;
}

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
  member_count: number;
  expires_at: string;
  payment_due_at: string | null;
  current_user_is_member: boolean;
  current_user_is_creator: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchmakingLobbyPayment {
  id: string;
  lobby_id: string;
  student_id: string;
  amount: number;
  payment_method: string;
  status: MatchmakingPaymentStatus;
  invoice_code: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  lobby?: {
    id: string;
    code: string;
    title: string;
    status: MatchmakingLobbyStatus;
  } | null;
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

export async function refreshExpiredLobbies() {
  const { error } = await supabase.rpc('refresh_expired_matchmaking_lobbies');
  if (error) {
    return;
  }
}

export async function fetchAvailableTutorSlots() {
  await refreshExpiredLobbies();

  const { data, error } = await supabase
    .from('tutor_availability_overview')
    .select('*')
    .eq('status', 'available')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  throwIfError(error);
  return (data ?? []) as TutorAvailabilitySlot[];
}

export async function fetchMyTutorAvailability(tutorUserId: string, startIso: string, endIso: string) {
  const { data, error } = await supabase
    .from('tutor_availability_overview')
    .select('*')
    .eq('tutor_user_id', tutorUserId)
    .gte('starts_at', startIso)
    .lt('starts_at', endIso)
    .order('starts_at', { ascending: true });

  throwIfError(error);
  return (data ?? []) as TutorAvailabilitySlot[];
}

export async function fetchMatchmakingLobbies() {
  await refreshExpiredLobbies();

  const { data, error } = await supabase
    .from('matchmaking_lobby_overview')
    .select('*')
    .in('status', ['open', 'pending_payment', 'paid'])
    .order('starts_at', { ascending: true });

  throwIfError(error);
  return (data ?? []) as MatchmakingLobby[];
}

export async function fetchMyLobbyPayments(userId: string) {
  const { data, error } = await supabase
    .from('matchmaking_lobby_payments')
    .select(`
      id,
      lobby_id,
      student_id,
      amount,
      payment_method,
      status,
      invoice_code,
      paid_at,
      created_at,
      updated_at,
      lobby:matchmaking_lobbies (
        id,
        code,
        title,
        status
      )
    `)
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  throwIfError(error);
  return (data ?? []) as unknown as MatchmakingLobbyPayment[];
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

export async function finalizeMatchmakingLobby(lobbyId: string) {
  const { error } = await supabase.rpc('close_matchmaking_lobby_for_payment', {
    target_lobby_id: lobbyId,
  });

  throwIfError(error);
}

export async function payMatchmakingInvoice(paymentId: string, paymentMethod: string) {
  const { error } = await supabase.rpc('pay_matchmaking_invoice', {
    target_payment_id: paymentId,
    p_payment_method: paymentMethod,
  });

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
  });

  throwIfError(error);
}

export async function cancelTutorAvailability(slotId: string) {
  const { error } = await supabase.rpc('cancel_tutor_availability', {
    target_slot_id: slotId,
  });

  throwIfError(error);
}
