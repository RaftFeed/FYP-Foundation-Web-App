import { ArrowUpRight } from 'lucide-react';
import { Booking, formatCurrency } from '../../../../lib/dashboardData';
import { TutorAvailabilitySlot } from '../../../../lib/matchmakingData';
import { BookingRow } from './BookingsView';
import { StudentView } from '../../StudentDashboard'; // Wait, I'll export it from StudentDashboard

export function DashboardView({
  bookings,
  displayName,
  availableTutorSlots,
  setActiveView,
}: {
  bookings: Booking[];
  displayName: string;
  availableTutorSlots: TutorAvailabilitySlot[];
  setActiveView: (view: StudentView) => void;
}) {
  const activeBookings = bookings.filter((booking) => booking.status === 'upcoming' || booking.status === 'pending_payment');
  const completedBookings = bookings.filter((booking) => booking.status === 'completed');
  const pendingPayment = bookings.filter((booking) => booking.status === 'pending_payment');
  const totalSpend = bookings
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((sum, booking) => sum + booking.total_price, 0);

  const stats = [
    { label: 'Kelas Aktif', value: String(activeBookings.length), view: 'bookings' as StudentView },
    { label: 'Menunggu Pembayaran', value: String(pendingPayment.length), view: 'bookings' as StudentView },
    { label: 'Kelas Selesai', value: String(completedBookings.length), view: 'bookings' as StudentView },
    { label: 'Total Pengeluaran', value: formatCurrency(totalSpend), view: 'bookings' as StudentView, wide: true },
  ];

  const upcoming = bookings
    .filter((booking) => booking.status === 'upcoming' || booking.status === 'pending_payment')
    .slice(0, 3);

  return (
    <section>
      <h1 className="mb-3 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Hello, {displayName}!</h1>
      <p className="mb-6 text-base font-medium text-muted-foreground">Belajar apa hari ini?</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="relative min-h-[112px] rounded-xl border border-primary/10 bg-white p-4 shadow-md transition hover:border-primary/30 hover:-translate-y-0.5">
            <p className="mb-3 max-w-[80%] text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className={`${stat.wide ? 'text-2xl' : 'text-3xl'} font-extrabold leading-none text-foreground`}>{stat.value}</p>
            <button
              type="button"
              onClick={() => setActiveView(stat.view)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary"
              aria-label={`Open ${stat.label}`}
            >
              <ArrowUpRight className="h-5 w-5" />
            </button>
          </article>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-extrabold tracking-normal text-foreground">Kelas Mendatang</h2>
          <button type="button" onClick={() => setActiveView('courses')} className="text-sm font-semibold text-foreground hover:underline">
            Cari Kelas
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
          {upcoming.length > 0 ? (
            upcoming.map((booking) => <BookingRow key={booking.id} booking={booking} />)
          ) : (
            <div className="p-6 text-sm font-medium text-muted-foreground">
              Belum ada booking mendatang. Ada {availableTutorSlots.length} slot tutor tersedia untuk kamu.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
