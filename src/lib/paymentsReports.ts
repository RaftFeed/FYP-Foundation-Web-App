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
