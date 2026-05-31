import { useState, useMemo, useEffect, useCallback } from 'react';
import { Banknote, ChevronLeft, ChevronRight, CircleCheck, Clock3, NotebookTabs, Timer, Users } from 'lucide-react';
import { usePersistentState } from '../../../../lib/browserState';
import {
  formatCurrency,
  formatDate,
  formatTimeRange,
} from '../../../../lib/dashboardData';
import { MatchmakingLobby, MatchmakingLobbyStatus, payLobbyShare, forceLobbyToPendingPayment } from '../../../../lib/matchmakingData';
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

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const computeRemaining = useCallback(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  }, [expiresAt]);

  const [remaining, setRemaining] = useState(computeRemaining);

  useEffect(() => {
    setRemaining(computeRemaining());
    const interval = window.setInterval(() => {
      setRemaining(computeRemaining());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [computeRemaining]);

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
        <Timer className="h-3 w-3" />
        Waktu habis
      </span>
    );
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining < 3600;
  const label = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tabular-nums ${
        isUrgent
          ? 'bg-red-100 text-red-700 animate-pulse'
          : 'bg-amber-100 text-amber-700'
      }`}
    >
      <Timer className="h-3 w-3" />
      {label}
    </span>
  );
}

export function BookingsView({
  joinedLobbies,
  onLeaveLobby,
  onPaySuccess,
  onPayError,
  onRefresh,
  stateKeyPrefix,
}: {
  joinedLobbies: MatchmakingLobby[];
  onLeaveLobby: (lobbyId: string) => void;
  onPaySuccess: () => void;
  onPayError: (error: string) => void;
  onRefresh?: () => void;
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

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const totalPages = Math.ceil(visibleJoinedLobbies.length / ITEMS_PER_PAGE);

  const paginatedLobbies = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return visibleJoinedLobbies.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [visibleJoinedLobbies, currentPage]);

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

  const handleForceLock = async (lobbyId: string) => {
    try {
      await forceLobbyToPendingPayment(lobbyId);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      onPayError(error instanceof Error ? error.message : 'Gagal mensimulasikan lobby penuh.');
    }
  };

  return (
    <section>
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Histori Pemesanan Kelas</h1>
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
            {tab === 'Menunggu Pembayaran' && joinedLobbies.filter((l) => l.status === 'pending_payment' && !l.current_user_has_paid).length > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                {joinedLobbies.filter((l) => l.status === 'pending_payment' && !l.current_user_has_paid).length}
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
          {paginatedLobbies.map((lobby) => (
            <JoinedLobbyRow
              key={lobby.id}
              lobby={lobby}
              onLeave={onLeaveLobby}
              onShowDetail={() => setActiveLobbyDetail(lobby)}
              onPay={() => setPaymentModalLobby(lobby)}
              onForceLock={handleForceLock}
            />
          ))}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={visibleJoinedLobbies.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
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

            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 mb-5">
              <div className="text-sm">
                <p className="font-semibold text-amber-800 mb-1">⏳ Batas Waktu Pembayaran</p>
                <p className="text-amber-700">Segera selesaikan pembayaran sebelum waktu habis.</p>
              </div>
              <CountdownTimer expiresAt={paymentModalLobby.expires_at} />
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
  onForceLock,
}: {
  lobby: MatchmakingLobby;
  onLeave: (lobbyId: string) => void;
  onShowDetail: () => void;
  onPay?: () => void;
  onForceLock?: (lobbyId: string) => void;
}) {
  const memberCount = lobby.member_count ?? 0;
  const canLeave = lobby.status !== 'completed' && lobby.status !== 'cancelled' && lobby.status !== 'expired';
  const canPay = lobby.status === 'pending_payment' && !lobby.current_user_has_paid;

  return (
    <article className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 lg:grid-cols-[92px_1fr_220px] lg:items-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-primary/10 bg-secondary text-primary">
        {lobby.status === 'paid' || lobby.status === 'completed' || (lobby.status === 'pending_payment' && lobby.current_user_has_paid) ? (
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
        {lobby.description && (
          <p className="mb-2 rounded-md bg-secondary/50 px-2.5 py-1.5 text-xs text-muted-foreground italic">{lobby.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className={`rounded-full px-3 py-1 ${
            lobby.status === 'paid' ? 'bg-green-100 text-green-700' :
            lobby.status === 'pending_payment' ? (
              lobby.current_user_has_paid ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            ) :
            lobby.status === 'cancelled' || lobby.status === 'expired' ? 'bg-red-100 text-red-700' :
            'bg-secondary text-primary'
          }`}>
            {lobby.status === 'pending_payment' && lobby.current_user_has_paid
              ? 'Sudah Bayar (Menunggu Anggota Lain)'
              : lobbyStatusLabels[lobby.status]}
          </span>
          {(lobby.status === 'open' || lobby.status === 'pending_payment') && (
            <CountdownTimer expiresAt={lobby.expires_at} />
          )}
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
          {lobby.status === 'open' && onForceLock && (
            <button
              type="button"
              onClick={() => onForceLock(lobby.id)}
              className="h-10 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 hover:border-amber-300"
            >
              Simulasikan Penuh
            </button>
          )}
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

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const startRange = (currentPage - 1) * itemsPerPage + 1;
  const endRange = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      
      if (start === 1) {
        end = 5;
      } else if (end === totalPages) {
        start = totalPages - 4;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-primary/10 bg-white px-6 py-4 sm:flex-row">
      <p className="text-sm font-medium text-muted-foreground">
        Menampilkan <span className="font-semibold text-foreground">{startRange}</span>-
        <span className="font-semibold text-foreground">{endRange}</span> dari{" "}
        <span className="font-semibold text-foreground">{totalItems}</span> lobby
      </p>
      
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-primary/20 bg-white px-3 text-sm font-semibold text-primary hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="h-4 w-4" />
          Sebelumnya
        </button>

        {getPageNumbers().map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition ${
              currentPage === page
                ? "bg-primary text-white shadow-sm"
                : "border border-primary/10 bg-white text-primary hover:bg-secondary"
            }`}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-primary/20 bg-white px-3 text-sm font-semibold text-primary hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Selanjutnya
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
