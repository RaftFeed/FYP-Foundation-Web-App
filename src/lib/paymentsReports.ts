import { supabase } from './supabase';

export interface Report {
  id: string;
  admin_id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  created_at: string;
  data: unknown;
}

export async function fetchReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Report[];
}

export interface PaidPayment {
  id: string;
  lobby_id: string;
  student_id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  lobby: {
    id: string;
    title: string;
    subject_name: string;
    starts_at: string;
    ends_at: string;
    max_participants: number;
    price_total: number;
    status: string;
  } | null;
}

export async function fetchPaidPayments(): Promise<PaidPayment[]> {
  const { data, error } = await supabase
    .from('matchmaking_lobby_payments')
    .select(`
      id,
      lobby_id,
      student_id,
      amount,
      status,
      paid_at,
      created_at,
      lobby:matchmaking_lobbies (
        id,
        title,
        subject:subjects ( name ),
        slot:tutor_availability_slots ( starts_at, ends_at ),
        max_participants,
        price_total,
        status
      )
    `)
    .eq('status', 'paid')
    .not('lobby.status', 'in', '("expired","cancelled")')
    .order('paid_at', { ascending: false, nullsLast: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map(mapPaymentRow);
}

export interface TutorPayment {
  id: string;
  lobby_id: string;
  lobby_title: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export async function fetchTutorPayments(tutorUserId: string): Promise<TutorPayment[]> {
  // Fetch via slot → tutor_profile → tutor_user_id to avoid dependency on matchmaking_lobbies.tutor_user_id
  const { data, error } = await supabase
    .from('matchmaking_lobby_payments')
    .select(`
      id,
      lobby_id,
      amount,
      status,
      paid_at,
      created_at,
      lobby:matchmaking_lobbies (
        title,
        availability_slot_id,
        slot:tutor_availability_slots (
          tutor_profile_id,
          tutor:tutor_profiles ( user_id )
        )
      )
    `)
    .in('status', ['paid', 'refunded'])
    .order('paid_at', { ascending: false, nullsLast: true });
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row: any) => row.lobby?.slot?.tutor?.user_id === tutorUserId)
    .map((row: any) => ({
      id: row.id,
      lobby_id: row.lobby_id,
      lobby_title: row.lobby?.title ?? '-',
      amount: row.amount,
      status: row.status,
      paid_at: row.paid_at,
      created_at: row.created_at,
    }));
}

export async function fetchAllPaymentsWithTutorInfo(): Promise<PaidPayment[]> {
  const { data, error } = await supabase
    .from('matchmaking_lobby_payments')
    .select(`
      id,
      lobby_id,
      student_id,
      amount,
      status,
      paid_at,
      created_at,
      lobby:matchmaking_lobbies (
        id,
        title,
        tutor_user_id,
        tutor:tutor_profiles ( full_name ),
        subject:subjects ( name ),
        slot:tutor_availability_slots ( starts_at, ends_at ),
        max_participants,
        price_total,
        status
      )
    `)
    .in('status', ['paid', 'refunded'])
    .order('paid_at', { ascending: false, nullsLast: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map(mapPaymentRow);
}

function mapPaymentRow(row: any): PaidPayment {
  return {
    id: row.id,
    lobby_id: row.lobby_id,
    student_id: row.student_id,
    amount: row.amount,
    status: row.status,
    paid_at: row.paid_at,
    created_at: row.created_at,
    lobby: row.lobby
      ? {
          id: row.lobby.id,
          title: row.lobby.title ?? '-',
          subject_name: row.lobby.subject?.name ?? 'Lainnya',
          starts_at: row.lobby.slot?.starts_at ?? '',
          ends_at: row.lobby.slot?.ends_at ?? '',
          max_participants: row.lobby.max_participants ?? 0,
          price_total: row.lobby.price_total ?? 0,
          status: row.lobby.status ?? '',
        }
      : null,
  };
}
