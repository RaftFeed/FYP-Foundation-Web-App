import { useState, useEffect } from 'react';
import { ArrowUpRight, Banknote } from 'lucide-react';
import { formatCurrency, formatDate, formatTimeRange } from '../../../../lib/dashboardData';
import { MatchmakingLobby, TutorAvailabilitySlot, payLobbyShare } from '../../../../lib/matchmakingData';
import { JoinedLobbyRow } from './BookingsView';
import { LobbyDetailModal } from '../tutor-dashboard/SlotCard';
import { StudentView } from '../../StudentDashboard';

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remaining <= 0) {
    return <span className="text-xs font-bold text-red-600">Waktu habis</span>;
  }
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return (
    <span className={`text-xs font-bold tabular-nums ${remaining < 3600 ? 'text-red-600' : 'text-amber-600'}`}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

export function DashboardView({
  joinedLobbies,
  displayName,
  availableTutorSlots,
  setActiveView,
  onLeaveLobby,
}: {
  joinedLobbies: MatchmakingLobby[];
  displayName: string;
  availableTutorSlots: TutorAvailabilitySlot[];
  setActiveView: (view: StudentView) => void;
  onLeaveLobby?: (lobbyId: string) => void;
}) {
  const [activeLobbyDetail, setActiveLobbyDetail] = useState<MatchmakingLobby | null>(null);
  const [paymentLobby, setPaymentLobby] = useState<MatchmakingLobby | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const activeLobbies = joinedLobbies.filter((lobby) => lobby.status === 'open' || lobby.status === 'paid');
  const completedLobbies = joinedLobbies.filter((lobby) => lobby.status === 'completed');
  const pendingPayment = joinedLobbies.filter((lobby) => lobby.status === 'pending_payment');
  const totalSpend = joinedLobbies
    .filter((lobby) => lobby.current_user_has_paid)
    .reduce((sum, lobby) => sum + lobby.price_per_member, 0);

  const stats = [
    { label: 'Kelas Aktif', value: String(activeLobbies.length), view: 'bookings' as StudentView },
    { label: 'Menunggu Pembayaran', value: String(pendingPayment.length), view: 'bookings' as StudentView },
    { label: 'Kelas Selesai', value: String(completedLobbies.length), view: 'bookings' as StudentView },
    { label: 'Total Pengeluaran', value: formatCurrency(totalSpend), view: 'bookings' as StudentView, wide: true },
  ];

  const upcoming = joinedLobbies
    .filter((lobby) => lobby.status === 'open' || lobby.status === 'paid' || lobby.status === 'pending_payment')
    .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime())
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
        </div>

        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
          {upcoming.length > 0 ? (
            upcoming.map((lobby) => (
              <JoinedLobbyRow
                key={lobby.id}
                lobby={lobby}
                onLeave={() => onLeaveLobby?.(lobby.id)}
                onShowDetail={() => setActiveLobbyDetail(lobby)}
                onPay={() => setPaymentLobby(lobby)}
              />
            ))
          ) : (
            <div className="p-6 text-sm font-medium text-muted-foreground">
              Belum ada booking mendatang. Ada {availableTutorSlots.length} slot tutor tersedia untuk kamu.
            </div>
          )}
        </div>
      </section>

      {activeLobbyDetail && (
        <LobbyDetailModal lobby={activeLobbyDetail} onClose={() => setActiveLobbyDetail(null)} />
      )}

      {paymentLobby && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
          <div className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-5 shadow-xl">
            <h2 className="mb-2 text-xl font-extrabold tracking-normal text-foreground">Pembayaran Kelas</h2>
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              Selesaikan pembayaran untuk lobby <span className="font-bold text-foreground">{paymentLobby.title}</span>
            </p>
            <div className="mb-4 space-y-2 rounded-lg border border-primary/10 bg-secondary/50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mata Kuliah</span>
                <span className="font-semibold text-foreground">{paymentLobby.subject_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tutor</span>
                <span className="font-semibold text-foreground">{paymentLobby.tutor_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Jadwal</span>
                <span className="font-semibold text-foreground">{formatDate(paymentLobby.starts_at)} {formatTimeRange(paymentLobby.starts_at, paymentLobby.ends_at)}</span>
              </div>
              <hr className="border-primary/10" />
              <div className="flex items-center justify-between text-base">
                <span className="font-bold text-primary">Bagianmu</span>
                <span className="font-extrabold text-primary">{formatCurrency(paymentLobby.price_per_member)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 mb-5">
              <div className="text-sm">
                <p className="font-semibold text-amber-800 mb-1">⏳ Batas Waktu Pembayaran</p>
                <p className="text-amber-700">Segera selesaikan pembayaran sebelum waktu habis.</p>
              </div>
              <CountdownTimer expiresAt={paymentLobby.expires_at} />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPaymentLobby(null)}
                disabled={isPaying}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsPaying(true);
                  try {
                    await payLobbyShare(paymentLobby.id);
                    setPaymentLobby(null);
                    window.location.reload();
                  } catch (error) {
                    alert(error instanceof Error ? error.message : 'Gagal memproses pembayaran.');
                  } finally {
                    setIsPaying(false);
                  }
                }}
                disabled={isPaying}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPaying ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5 373 0 12h4z" /></svg>
                    Memproses...
                  </>
                ) : (
                  <>
                    <Banknote className="h-4 w-4" />
                    Bayar {formatCurrency(paymentLobby.price_per_member)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
