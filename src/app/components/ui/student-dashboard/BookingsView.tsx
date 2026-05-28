import { useState, useMemo } from 'react';
import { Clock3, NotebookTabs, Users } from 'lucide-react';
import { usePersistentState } from '../../../../lib/browserState';
import {
  Booking,
  BookingStatus,
  bookingStatusLabel,
  formatCurrency,
  formatDate,
  formatTimeRange,
} from '../../../../lib/dashboardData';
import { MatchmakingLobby, MatchmakingLobbyStatus } from '../../../../lib/matchmakingData';
import { LobbyDetailModal } from '../tutor-dashboard/SlotCard';

type BookingTab = 'Semua' | 'Mendatang' | 'Selesai' | 'Dibatalkan' | 'Menunggu Pembayaran';

const bookingTabs: BookingTab[] = ['Semua', 'Mendatang', 'Selesai', 'Dibatalkan', 'Menunggu Pembayaran'];
const bookingStatusesByTab: Record<Exclude<BookingTab, 'Semua'>, BookingStatus[]> = {
  Mendatang: ['upcoming'],
  Selesai: ['completed'],
  Dibatalkan: ['cancelled'],
  'Menunggu Pembayaran': ['pending_payment'],
};
const lobbyStatusesByTab: Record<Exclude<BookingTab, 'Semua'>, MatchmakingLobbyStatus[]> = {
  Mendatang: ['open', 'paid'],
  Selesai: ['completed'],
  Dibatalkan: ['cancelled'],
  'Menunggu Pembayaran': ['pending_payment'],
};

export function BookingsView({
  bookings,
  joinedLobbies,
  onCancel,
  onLeaveLobby,
  onPay,
  stateKeyPrefix,
}: {
  bookings: Booking[];
  joinedLobbies: MatchmakingLobby[];
  onCancel: (bookingId: string) => void;
  onLeaveLobby: (lobbyId: string) => void;
  onPay: (bookingId: string) => Promise<void>;
  stateKeyPrefix: string | null;
}) {
  const [activeLobbyDetail, setActiveLobbyDetail] = useState<MatchmakingLobby | null>(null);
  const [activeTab, setActiveTab] = usePersistentState<BookingTab>(stateKeyPrefix ? `${stateKeyPrefix}:booking-tab` : null, 'Semua');
  const [paymentModalBooking, setPaymentModalBooking] = useState<Booking | null>(null);
  const visibleBookings = useMemo(() => {
    if (activeTab === 'Semua') {
      return bookings;
    }

    return bookings.filter((booking) => bookingStatusesByTab[activeTab].includes(booking.status));
  }, [activeTab, bookings]);
  const visibleJoinedLobbies = useMemo(() => {
    if (activeTab === 'Semua') {
      return joinedLobbies;
    }

    return joinedLobbies.filter((lobby) => lobbyStatusesByTab[activeTab].includes(lobby.status));
  }, [activeTab, joinedLobbies]);
  const hasItemsInActiveGroup = visibleBookings.length > 0 || visibleJoinedLobbies.length > 0;

  return (
    <section>
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Histori Pemesanan Kelas</h1>
        <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
          Berikut adalah riwayat pemesanan kelas dari database akun kamu.
        </p>
      </div>

      <div className="mb-5 flex gap-3 overflow-x-auto border-b border-primary/10">
        {bookingTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`min-w-max border-b-2 px-4 pb-3 text-sm font-semibold transition ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold tracking-normal text-foreground">Lobby Grup Saya</h2>
          <p className="text-sm font-medium text-muted-foreground">{visibleJoinedLobbies.length} lobby diikuti</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
          {visibleJoinedLobbies.map((lobby) => (
            <JoinedLobbyRow key={lobby.id} lobby={lobby} onLeave={onLeaveLobby} onShowDetail={() => setActiveLobbyDetail(lobby)} />
          ))}
        </div>
      </div>

      {(visibleBookings.length > 0 || !hasItemsInActiveGroup) && (
        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
          {visibleBookings.length === 0 && <div className="p-6 text-sm font-medium text-muted-foreground">Belum ada booking pada kategori ini.</div>}
          {visibleBookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} onCancel={onCancel} onPay={() => setPaymentModalBooking(booking)} />
          ))}
        </div>
      )}

      {paymentModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
          <div className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-5 shadow-xl">
            <h2 className="mb-2 text-xl font-extrabold tracking-normal text-foreground">Pembayaran Kelas</h2>
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              Selesaikan pembayaran sebesar <span className="font-bold text-foreground">{formatCurrency(paymentModalBooking.total_price)}</span> untuk melanjutkan.
            </p>
            <div className="rounded-lg border border-primary/10 bg-secondary/50 p-4 mb-6 text-sm">
              <p className="font-semibold text-primary mb-1">Informasi Gimmick</p>
              <p className="text-muted-foreground">Klik tombol di bawah ini untuk mensimulasikan pembayaran yang berhasil.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPaymentModalBooking(null)}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  void onPay(paymentModalBooking.id);
                  setPaymentModalBooking(null);
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition"
              >
                Simulasi Bayar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeLobbyDetail && (
        <LobbyDetailModal lobby={activeLobbyDetail} onClose={() => setActiveLobbyDetail(null)} />
      )}
    </section>
  );
}

export function JoinedLobbyRow({ lobby, onLeave, onShowDetail }: { lobby: MatchmakingLobby; onLeave: (lobbyId: string) => void; onShowDetail: () => void }) {
  const memberCount = lobby.member_count ?? 0;
  const canLeave = lobby.status !== 'completed' && lobby.status !== 'cancelled';

  return (
    <article className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 lg:grid-cols-[92px_1fr_220px] lg:items-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-primary/10 bg-secondary text-primary">
        <Users className="h-8 w-8" />
      </div>
      <div>
        <h3 className="mb-1 text-base font-extrabold text-foreground">{lobby.title}</h3>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {lobby.subject_name} bersama {lobby.tutor_name}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="rounded-full bg-secondary px-3 py-1 text-primary">{lobby.status}</span>
          <span>{formatDate(lobby.starts_at)}</span>
          <span>{formatTimeRange(lobby.starts_at, lobby.ends_at)}</span>
          <span>{memberCount}/{lobby.max_participants} siswa</span>
        </div>
      </div>
      <div className="text-sm font-medium text-muted-foreground lg:text-right">
        <p className="font-semibold text-foreground">{formatCurrency(lobby.price_per_member)} / siswa</p>
        <p className="mt-1">Kode {lobby.code}</p>
        <p className="mt-1">{lobby.location}</p>
        <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={onShowDetail}
            className="h-10 rounded-lg border border-primary/20 bg-white px-4 text-sm font-semibold text-primary transition hover:bg-secondary"
          >
            Lihat Detail
          </button>
          {canLeave && (
            <button
              type="button"
              onClick={() => onLeave(lobby.id)}
              className="h-10 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 hover:border-red-300"
            >
              Keluar
            </button>
          )}
        </div>
      </div>

    </article>
  );
}

export function BookingRow({ booking, onCancel, onPay }: { booking: Booking; onCancel?: (bookingId: string) => void; onPay?: () => void }) {
  const session = booking.session;
  const bookingLabel = session?.subject?.name ?? session?.title ?? `Booking ${booking.id.slice(0, 8)}`;
  const createdAtLabel = formatDate(booking.created_at);
  const [showCancel, setShowCancel] = useState(false);

  return (
    <article className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 lg:grid-cols-[92px_1fr_220px] lg:items-center">
      <div className="h-20 w-20 rounded-xl border border-primary/10 bg-secondary" />
      <div>
        <h3 className="mb-1 text-base font-extrabold text-foreground">{bookingLabel}</h3>
        <p className="mb-4 text-sm font-medium text-muted-foreground">
          {session?.tutor?.full_name ? `Tutor : ${session.tutor.full_name}` : `Session ID : ${booking.session_id}`}
        </p>
        {session && (
          <div className="flex flex-col gap-2 text-sm font-medium text-foreground sm:flex-row sm:gap-5">
            <p className="flex items-center gap-2">
              <NotebookTabs className="h-4 w-4 text-primary" />
              {formatDate(session.starts_at)}
            </p>
            <p className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              {formatTimeRange(session.starts_at, session.ends_at)}
            </p>
          </div>
        )}
        {!session && (
          <div className="flex flex-col gap-2 text-sm font-medium text-foreground sm:flex-row sm:gap-5">
            <p className="flex items-center gap-2">
              <NotebookTabs className="h-4 w-4 text-primary" />
              {createdAtLabel}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 lg:block lg:text-right">
        <div>
          <p className="mb-2 inline-flex rounded-lg border border-primary/20 bg-secondary px-3 py-1 text-xs font-semibold text-primary lg:mb-4">
            {bookingStatusLabel(booking.status)}
          </p>
          <p className="text-base font-semibold text-primary">{formatCurrency(booking.total_price)}</p>
        </div>
        <div className="flex flex-col gap-2">
          {booking.status === 'pending_payment' && onPay && (
            <button
              type="button"
              onClick={onPay}
              className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90 lg:mt-4"
            >
              Bayar
            </button>
          )}
          {onCancel && booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="h-10 rounded-lg border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 hover:bg-red-100 hover:border-red-300 lg:mt-2"
            >
              Batalkan
            </button>
          )}

          {showCancel && onCancel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
              <div className="w-full max-w-sm rounded-2xl border border-primary/10 bg-white p-5 shadow-xl">
                <h2 className="mb-2 text-lg font-extrabold text-foreground">Batalkan Booking?</h2>
                <p className="mb-5 text-sm font-medium text-muted-foreground">
                  Booking <span className="font-semibold text-foreground">{bookingLabel}</span> senilai{' '}
                  <span className="font-bold text-foreground">{formatCurrency(booking.total_price)}</span> akan dibatalkan. Tindakan ini tidak bisa dibatalkan.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCancel(false)}
                    className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary transition"
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCancel(false); onCancel(booking.id); }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                  >
                    Ya, Batalkan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
