import { useState, useMemo } from 'react';
import { Banknote, CircleCheck, Clock3, NotebookTabs, Users } from 'lucide-react';
import { usePersistentState } from '../../../../lib/browserState';
import {
  formatCurrency,
  formatDate,
  formatTimeRange,
} from '../../../../lib/dashboardData';
import { MatchmakingLobby, MatchmakingLobbyStatus, payLobbyShare } from '../../../../lib/matchmakingData';
import { LobbyDetailModal } from '../tutor-dashboard/SlotCard';

type BookingTab = 'Semua' | 'Mendatang' | 'Selesai' | 'Dibatalkan' | 'Menunggu Pembayaran';

const bookingTabs: BookingTab[] = ['Semua', 'Mendatang', 'Selesai', 'Dibatalkan', 'Menunggu Pembayaran'];
const lobbyStatusesByTab: Record<Exclude<BookingTab, 'Semua'>, MatchmakingLobbyStatus[]> = {
  Mendatang: ['open', 'paid'],
  Selesai: ['completed'],
  Dibatalkan: ['cancelled', 'expired'],
  'Menunggu Pembayaran': ['pending_payment'],
};

const lobbyStatusLabels: Record<MatchmakingLobbyStatus, string> = {
  open: 'Mencari Anggota',
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Kelas Aktif',
  expired: 'Kadaluarsa',
  cancelled: 'Dibatalkan',
  completed: 'Selesai',
};

export function BookingsView({
  joinedLobbies,
  onLeaveLobby,
  onPaySuccess,
  onPayError,
  stateKeyPrefix,
}: {
  joinedLobbies: MatchmakingLobby[];
  onLeaveLobby: (lobbyId: string) => void;
  onPaySuccess: () => void;
  onPayError: (error: string) => void;
  stateKeyPrefix: string | null;
}) {
  const [activeLobbyDetail, setActiveLobbyDetail] = useState<MatchmakingLobby | null>(null);
  const [activeTab, setActiveTab] = usePersistentState<BookingTab>(stateKeyPrefix ? `${stateKeyPrefix}:booking-tab` : null, 'Semua');
  const [paymentModalLobby, setPaymentModalLobby] = useState<MatchmakingLobby | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const visibleJoinedLobbies = useMemo(() => {
    if (activeTab === 'Semua') {
      return joinedLobbies;
    }

    return joinedLobbies.filter((lobby) => lobbyStatusesByTab[activeTab].includes(lobby.status));
  }, [activeTab, joinedLobbies]);

  const handlePay = async (lobby: MatchmakingLobby) => {
    setIsPaying(true);
    try {
      await payLobbyShare(lobby.id);
      setPaymentModalLobby(null);
      onPaySuccess();
    } catch (error) {
      onPayError(error instanceof Error ? error.message : 'Gagal memproses pembayaran.');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <section>
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Histori Pemesanan Kelas</h1>
        <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
          Berikut adalah riwayat pemesanan kelas dari lobby grup yang kamu ikuti.
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
            {tab === 'Menunggu Pembayaran' && joinedLobbies.filter((l) => l.status === 'pending_payment').length > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                {joinedLobbies.filter((l) => l.status === 'pending_payment').length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold tracking-normal text-foreground">Lobby Grup Saya</h2>
          <p className="text-sm font-medium text-muted-foreground">{visibleJoinedLobbies.length} lobby</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
          {visibleJoinedLobbies.length === 0 && (
            <div className="p-6 text-sm font-medium text-muted-foreground">Belum ada booking pada kategori ini.</div>
          )}
          {visibleJoinedLobbies.map((lobby) => (
            <JoinedLobbyRow
              key={lobby.id}
              lobby={lobby}
              onLeave={onLeaveLobby}
              onShowDetail={() => setActiveLobbyDetail(lobby)}
              onPay={() => setPaymentModalLobby(lobby)}
            />
          ))}
        </div>
      </div>

      {paymentModalLobby && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
          <div className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-5 shadow-xl">
            <h2 className="mb-2 text-xl font-extrabold tracking-normal text-foreground">Pembayaran Kelas</h2>
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              Selesaikan pembayaran untuk lobby <span className="font-bold text-foreground">{paymentModalLobby.title}</span>
            </p>

            <div className="mb-4 space-y-2 rounded-lg border border-primary/10 bg-secondary/50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mata Kuliah</span>
                <span className="font-semibold text-foreground">{paymentModalLobby.subject_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tutor</span>
                <span className="font-semibold text-foreground">{paymentModalLobby.tutor_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Jadwal</span>
                <span className="font-semibold text-foreground">
                  {formatDate(paymentModalLobby.starts_at)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Waktu</span>
                <span className="font-semibold text-foreground">
                  {formatTimeRange(paymentModalLobby.starts_at, paymentModalLobby.ends_at)}
                </span>
              </div>
              <hr className="border-primary/10" />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Kelas</span>
                <span className="font-semibold text-foreground">{formatCurrency(paymentModalLobby.price_total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Peserta Maks</span>
                <span className="font-semibold text-foreground">{paymentModalLobby.max_participants} orang</span>
              </div>
              <hr className="border-primary/10" />
              <div className="flex items-center justify-between text-base">
                <span className="font-bold text-primary">Bagianmu</span>
                <span className="font-extrabold text-primary">{formatCurrency(paymentModalLobby.price_per_member)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-5 text-sm">
              <p className="font-semibold text-amber-800 mb-1">💡 Mode Simulasi</p>
              <p className="text-amber-700">Klik tombol di bawah untuk mensimulasikan pembayaran yang berhasil. Anggota yang tidak membayar akan otomatis dikeluarkan.</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPaymentModalLobby(null)}
                disabled={isPaying}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handlePay(paymentModalLobby)}
                disabled={isPaying}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPaying ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Memproses...
                  </>
                ) : (
                  <>
                    <Banknote className="h-4 w-4" />
                    Bayar {formatCurrency(paymentModalLobby.price_per_member)}
                  </>
                )}
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

export function JoinedLobbyRow({
  lobby,
  onLeave,
  onShowDetail,
  onPay,
}: {
  lobby: MatchmakingLobby;
  onLeave: (lobbyId: string) => void;
  onShowDetail: () => void;
  onPay?: () => void;
}) {
  const memberCount = lobby.member_count ?? 0;
  const canLeave = lobby.status !== 'completed' && lobby.status !== 'cancelled' && lobby.status !== 'expired';
  const canPay = lobby.status === 'pending_payment';

  return (
    <article className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 lg:grid-cols-[92px_1fr_220px] lg:items-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-primary/10 bg-secondary text-primary">
        {lobby.status === 'paid' || lobby.status === 'completed' ? (
          <CircleCheck className="h-8 w-8 text-green-600" />
        ) : lobby.status === 'pending_payment' ? (
          <Banknote className="h-8 w-8 text-amber-600" />
        ) : (
          <Users className="h-8 w-8" />
        )}
      </div>
      <div>
        <h3 className="mb-1 text-base font-extrabold text-foreground">{lobby.title}</h3>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {lobby.subject_name} bersama {lobby.tutor_name}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className={`rounded-full px-3 py-1 ${
            lobby.status === 'paid' ? 'bg-green-100 text-green-700' :
            lobby.status === 'pending_payment' ? 'bg-amber-100 text-amber-700' :
            lobby.status === 'cancelled' || lobby.status === 'expired' ? 'bg-red-100 text-red-700' :
            'bg-secondary text-primary'
          }`}>{lobbyStatusLabels[lobby.status]}</span>
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
          {canPay && onPay && (
            <button
              type="button"
              onClick={onPay}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Bayar
            </button>
          )}
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
