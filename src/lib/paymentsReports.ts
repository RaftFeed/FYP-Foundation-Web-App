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
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  lobby: {
    title: string;
    subject_name: string;
    starts_at: string;
    ends_at: string;
    price_per_member: number;
    member_count: number;
  } | null;
}

export async function fetchPaidPayments(): Promise<PaidPayment[]> {
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
        subject_name,
        starts_at,
        ends_at,
        price_per_member,
        member_count
      )
    `)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false, nullsLast: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PaidPayment[];
}
