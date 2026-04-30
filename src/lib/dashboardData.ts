import { supabase } from './supabase';

export type UserRole = 'student' | 'tutor' | 'admin';
export type TutorStatus = 'pending' | 'approved' | 'rejected';
export type SessionStatus = 'scheduled' | 'cancelled' | 'completed';
export type BookingStatus = 'pending_payment' | 'upcoming' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
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

export interface CourseSession {
  id: string;
  code: string;
  title: string;
  starts_at: string;
  ends_at: string;
  price_per_seat: number;
  capacity: number;
  location: string | null;
  status: SessionStatus;
  subject_id: string;
  tutor_profile_id: string;
  subject_name: string;
  subject_code: string | null;
  tutor_name: string;
  tutor_image_url: string | null;
  tutor_rating: number;
  tutor_reviews_count: number;
  booked_seats: number;
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
    status: SessionStatus;
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

export function sessionStatusLabel(status: SessionStatus) {
  const labels: Record<SessionStatus, string> = {
    scheduled: 'Terjadwal',
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

export async function fetchCourseSessions() {
  const { data, error } = await supabase
    .from('course_session_overview')
    .select('*')
    .eq('status', 'scheduled')
    .order('starts_at', { ascending: true });

  if (error) {
    return fetchCourseSessionsFallback();
  }

  return (data ?? []) as CourseSession[];
}

async function fetchCourseSessionsFallback() {
  const { data, error } = await supabase
    .from('course_sessions')
    .select(`
      id,
      code,
      title,
      starts_at,
      ends_at,
      price_per_seat,
      capacity,
      location,
      status,
      subject_id,
      tutor_profile_id,
      subject:subjects (name, code),
      tutor:tutor_profiles!inner (full_name, image_url, rating, reviews_count, status)
    `)
    .eq('status', 'scheduled')
    .eq('tutor.status', 'approved')
    .order('starts_at', { ascending: true });

  throwIfError(error);

  return (data ?? []).map((session) => {
    const row = session as unknown as {
      id: string;
      code: string;
      title: string;
      starts_at: string;
      ends_at: string;
      price_per_seat: number;
      capacity: number;
      location: string | null;
      status: SessionStatus;
      subject_id: string;
      tutor_profile_id: string;
      subject: { name: string; code: string | null } | null;
      tutor: { full_name: string; image_url: string | null; rating: number; reviews_count: number; status: TutorStatus } | null;
    };

    return {
      ...row,
      subject_name: row.subject?.name ?? row.title,
      subject_code: row.subject?.code ?? null,
      tutor_name: row.tutor?.full_name ?? '-',
      tutor_image_url: row.tutor?.image_url ?? null,
      tutor_rating: row.tutor?.rating ?? 0,
      tutor_reviews_count: row.tutor?.reviews_count ?? 0,
      booked_seats: 0,
    } satisfies CourseSession;
  });
}

export async function fetchAdminCourseSessions() {
  const { data, error } = await supabase
    .from('course_sessions')
    .select(`
      id,
      code,
      title,
      starts_at,
      ends_at,
      price_per_seat,
      capacity,
      location,
      status,
      subject_id,
      tutor_profile_id,
      subject:subjects (name, code),
      tutor:tutor_profiles (full_name, image_url, rating, reviews_count)
    `)
    .order('starts_at', { ascending: true });

  throwIfError(error);

  return (data ?? []).map((session) => {
    const row = session as unknown as {
      id: string;
      code: string;
      title: string;
      starts_at: string;
      ends_at: string;
      price_per_seat: number;
      capacity: number;
      location: string | null;
      status: SessionStatus;
      subject_id: string;
      tutor_profile_id: string;
      subject: { name: string; code: string | null } | null;
      tutor: { full_name: string; image_url: string | null; rating: number; reviews_count: number } | null;
    };

    return {
      ...row,
      subject_name: row.subject?.name ?? row.title,
      subject_code: row.subject?.code ?? null,
      tutor_name: row.tutor?.full_name ?? '-',
      tutor_image_url: row.tutor?.image_url ?? null,
      tutor_rating: row.tutor?.rating ?? 0,
      tutor_reviews_count: row.tutor?.reviews_count ?? 0,
      booked_seats: 0,
    } satisfies CourseSession;
  });
}

export async function bookCourseSession(sessionId: string) {
  const { error } = await supabase.rpc('join_class', {
    target_session_id: sessionId,
  });

  if (!error) {
    return;
  }

  const { error: legacyError } = await supabase.rpc('book_course_session', {
    target_session_id: sessionId,
  });

  if (!legacyError) {
    return;
  }

  await joinClassWithoutRpc(sessionId);
}

async function joinClassWithoutRpc(sessionId: string) {
  const { data: sessionData, error: sessionError } = await supabase
    .from('course_sessions')
    .select('id, price_per_seat, status')
    .eq('id', sessionId)
    .eq('status', 'scheduled')
    .single();

  throwIfError(sessionError);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  throwIfError(authError);

  if (!authData.user) {
    throw new Error('You must be signed in to join a class.');
  }

  const { error } = await supabase
    .from('bookings')
    .insert({
      session_id: sessionData.id,
      student_id: authData.user.id,
      status: 'pending_payment' satisfies BookingStatus,
      total_price: sessionData.price_per_seat,
    });

  if (error?.code === '23505') {
    throw new Error('You already joined this class.');
  }

  throwIfError(error);
}

export async function fetchMyBookings(userId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      session_id,
      student_id,
      status,
      total_price,
      created_at,
      session:course_sessions (
        id,
        code,
        title,
        starts_at,
        ends_at,
        price_per_seat,
        capacity,
        status,
        subject:subjects (name, code),
        tutor:tutor_profiles (full_name)
      )
    `)
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  throwIfError(error);
  return (data ?? []) as unknown as Booking[];
}

export async function cancelBooking(bookingId: string) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' satisfies BookingStatus })
    .eq('id', bookingId);

  throwIfError(error);
}

export async function fetchSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('name', { ascending: true });

  throwIfError(error);
  return (data ?? []) as Subject[];
}

export async function fetchTutorProfiles() {
  const { data, error } = await supabase
    .from('tutor_profiles')
    .select('*, subject:subjects(id, name, code)')
    .order('created_at', { ascending: false });

  throwIfError(error);
  return (data ?? []) as TutorProfile[];
}

export async function fetchAdminBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      session_id,
      student_id,
      status,
      total_price,
      created_at,
      student:profiles!bookings_student_id_fkey (email, full_name),
      session:course_sessions (
        id,
        code,
        title,
        starts_at,
        ends_at,
        price_per_seat,
        capacity,
        status,
        subject:subjects (name, code),
        tutor:tutor_profiles (full_name)
      )
    `)
    .order('created_at', { ascending: false });

  throwIfError(error);
  return (data ?? []) as unknown as Booking[];
}

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false });

  throwIfError(error);
  return (data ?? []) as Profile[];
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

export async function upsertCourseSession(input: {
  id?: string;
  tutor_profile_id: string;
  subject_id: string;
  code: string;
  title: string;
  starts_at: string;
  ends_at: string;
  price_per_seat: number;
  capacity: number;
  location: string | null;
  status: SessionStatus;
}) {
  const payload = {
    tutor_profile_id: input.tutor_profile_id,
    subject_id: input.subject_id,
    code: input.code.trim(),
    title: input.title.trim(),
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    price_per_seat: input.price_per_seat,
    capacity: input.capacity,
    location: input.location || null,
    status: input.status,
  };

  const query = input.id
    ? supabase.from('course_sessions').update(payload).eq('id', input.id)
    : supabase.from('course_sessions').insert(payload);

  const { error } = await query;
  throwIfError(error);
}

export async function deleteCourseSession(id: string) {
  const { error } = await supabase.from('course_sessions').delete().eq('id', id);
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
