import { Banknote, CalendarDays, Clock3, Copy, CreditCard, Lock, RefreshCcw, Search, Users } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  MatchmakingLobby,
  MatchmakingLobbyPayment,
  MatchmakingLobbyVisibility,
  TutorAvailabilitySlot,
  cancelMatchmakingLobby,
  createMatchmakingLobby,
  fetchAvailableTutorSlots,
  fetchMatchmakingLobbies,
  fetchMyLobbyPayments,
  finalizeMatchmakingLobby,
  joinMatchmakingLobby,
  payMatchmakingInvoice,
} from '../../lib/matchmakingData';
import { formatCurrency, formatDate, formatTimeRange } from '../../lib/dashboardData';

const statusLabels: Record<MatchmakingLobby['status'], string> = {
  open: 'Mencari Anggota',
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Kelas Aktif',
  expired: 'Kadaluarsa',
  cancelled: 'Dibatalkan',
  completed: 'Selesai',
};

const initialForm = {
  availabilitySlotId: '',
  title: '',
  description: '',
  visibility: 'public' as MatchmakingLobbyVisibility,
  minParticipants: 2,
  maxParticipants: 4,
  timerHours: 6,
};

export function MatchmakingLobbyView() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [lobbies, setLobbies] = useState<MatchmakingLobby[]>([]);
  const [payments, setPayments] = useState<MatchmakingLobbyPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [form, setForm] = useState(initialForm);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === form.availabilitySlotId) ?? null,
    [form.availabilitySlotId, slots],
  );

  const paymentsByLobby = useMemo(() => {
    const map = new Map<string, MatchmakingLobbyPayment>();
    payments.forEach((payment) => map.set(payment.lobby_id, payment));
    return map;
  }, [payments]);

  const loadData = async () => {
    if (!user) {
      return;
    }

    setIsLoading(true);
    try {
      const [nextSlots, nextLobbies, nextPayments] = await Promise.all([
        fetchAvailableTutorSlots(),
        fetchMatchmakingLobbies(),
        fetchMyLobbyPayments(user.id),
      ]);
      setSlots(nextSlots);
      setLobbies(nextLobbies);
      setPayments(nextPayments);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal memuat fitur lobby grup.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  useEffect(() => {
    if (!selectedSlot) {
      return;
    }

    setForm((current) => ({
      ...current,
      maxParticipants: Math.min(Math.max(current.maxParticipants, current.minParticipants), selectedSlot.max_participants),
      title: current.title || `${selectedSlot.subject_name} - ${selectedSlot.tutor_name}`,
    }));
  }, [selectedSlot?.id]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setIsSubmitting(true);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Aksi lobby gagal diproses.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.availabilitySlotId) {
      setNotice('Pilih slot tutor terlebih dahulu.');
      return;
    }

    const expiresAt = new Date(Date.now() + Math.max(form.timerHours, 1) * 60 * 60 * 1000).toISOString();
    await runAction(
      () =>
        createMatchmakingLobby({
          availabilitySlotId: form.availabilitySlotId,
          title: form.title,
          description: form.description,
          visibility: form.visibility,
          minParticipants: Number(form.minParticipants),
          maxParticipants: Number(form.maxParticipants),
          expiresAt,
        }),
      'Lobby grup berhasil dibuat. Bagikan kode lobby ke temanmu.',
    );
    setForm(initialForm);
  };

  const handleJoinByCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!joinCode.trim()) {
      setNotice('Masukkan kode lobby terlebih dahulu.');
      return;
    }

    await runAction(async () => joinMatchmakingLobby(joinCode), 'Berhasil bergabung ke lobby grup.');
    setJoinCode('');
  };

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">Lobby Grup</p>
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground">Matchmaking Kelas Patungan</h1>
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
            Buat lobby dari jadwal kosong tutor, undang teman dengan kode private, atau gabung ke lobby public yang sudah tersedia.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/20 bg-white px-4 text-sm font-semibold text-primary hover:bg-secondary"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {notice && <div className="mb-5 rounded-lg border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm">{notice}</div>}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <form onSubmit={handleCreate} className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-normal text-foreground">Buat Lobby Baru</h2>
                <p className="text-xs font-medium text-muted-foreground">{slots.length} slot tutor tersedia</p>
              </div>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold text-foreground">Slot tutor</span>
              <select
                value={form.availabilitySlotId}
                onChange={(event) => setForm({ ...form, availabilitySlotId: event.target.value })}
                className="h-11 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              >
                <option value="">Pilih jadwal kosong</option>
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.subject_name} - {slot.tutor_name} - {formatDate(slot.starts_at)} {formatTimeRange(slot.starts_at, slot.ends_at)}
                  </option>
                ))}
              </select>
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold text-foreground">Judul lobby</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Contoh: Review UTS Kalkulus"
                className="h-11 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold text-foreground">Catatan</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                placeholder="Materi yang ingin dibahas"
                className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-foreground">Tipe</span>
                <select
                  value={form.visibility}
                  onChange={(event) => setForm({ ...form, visibility: event.target.value as MatchmakingLobbyVisibility })}
                  className="h-11 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-foreground">Timer</span>
                <select
                  value={String(form.timerHours)}
                  onChange={(event) => setForm({ ...form, timerHours: Number(event.target.value) })}
                  className="h-11 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="3">3 jam</option>
                  <option value="6">6 jam</option>
                  <option value="12">12 jam</option>
                  <option value="24">24 jam</option>
                </select>
              </label>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-foreground">Minimal</span>
                <input
                  type="number"
                  min={2}
                  max={form.maxParticipants}
                  value={form.minParticipants}
                  onChange={(event) => setForm({ ...form, minParticipants: Number(event.target.value) })}
                  className="h-11 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-foreground">Maksimal</span>
                <input
                  type="number"
                  min={form.minParticipants}
                  max={selectedSlot?.max_participants ?? 10}
                  value={form.maxParticipants}
                  onChange={(event) => setForm({ ...form, maxParticipants: Number(event.target.value) })}
                  className="h-11 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>

            {selectedSlot && (
              <div className="mb-4 rounded-lg border border-primary/10 bg-secondary p-3 text-sm font-medium text-foreground">
                <p className="font-semibold text-primary">{formatCurrency(selectedSlot.price_total)} total kelas</p>
                <p className="mt-1 text-muted-foreground">
                  Estimasi {formatCurrency(Math.ceil(selectedSlot.price_total / Math.max(form.maxParticipants, 1)))} per orang jika penuh.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || slots.length === 0}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              <Users className="h-4 w-4" />
              Buat Lobby
            </button>
          </form>

          <form onSubmit={handleJoinByCode} className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-normal text-foreground">Masuk Dengan Kode</h2>
                <p className="text-xs font-medium text-muted-foreground">Untuk lobby private atau undangan teman</p>
              </div>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="Contoh: MAT-1234"
                className="h-11 w-full rounded-lg border border-primary/20 bg-white pl-10 pr-3 text-sm font-semibold tracking-[0.12em] text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-3 flex h-10 w-full items-center justify-center rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground"
            >
              Gabung Lobby
            </button>
          </form>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-extrabold tracking-normal text-foreground">Lobby Aktif</h2>
            <p className="text-sm font-medium text-muted-foreground">{isLoading ? 'Memuat...' : `${lobbies.length} lobby terlihat`}</p>
          </div>

          <div className="space-y-4">
            {!isLoading && lobbies.length === 0 && (
              <div className="rounded-xl border border-primary/10 bg-white p-6 text-sm font-medium text-muted-foreground shadow-md">
                Belum ada lobby public. Buat lobby dari slot tutor yang tersedia.
              </div>
            )}
            {lobbies.map((lobby) => (
              <LobbyCard
                key={lobby.id}
                lobby={lobby}
                payment={paymentsByLobby.get(lobby.id)}
                isSubmitting={isSubmitting}
                onJoin={() => runAction(() => joinMatchmakingLobby(lobby.code), 'Berhasil bergabung ke lobby grup.')}
                onFinalize={() => runAction(() => finalizeMatchmakingLobby(lobby.id), 'Tagihan lobby berhasil dibuat untuk seluruh anggota.')}
                onCancel={() => runAction(() => cancelMatchmakingLobby(lobby.id), 'Lobby berhasil dibatalkan.')}
                onPay={(method) => {
                  const payment = paymentsByLobby.get(lobby.id);
                  if (!payment) {
                    setNotice('Tagihan untuk akun kamu belum ditemukan.');
                    return;
                  }
                  void runAction(() => payMatchmakingInvoice(payment.id, method), 'Pembayaran tercatat. Kelas akan aktif setelah semua anggota lunas.');
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LobbyCard({
  isSubmitting,
  lobby,
  onCancel,
  onFinalize,
  onJoin,
  onPay,
  payment,
}: {
  isSubmitting: boolean;
  lobby: MatchmakingLobby;
  onCancel: () => void;
  onFinalize: () => void;
  onJoin: () => void;
  onPay: (method: string) => void;
  payment?: MatchmakingLobbyPayment;
}) {
  const canFinalize = lobby.current_user_is_creator && lobby.status === 'open' && lobby.member_count >= lobby.min_participants;
  const canJoin = lobby.status === 'open' && !lobby.current_user_is_member && lobby.member_count < lobby.max_participants;
  const canPay = lobby.status === 'pending_payment' && payment?.status === 'pending';

  return (
    <article className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-primary/20 bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">{statusLabels[lobby.status]}</span>
            <span className="rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {lobby.visibility === 'private' ? 'Private' : 'Public'}
            </span>
          </div>
          <h3 className="text-lg font-extrabold text-foreground">{lobby.title}</h3>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {lobby.subject_name} bersama {lobby.tutor_name}
          </p>
        </div>
        <div className="rounded-lg border-2 border-dashed border-primary/20 bg-secondary px-3 py-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kode</p>
          <p className="mt-1 flex items-center justify-center gap-2 text-base font-extrabold tracking-[0.18em] text-primary">
            {lobby.code}
            <Copy className="h-4 w-4" />
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoItem icon={CalendarDays} label="Tanggal" value={formatDate(lobby.starts_at)} />
        <InfoItem icon={Clock3} label="Jam" value={formatTimeRange(lobby.starts_at, lobby.ends_at)} />
        <InfoItem icon={Users} label="Anggota" value={`${lobby.member_count}/${lobby.max_participants} siswa`} />
        <InfoItem icon={Banknote} label="Patungan" value={`${formatCurrency(lobby.price_per_member)} / siswa`} />
      </div>

      {lobby.description && <p className="mb-4 rounded-lg bg-secondary p-3 text-sm font-medium text-muted-foreground">{lobby.description}</p>}

      <div className="flex flex-col gap-3 border-t border-primary/10 pt-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-medium text-muted-foreground">
          <p>Total kelas {formatCurrency(lobby.price_total)}</p>
          {lobby.status === 'open' && <p>Timer selesai {formatDate(lobby.expires_at)} {formatTimeRange(lobby.expires_at, lobby.expires_at)}</p>}
          {payment && (
            <p>
              Invoice {payment.invoice_code}: <span className="font-semibold text-primary">{payment.status === 'paid' ? 'Lunas' : formatCurrency(payment.amount)}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canJoin && (
            <button
              type="button"
              onClick={onJoin}
              disabled={isSubmitting}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
            >
              Gabung
            </button>
          )}
          {canFinalize && (
            <button
              type="button"
              onClick={onFinalize}
              disabled={isSubmitting}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
            >
              Finalisasi & Tagihan
            </button>
          )}
          {lobby.current_user_is_creator && lobby.status === 'open' && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="h-10 rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary hover:bg-secondary disabled:cursor-not-allowed"
            >
              Batalkan
            </button>
          )}
          {canPay && (
            <>
              <button
                type="button"
                onClick={() => onPay('qris')}
                disabled={isSubmitting}
                className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
              >
                <CreditCard className="h-4 w-4" />
                Bayar QRIS
              </button>
              <button
                type="button"
                onClick={() => onPay('transfer_bri')}
                disabled={isSubmitting}
                className="h-10 rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary hover:bg-secondary disabled:cursor-not-allowed"
              >
                Transfer BRI
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-primary/10 bg-secondary p-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
