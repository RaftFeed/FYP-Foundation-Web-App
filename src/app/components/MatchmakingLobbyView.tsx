import { Banknote, CalendarDays, Clock3, Copy, Lock, Search, Timer, Users } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { readLocalCache, usePersistentState, writeLocalCache } from '../../lib/browserState';
import { NoticeModal, type NoticeModalState } from './ui/NoticeModal';
import {
  MatchmakingLobby,
  MatchmakingLobbyVisibility,
  TutorAvailabilitySlot,
  createMatchmakingLobby,
  fetchAvailableTutorSlots,
  fetchMatchmakingLobbies,
  joinMatchmakingLobby,
} from '../../lib/matchmakingData';
import { useLobbyRealtime } from '../../lib/useLobbyRealtime';
import { LobbyDetailModal } from './ui/tutor-dashboard/SlotCard';
import { formatCurrency, formatDate, formatTimeRange } from '../../lib/dashboardData';

const statusLabels: Record<MatchmakingLobby['status'], string> = {
  open: 'Mencari Anggota',
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Kelas Aktif',
  expired: 'Kadaluarsa',
  cancelled: 'Dibatalkan',
  completed: 'Selesai',
};

function LobbyCountdown({ expiresAt }: { expiresAt: string }) {
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
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600">
        <Timer className="h-3.5 w-3.5" />
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
      className={`inline-flex items-center gap-1.5 text-xs font-bold tabular-nums ${
        isUrgent ? 'text-red-600 animate-pulse' : 'text-amber-600'
      }`}
    >
      <Timer className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

const initialForm = {
  availabilitySlotId: '',
  title: '',
  description: '',
  visibility: 'public' as MatchmakingLobbyVisibility,
  minParticipants: 1,
  maxParticipants: 10,
  timerHours: 6,
};

export function MatchmakingLobbyView({
  onLobbyChange,
  initialSlotId,
  onInitialSlotConsumed,
}: {
  onLobbyChange?: () => void;
  initialSlotId?: string | null;
  onInitialSlotConsumed?: () => void;
}) {
  const { user } = useAuth();
  const stateKeyPrefix = user ? `matchmaking:${user.id}` : null;
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [lobbies, setLobbies] = useState<MatchmakingLobby[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<NoticeModalState | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedDate, setSelectedDate] = useState('all');
  const [selectedTutor, setSelectedTutor] = useState('all');
  const [joinCode, setJoinCode] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:join-code` : null, '');
  const [form, setForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:create-form` : null, initialForm);
  const [activeModal, setActiveModal] = useState<'create' | 'join' | null>(null);
  const [activeLobbyDetail, setActiveLobbyDetail] = useState<MatchmakingLobby | null>(null);

  const showNotice = (tone: NoticeModalState['tone'], message: string) => {
    setNotice({ tone, message });
  };

  useEffect(() => {
    if (!copyToast) {
      return;
    }

    const timeout = window.setTimeout(() => setCopyToast(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyToast]);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === form.availabilitySlotId) ?? null,
    [form.availabilitySlotId, slots],
  );
  const availableLobbies = useMemo(
    () =>
      lobbies.filter((lobby) => {
        const memberCount = lobby.member_count ?? 0;
        return lobby.visibility === 'public' && lobby.status === 'open' && !lobby.current_user_is_member && memberCount < lobby.max_participants;
      }),
    [lobbies],
  );
  const subjectOptions = useMemo(
    () => Array.from(new Map(availableLobbies.map((lobby) => [lobby.subject_id, lobby.subject_name])).entries()),
    [availableLobbies],
  );
  const tutorOptions = useMemo(
    () => Array.from(new Set(availableLobbies.map((lobby) => lobby.tutor_name))).sort((left, right) => left.localeCompare(right, 'id-ID')),
    [availableLobbies],
  );
  const dateOptions = useMemo(
    () =>
      Array.from(
        new Map(
          availableLobbies.map((lobby) => {
            const key = getDateKey(lobby.starts_at);
            return [key, formatDate(lobby.starts_at)] as const;
          }),
        ).entries(),
      ).sort((left, right) => left[0].localeCompare(right[0])),
    [availableLobbies],
  );

  const filteredLobbies = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return availableLobbies.filter((lobby) => {
      if (selectedSubject !== 'all' && lobby.subject_id !== selectedSubject) {
        return false;
      }

      if (selectedDate !== 'all' && getDateKey(lobby.starts_at) !== selectedDate) {
        return false;
      }

      if (selectedTutor !== 'all' && lobby.tutor_name !== selectedTutor) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        lobby.title,
        lobby.code,
        lobby.subject_name,
        lobby.subject_code ?? '',
        lobby.tutor_name,
        lobby.description ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [availableLobbies, searchQuery, selectedDate, selectedSubject, selectedTutor]);

  const loadData = useCallback(async () => {
    if (!user) {
      return;
    }

    const cacheKey = `matchmaking:${user.id}:data`;
    const cachedData = readLocalCache<{
      slots: TutorAvailabilitySlot[];
      lobbies: MatchmakingLobby[];
    }>(cacheKey);

    if (cachedData) {
      setSlots(cachedData.slots);
      setLobbies(cachedData.lobbies);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const [nextSlots, nextLobbies] = await Promise.all([
        fetchAvailableTutorSlots(),
        fetchMatchmakingLobbies(),
      ]);
      setSlots(nextSlots);
      setLobbies(nextLobbies);
      writeLocalCache(cacheKey, {
        slots: nextSlots,
        lobbies: nextLobbies,
      });
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal memuat fitur lobby grup.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Subscribe to realtime changes — auto-refresh when lobbies or members change
  useLobbyRealtime(loadData);

  useEffect(() => {
    if (initialSlotId && slots.length > 0) {
      const slotExists = slots.some((slot) => slot.id === initialSlotId);
      if (slotExists) {
        setForm((current) => ({
          ...current,
          availabilitySlotId: initialSlotId,
        }));
        setActiveModal('create');
      }
      onInitialSlotConsumed?.();
    }
  }, [initialSlotId, slots, onInitialSlotConsumed, setForm]);

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
      showNotice('success', successMessage);
      await loadData();
      onLobbyChange?.();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Aksi lobby gagal diproses.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.availabilitySlotId) {
      showNotice('error', 'Pilih slot tutor terlebih dahulu.');
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
    setActiveModal(null);
  };

  const handleJoinByCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!joinCode.trim()) {
      showNotice('error', 'Masukkan kode lobby terlebih dahulu.');
      return;
    }

    await runAction(async () => joinMatchmakingLobby(joinCode), 'Berhasil bergabung ke lobby grup.');
    setJoinCode('');
    setActiveModal(null);
  };

  return (
    <section>
      <div className="mb-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Matchmaking Kelas</h1>
        </div>
      </div>

      {copyToast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-900 shadow-lg">
          {copyToast}
        </div>
      )}

      <div className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveModal('create')}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            <Users className="h-4 w-4" />
            Buat Lobby Baru
          </button>
          <button
            type="button"
            onClick={() => setActiveModal('join')}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-primary/20 bg-white px-4 text-sm font-semibold text-primary hover:bg-secondary"
          >
            <Lock className="h-4 w-4" />
            Masuk Dengan Kode
          </button>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,220px))]">
            <label className="relative block lg:col-span-1">
              <span className="sr-only">Cari lobby</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari kelas, tutor, atau kode kelas"
                className="h-10 w-full rounded-lg border border-primary/20 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <select
              aria-label="Filter mata kuliah"
              value={selectedSubject}
              onChange={(event) => setSelectedSubject(event.target.value)}
              className="h-10 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Semua Matkul</option>
              {subjectOptions.map(([subjectId, subjectName]) => (
                <option key={subjectId} value={subjectId}>
                  {subjectName}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter tanggal"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-10 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Semua Tanggal</option>
              {dateOptions.map(([dateKey, label]) => (
                <option key={dateKey} value={dateKey}>
                  {label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter tutor"
              value={selectedTutor}
              onChange={(event) => setSelectedTutor(event.target.value)}
              className="h-10 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Semua Tutor</option>
              {tutorOptions.map((tutorName) => (
                <option key={tutorName} value={tutorName}>
                  {tutorName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-extrabold tracking-normal text-foreground">Lobby Tersedia</h2>
            <p className="text-sm font-medium text-muted-foreground">
              {isLoading ? 'Memuat...' : `${filteredLobbies.length} lobby terlihat`}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
            {isLoading && (
              <div className="divide-y divide-primary/5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted" />
                          <div className="space-y-1.5">
                            <div className="h-4 w-32 rounded bg-muted" />
                            <div className="h-3 w-20 rounded bg-muted" />
                          </div>
                        </div>
                        <div className="h-5 w-48 rounded bg-muted" />
                        <div className="flex gap-4">
                          <div className="h-3 w-28 rounded bg-muted" />
                          <div className="h-3 w-24 rounded bg-muted" />
                          <div className="h-3 w-16 rounded bg-muted" />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 lg:w-36">
                        <div className="h-5 w-24 rounded bg-muted" />
                        <div className="h-8 w-28 rounded-lg bg-muted" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isLoading && filteredLobbies.length === 0 && (
              <div className="p-6 text-sm font-medium text-muted-foreground">Belum ada lobby public yang bisa kamu ikuti sekarang.</div>
            )}
            {!isLoading &&
              filteredLobbies.map((lobby) => (
                <LobbyCard
                  key={lobby.id}
                  lobby={lobby}
                  isSubmitting={isSubmitting}
                  onCopy={() => setCopyToast('Kode lobby disalin')}
                  onJoin={() => runAction(() => joinMatchmakingLobby(lobby.code), 'Berhasil bergabung ke lobby grup.')}
                  onShowDetail={() => setActiveLobbyDetail(lobby)}
                />
              ))}
          </div>
        </div>
      </div>

      <ModalFrame
        isOpen={activeModal === 'create'}
        title="Buat Lobby Baru"
        description={`${slots.length} slot tutor tersedia untuk dijadikan lobby.`}
        onClose={() => setActiveModal(null)}
      >
        <form onSubmit={handleCreate}>
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
                <option value="24">1 hari</option>
                <option value="48">2 hari</option>
                <option value="72">3 hari</option>
                <option value="168">7 hari</option>
              </select>
            </label>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-foreground">Minimal Peserta</span>
              <input
                type="number"
                min={1}
                max={form.maxParticipants}
                value={form.minParticipants}
                onChange={(event) => setForm({ ...form, minParticipants: Number(event.target.value) })}
                className="h-11 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-foreground">Maksimal Peserta</span>
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
      </ModalFrame>

      <ModalFrame
        isOpen={activeModal === 'join'}
        title="Masuk Dengan Kode"
        description="Untuk lobby private atau undangan teman."
        onClose={() => setActiveModal(null)}
      >
        <form onSubmit={handleJoinByCode}>
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
      </ModalFrame>

      {notice && <NoticeModal notice={notice} onClose={() => setNotice(null)} />}

      {activeLobbyDetail && (
        <LobbyDetailModal lobby={activeLobbyDetail} onClose={() => setActiveLobbyDetail(null)} />
      )}
    </section>
  );
}

function LobbyCard({
  isSubmitting,
  lobby,
  onCopy,
  onJoin,
  onShowDetail,
}: {
  isSubmitting: boolean;
  lobby: MatchmakingLobby;
  onCopy: () => void;
  onJoin: () => void;
  onShowDetail: () => void;
}) {
  const activeMembers = lobby.member_count ?? 0;
  const canJoin = lobby.status === 'open' && !lobby.current_user_is_member && activeMembers < lobby.max_participants;
  const memberCountLabel = `${activeMembers}/${lobby.max_participants} siswa`;
  const progressLabel = `${activeMembers}/${lobby.max_participants}`;

  return (
    <article className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 lg:grid-cols-[112px_minmax(0,1fr)_260px] lg:items-stretch">
      <div className="relative flex min-h-[120px] items-center justify-center rounded-2xl border border-primary/10 bg-secondary/70 text-primary">
        <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-foreground shadow-sm">{progressLabel}</span>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
          <Users className="h-8 w-8" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-primary/20 bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">{statusLabels[lobby.status]}</span>
          <span className="rounded-md border border-border bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {lobby.visibility === 'private' ? 'Private' : 'Public'}
          </span>
        </div>

        <h3 className="text-lg font-extrabold text-foreground lg:text-xl">{lobby.title}</h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          {lobby.subject_name} bersama {lobby.tutor_name}
        </p>

        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formatDate(lobby.starts_at)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-primary" />
            {formatTimeRange(lobby.starts_at, lobby.ends_at)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {memberCountLabel}
          </span>
          {lobby.status === 'open' && (
            <LobbyCountdown expiresAt={lobby.expires_at} />
          )}
        </div>

        {lobby.description && <p className="mt-4 rounded-xl bg-secondary p-3 text-sm font-medium text-muted-foreground">{lobby.description}</p>}
      </div>

      <div className="flex flex-col justify-between gap-3 border-t border-primary/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <div>
          <p className="text-sm font-semibold text-foreground">{formatCurrency(lobby.price_per_member)} / siswa</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            {lobby.price_per_member !== lobby.price_if_full && (
              <><span className="text-green-600">{formatCurrency(lobby.price_if_full)}</span> jika penuh</>
            )}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Kode Kelas</p>
          <button
            type="button"
            onClick={async () => {
              if (await copyLobbyCode(lobby.code)) {
                onCopy();
              }
            }}
            className="mt-1 inline-flex items-center gap-2 rounded-lg border border-dashed border-primary/20 bg-secondary px-3 py-2 text-sm font-bold tracking-[0.18em] text-foreground transition hover:border-primary/40 hover:bg-primary/5"
            aria-label={`Salin kode lobby ${lobby.code}`}
            title="Klik untuk menyalin kode lobby"
          >
            {lobby.code}
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onShowDetail}
            className="h-10 rounded-lg border border-primary/20 bg-white px-4 text-sm font-semibold text-primary hover:bg-secondary"
          >
            Lihat Detail
          </button>
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
        </div>
      </div>
    </article>
  );
}

function getDateKey(value: string) {
  return value.slice(0, 10);
}

function ModalFrame({
  children,
  description,
  isOpen,
  onClose,
  title,
}: {
  children: React.ReactNode;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-primary/10 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-normal text-foreground">{title}</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-primary/20 px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary"
          >
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
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

async function copyLobbyCode(code: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(code);
      return true;
    } catch {
      return false;
    }
  }

  try {
    const tempInput = document.createElement('input');
    tempInput.value = code;
    tempInput.setAttribute('readonly', 'true');
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(tempInput);
    return copied;
  } catch {
    return false;
  }
}
