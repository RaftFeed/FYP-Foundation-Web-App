import { supabase } from './supabase';

export type UserRole = 'student' | 'tutor' | 'admin';
export type TutorStatus = 'pending' | 'approved' | 'rejected';
export type BookingStatus = 'pending_payment' | 'upcoming' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  image_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  created_at: string;
}

export interface SubjectMatchmakingSummary extends Subject {
  matchmaking_count: number;
  slot_count: number;
}

export interface TutorProfile {
  id: string;
  user_id: string | null;
  subject_id: string | null;
  full_name: string;
  bio: string | null;
  hourly_rate: number;
  rating: number;
  reviews_count: number;
  image_url: string | null;
  status: TutorStatus;
  created_at: string;
  subject?: Pick<Subject, 'id' | 'name' | 'code'> | null;
}

export interface PublicTutorCard {
  id: string;
  name: string;
  subject: string;
  rating: number;
  reviews: number;
  hourlyRate: number;
  imageUrl: string | null;
}

export interface Booking {
  id: string;
  session_id: string;
  student_id: string;
  status: BookingStatus;
  total_price: number;
  created_at: string;
  session?: {
    id: string;
    code: string;
    title: string;
    starts_at: string;
    ends_at: string;
    price_per_seat: number;
    capacity: number;
    status: string;
    subject?: Pick<Subject, 'name' | 'code'> | null;
    tutor?: Pick<TutorProfile, 'full_name'> | null;
  } | null;
  student?: Pick<Profile, 'email' | 'full_name'> | null;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatTimeRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
}

export function bookingStatusLabel(status: BookingStatus) {
  const labels: Record<BookingStatus, string> = {
    pending_payment: 'Menunggu Pembayaran',
    upcoming: 'Mendatang',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
  };

  return labels[status];
}

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function isMissingLeanMvpDependency(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === '42P01'
    || error.code === 'PGRST200'
    || error.code === 'PGRST205'
    || error.message?.includes("Could not find a relationship between 'bookings' and 'course_sessions'") === true
    || error.message?.includes('relation "public.course_sessions" does not exist') === true
    || error.message?.includes('relation "public.bookings" does not exist') === true
    || error.message?.includes('relation "public.course_session_overview" does not exist') === true
  );
}

export async function fetchMyBookings(userId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, session_id, student_id, status, total_price, created_at')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  if (isMissingLeanMvpDependency(error)) {
    return [];
  }

  throwIfError(error);
  return ((data ?? []) as Booking[]).map((booking) => ({
    ...booking,
    session: null,
  }));
}

export async function cancelBooking(bookingId: string) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' satisfies BookingStatus })
    .eq('id', bookingId);

  throwIfError(error);

  // Verify the update actually took effect — protects against silent RLS rewrites
  // or calls against rows that don't exist / don't belong to the caller.
  const { data: verify, error: verifyError } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .maybeSingle();

  throwIfError(verifyError);

  if (!verify) {
    throw new Error('Booking tidak ditemukan. Mungkin sudah dihapus atau bukan milik Anda.');
  }
  if (verify.status !== 'cancelled') {
    throw new Error('Gagal membatalkan booking. Anda tidak memiliki izin untuk membatalkan booking ini.');
  }
}

export async function fetchSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('name', { ascending: true });

  throwIfError(error);
  return (data ?? []) as Subject[];
}

export async function fetchSubjectMatchmakingSummaries() {
  const { data, error } = await supabase
    .from('subject_matchmaking_overview')
    .select('*')
    .order('matchmaking_count', { ascending: false })
    .order('name', { ascending: true });

  if (!error) {
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      code: row.code ? String(row.code) : null,
      description: row.description ? String(row.description) : null,
      created_at: String(row.created_at ?? ''),
      matchmaking_count: Number(row.matchmaking_count ?? 0),
      slot_count: Number(row.slot_count ?? 0),
    }));
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('subjects')
    .select(`
      id,
      name,
      code,
      description,
      created_at,
      matchmaking_lobbies!left (
        id,
        status
      )
    `)
    .order('name', { ascending: true });

  throwIfError(fallbackError);

  return ((fallbackData ?? []) as Array<Subject & { matchmaking_lobbies?: Array<{ id: string; status: string }> | null }>).map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code,
    description: subject.description,
    created_at: subject.created_at,
    matchmaking_count: (subject.matchmaking_lobbies ?? []).filter((lobby) =>
      ['open', 'pending_payment', 'paid'].includes(lobby.status),
    ).length,
    slot_count: 0,
  }));
}

export async function fetchTutorProfiles() {
  const { data, error } = await supabase
    .from('tutor_profiles')
    .select('*, subject:subjects(id, name, code)')
    .order('created_at', { ascending: false });

  throwIfError(error);
  return (data ?? []) as TutorProfile[];
}

export async function fetchApprovedTutorCards(limit = 6) {
  const { data, error } = await supabase
    .from('tutor_profiles')
    .select(`
      id,
      full_name,
      hourly_rate,
      rating,
      reviews_count,
      image_url,
      subject:subjects (name)
    `)
    .eq('status', 'approved')
    .order('rating', { ascending: false })
    .limit(limit);

  throwIfError(error);

  return (data ?? []).map((tutor) => {
    const row = tutor as unknown as {
      id: string;
      full_name: string;
      hourly_rate: number;
      rating: number;
      reviews_count: number;
      image_url: string | null;
      subject: { name: string } | null;
    };

    return {
      id: row.id,
      name: row.full_name,
      subject: row.subject?.name ?? 'Tutor PPKU',
      rating: Number(row.rating ?? 0),
      reviews: Number(row.reviews_count ?? 0),
      hourlyRate: Number(row.hourly_rate ?? 0),
      imageUrl: row.image_url,
    } satisfies PublicTutorCard;
  });
}

export async function fetchAdminBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      session_id,
      student_id,
      status,
      total_price,
      created_at,
      student:profiles!bookings_student_id_fkey (email, full_name)
    `)
    .order('created_at', { ascending: false });

  throwIfError(error);
  
  return ((data ?? []) as any[]).map((booking) => ({
    ...booking,
    student: Array.isArray(booking.student) ? booking.student[0] : (booking.student ?? null),
    session: null,
  })) as Booking[];
}

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, image_url, role, created_at')
    .order('created_at', { ascending: false });

  throwIfError(error);
  return (data ?? []) as Profile[];
}

export async function fetchProfileById(id: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, image_url, role, created_at')
    .eq('id', id)
    .maybeSingle();

  throwIfError(error);
  return (data ?? null) as Profile | null;
}

export async function upsertSubject(input: Pick<Subject, 'name' | 'code' | 'description'> & { id?: string }) {
  const payload = {
    name: input.name.trim(),
    code: input.code?.trim() || null,
    description: input.description?.trim() || null,
  };

  const query = input.id
    ? supabase.from('subjects').update(payload).eq('id', input.id)
    : supabase.from('subjects').insert(payload);

  const { error } = await query;
  throwIfError(error);
}

export async function deleteSubject(id: string) {
  const { error } = await supabase.from('subjects').delete().eq('id', id);
  throwIfError(error);
}

export async function upsertTutorProfile(input: {
  id?: string;
  full_name: string;
  subject_id: string;
  hourly_rate: number;
  rating: number;
  reviews_count: number;
  image_url: string | null;
  status: TutorStatus;
  bio: string | null;
}) {
  const payload = {
    full_name: input.full_name.trim(),
    subject_id: input.subject_id || null,
    hourly_rate: input.hourly_rate,
    rating: input.rating,
    reviews_count: input.reviews_count,
    image_url: input.image_url || null,
    status: input.status,
    bio: input.bio || null,
  };

  const query = input.id
    ? supabase.from('tutor_profiles').update(payload).eq('id', input.id)
    : supabase.from('tutor_profiles').insert(payload);

  const { error } = await query;
  throwIfError(error);
}

export async function deleteTutorProfile(id: string) {
  const { error } = await supabase.from('tutor_profiles').delete().eq('id', id);
  throwIfError(error);
}

export async function updateBookingStatus(id: string, status: BookingStatus) {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  throwIfError(error);
}

export async function updateProfileRole(id: string, role: UserRole) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  throwIfError(error);
}

export async function updateProfileDetails(
  id: string,
  updates: { full_name?: string; image_url?: string | null; }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select();

  console.log("UPDATED:", data);
  console.log("ERROR:", error);

  throwIfError(error);
}
