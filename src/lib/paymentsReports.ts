import { supabase } from './supabase';

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  payment_method: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  admin_id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  created_at: string;
  data: any;
}

export async function fetchDailyPaymentsReport(date: string) {
  // date: 'YYYY-MM-DD'
  const { data, error } = await supabase
    .from('payments')
    .select(`id, amount, payment_method, status, paid_at, created_at, updated_at, booking_id`)
    .gte('created_at', `${date}T00:00:00.000Z`)
    .lte('created_at', `${date}T23:59:59.999Z`)
    .eq('status', 'paid');
  if (error) throw new Error(error.message);
  return data as Payment[];
}

export async function fetchPaymentsSummaryByDay(start: string, end: string) {
  // start, end: 'YYYY-MM-DD'
  const { data, error } = await supabase.rpc('payments_summary_by_day', { start_date: start, end_date: end });
  if (error) throw new Error(error.message);
  return data as Array<{ date: string; total: number }>;
}

export async function fetchReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Report[];
}
