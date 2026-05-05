-- Table: payments
-- Stores payment transactions for bookings

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_method text not null,
  status text not null default 'pending', -- pending, paid, failed
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_booking_id on public.payments(booking_id);

-- Table: reports
-- Stores admin-generated reports

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete set null,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  data jsonb -- stores report data/summary
);

create index if not exists idx_reports_admin_id on public.reports(admin_id);
create index if not exists idx_reports_type on public.reports(report_type);

-- Function: payments_summary_by_day(start_date date, end_date date)
-- Returns total paid amount grouped by day between the given dates
create or replace function public.payments_summary_by_day(start_date date, end_date date)
returns table(day date, total numeric)
language sql
as $$
  select date(created_at) as day, coalesce(sum(amount), 0) as total
  from public.payments
  where status = 'paid' and date(created_at) between start_date and end_date
  group by date(created_at)
  order by date(created_at);
$$;
