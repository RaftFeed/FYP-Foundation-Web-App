import { BookOpen, CalendarDays, Clock3, LogOut, RefreshCcw, Save, Trash2, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { readLocalCache, usePersistentState, writeLocalCache } from '../../lib/browserState';
import { Subject, fetchSubjects, formatCurrency, formatDate, formatTimeRange } from '../../lib/dashboardData';
import {
  TutorAvailabilitySlot,
  TutorSelfProfile,
  cancelTutorAvailability,
  createTutorAvailability,
  fetchMyTutorAvailability,
  fetchMyTutorProfile,
  upsertMyTutorProfile,
} from '../../lib/matchmakingData';

const slotStatusLabels: Record<TutorAvailabilitySlot['status'], string> = {
  available: 'Tersedia',
  held: 'Di-hold Lobby',
  booked: 'Terbooking',
  cancelled: 'Dibatalkan',
};

const emptyProfileForm = {
  fullName: '',
  subjectId: '',
  hourlyRate: 120000,
  bio: '',
  imageUrl: '',
};

const emptySlotForm = {
  subjectId: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '19:00',
  endTime: '20:30',
  priceTotal: 120000,
  maxParticipants: 4,
  location: 'Online',
  meetingUrl: '',
  notes: '',
  repeatMode: 'once' as 'once' | 'weekly',
  repeatWeeks: 4,
};

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRange(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function getDisplayName(email?: string) {
  return email?.split('@')[0].replace(/[._-]+/g, ' ') || 'Tutor';
}

export function TutorDashboard() {
  const { user, signOut } = useAuth();
  const stateKeyPrefix = user ? `tutor-dashboard:${user.id}` : null;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [profile, setProfile] = useState<TutorSelfProfile | null>(null);
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [profileForm, setProfileForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:profile-form` : null, emptyProfileForm);
  const [slotForm, setSlotForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:slot-form` : null, emptySlotForm);
  const [selectedMonth, setSelectedMonth] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:selected-month` : null, monthValue(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const monthRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const slotRepeatMode = slotForm.repeatMode === 'weekly' || Boolean((slotForm as typeof emptySlotForm & { repeatWeekly?: boolean }).repeatWeekly) ? 'weekly' : 'once';

  const loadTutorData = async () => {
    if (!user) {
      return;
    }

    const cacheKey = `tutor-dashboard:${user.id}:meta`;
    const cachedData = readLocalCache<{
      subjects: Subject[];
      profile: TutorSelfProfile | null;
    }>(cacheKey);

    if (cachedData) {
      setSubjects(cachedData.subjects);
      setProfile(cachedData.profile);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const [nextSubjects, nextProfile] = await Promise.all([
        fetchSubjects(),
        fetchMyTutorProfile(user.id),
      ]);
      setSubjects(nextSubjects);
      setProfile(nextProfile);
      writeLocalCache(cacheKey, {
        subjects: nextSubjects,
        profile: nextProfile,
      });

      const defaultSubjectId = nextProfile?.subject_id ?? nextSubjects[0]?.id ?? '';
      setProfileForm((current) => ({
        fullName: current.fullName || nextProfile?.full_name || getDisplayName(user.email),
        subjectId: current.subjectId || defaultSubjectId,
        hourlyRate: current.hourlyRate || nextProfile?.hourly_rate || 120000,
        bio: current.bio || nextProfile?.bio || '',
        imageUrl: current.imageUrl || nextProfile?.image_url || '',
      }));
      setSlotForm((current) => ({
        ...current,
        subjectId: current.subjectId || defaultSubjectId,
        priceTotal: current.priceTotal || nextProfile?.hourly_rate || 120000,
      }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal memuat dashboard tutor.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSlots = async () => {
    if (!user) {
      return;
    }

    const cacheKey = `tutor-dashboard:${user.id}:slots:${selectedMonth}`;
    const cachedSlots = readLocalCache<TutorAvailabilitySlot[]>(cacheKey);
    if (cachedSlots) {
      setSlots(cachedSlots);
    }

    try {
      const nextSlots = await fetchMyTutorAvailability(user.id, monthRange.startIso, monthRange.endIso);
      setSlots(nextSlots);
      writeLocalCache(cacheKey, nextSlots);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal memuat jadwal tutor.');
    }
  };

  useEffect(() => {
    void loadTutorData();
  }, [user?.id]);

  useEffect(() => {
    void loadSlots();
  }, [user?.id, selectedMonth]);

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!profileForm.subjectId) {
      setNotice('Pilih mata kuliah utama tutor terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const savedProfile = await upsertMyTutorProfile({
        fullName: profileForm.fullName,
        subjectId: profileForm.subjectId,
        hourlyRate: Number(profileForm.hourlyRate),
        bio: profileForm.bio,
        imageUrl: profileForm.imageUrl,
      });
      setProfile(savedProfile);
      setNotice(savedProfile.status === 'approved' ? 'Profil tutor tersimpan.' : 'Profil tutor tersimpan dan menunggu approval admin.');
      await loadSlots();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal menyimpan profil tutor.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSlotSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!slotForm.subjectId) {
      setNotice('Pilih mata kuliah untuk slot jadwal.');
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const repeatWeeks = Math.min(Math.max(Number(slotForm.repeatWeeks) || 1, 1), 12);
      const occurrences = buildSlotOccurrences(slotForm.date, slotForm.startTime, slotForm.endTime, slotRepeatMode, repeatWeeks);
      const recurrenceGroupId = slotRepeatMode === 'weekly' && occurrences.length > 1 ? createClientId() : null;

      for (const [index, occurrence] of occurrences.entries()) {
        await createTutorAvailability({
          subjectId: slotForm.subjectId,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          priceTotal: Number(slotForm.priceTotal),
          maxParticipants: Number(slotForm.maxParticipants),
          location: slotForm.location,
          meetingUrl: slotForm.meetingUrl,
          notes: slotForm.notes,
          recurrenceGroupId,
          recurrencePattern: recurrenceGroupId ? 'weekly' : 'none',
          recurrenceIndex: recurrenceGroupId ? index : 0,
        });
      }

      setNotice(recurrenceGroupId ? `${occurrences.length} slot mingguan berhasil dibuat.` : 'Slot jadwal berhasil dibuat.');
      await loadSlots();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal membuat slot jadwal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSlot = async (slotId: string) => {
    setIsSaving(true);
    setNotice(null);
    try {
      await cancelTutorAvailability(slotId);
      setNotice('Slot jadwal dibatalkan.');
      await loadSlots();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal membatalkan slot jadwal.');
    } finally {
      setIsSaving(false);
    }
  };

  const approved = profile?.status === 'approved';

  return (
    <div className="min-h-screen bg-secondary/40 text-foreground">
      <header className="border-b border-primary/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">Tutor</p>
              <h1 className="text-2xl font-extrabold tracking-normal text-foreground">Schedule Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void loadTutorData();
                void loadSlots();
              }}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 text-primary hover:bg-secondary"
              aria-label="Refresh"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-2 rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">Signed in as {user?.email}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-normal text-foreground">Atur ketersediaan mengajar per bulan</h2>
            <p className="mt-2 max-w-3xl text-sm font-medium text-muted-foreground">
              Slot yang kamu buat akan menjadi dasar siswa membuat lobby private atau public. Slot baru tampil ke siswa setelah profil tutor disetujui admin.
            </p>
          </div>
          <div className="rounded-lg border border-primary/10 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm">
            {isLoading ? 'Memuat data...' : approved ? 'Profil Approved' : 'Menunggu Approval Admin'}
          </div>
        </section>

        {notice && <div className="mb-5 rounded-lg border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm">{notice}</div>}

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <form onSubmit={handleProfileSubmit} className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-normal text-foreground">Profil Tutor</h2>
                  <p className="text-xs font-medium text-muted-foreground">{profile?.status ?? 'Belum dibuat'}</p>
                </div>
              </div>
              <TutorTextInput label="Nama tutor" value={profileForm.fullName} onChange={(value) => setProfileForm({ ...profileForm, fullName: value })} required />
              <TutorSelect label="Mata kuliah utama" value={profileForm.subjectId} onChange={(value) => setProfileForm({ ...profileForm, subjectId: value })} required>
                <option value="">Pilih mata kuliah</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </TutorSelect>
              <TutorTextInput
                label="Harga total default"
                type="number"
                value={String(profileForm.hourlyRate)}
                onChange={(value) => setProfileForm({ ...profileForm, hourlyRate: Number(value) })}
              />
              <TutorTextInput label="Foto URL" value={profileForm.imageUrl} onChange={(value) => setProfileForm({ ...profileForm, imageUrl: value })} />
              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-semibold text-foreground">Bio singkat</span>
                <textarea
                  value={profileForm.bio}
                  onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <button
                type="submit"
                disabled={isSaving}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
              >
                <Save className="h-4 w-4" />
                Simpan Profil
              </button>
            </form>

            <form onSubmit={handleSlotSubmit} className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-normal text-foreground">Tambah Slot</h2>
                  <p className="text-xs font-medium text-muted-foreground">Bisa dibuat sekali atau diulang mingguan</p>
                </div>
              </div>

              <TutorSelect label="Mata kuliah" value={slotForm.subjectId} onChange={(value) => setSlotForm({ ...slotForm, subjectId: value })} required>
                <option value="">Pilih mata kuliah</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </TutorSelect>
              <TutorTextInput label="Tanggal mulai" type="date" value={slotForm.date} onChange={(value) => setSlotForm({ ...slotForm, date: value })} required />
              <div className="grid grid-cols-2 gap-3">
                <TutorTextInput label="Mulai" type="time" value={slotForm.startTime} onChange={(value) => setSlotForm({ ...slotForm, startTime: value })} required />
                <TutorTextInput label="Selesai" type="time" value={slotForm.endTime} onChange={(value) => setSlotForm({ ...slotForm, endTime: value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TutorTextInput label="Harga total" type="number" value={String(slotForm.priceTotal)} onChange={(value) => setSlotForm({ ...slotForm, priceTotal: Number(value) })} />
                <TutorTextInput label="Maks siswa" type="number" value={String(slotForm.maxParticipants)} onChange={(value) => setSlotForm({ ...slotForm, maxParticipants: Number(value) })} />
              </div>
              <TutorTextInput label="Lokasi" value={slotForm.location} onChange={(value) => setSlotForm({ ...slotForm, location: value })} />
              <TutorTextInput label="Link meeting" value={slotForm.meetingUrl} onChange={(value) => setSlotForm({ ...slotForm, meetingUrl: value })} />
              <label className="mb-4 block">
                <span className="mb-1 block text-sm font-semibold text-foreground">Catatan</span>
                <textarea
                  value={slotForm.notes}
                  onChange={(event) => setSlotForm({ ...slotForm, notes: event.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <TutorSelect
                  label="Pola jadwal"
                  value={slotRepeatMode}
                  onChange={(value) => setSlotForm({ ...slotForm, repeatMode: value === 'weekly' ? 'weekly' : 'once' })}
                >
                  <option value="once">Sekali saja</option>
                  <option value="weekly">Ulang mingguan</option>
                </TutorSelect>
                {slotRepeatMode === 'weekly' && (
                  <TutorTextInput
                    label="Jumlah minggu"
                    type="number"
                    value={String(slotForm.repeatWeeks ?? 4)}
                    onChange={(value) => setSlotForm({ ...slotForm, repeatWeeks: Number(value) })}
                  />
                )}
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
              >
                <CalendarDays className="h-4 w-4" />
                Tambah Slot
              </button>
            </form>
          </div>

          <section>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold tracking-normal text-foreground">Jadwal Bulanan</h2>
                <p className="text-sm font-medium text-muted-foreground">{slots.length} slot pada bulan ini</p>
              </div>
              <label className="block">
                <span className="sr-only">Bulan jadwal</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="h-10 rounded-lg border border-primary/20 bg-white px-3 text-sm font-semibold text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {!isLoading && slots.length === 0 && (
                <div className="rounded-xl border border-primary/10 bg-white p-6 text-sm font-medium text-muted-foreground shadow-md lg:col-span-2">
                  Belum ada slot pada bulan ini.
                </div>
              )}
              {slots.map((slot) => (
                <article key={slot.id} className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <span className="mb-2 inline-flex rounded-md border border-primary/20 bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
                        {slotStatusLabels[slot.status]}
                      </span>
                      {slot.recurrence_pattern === 'weekly' && (
                        <span className="mb-2 ml-2 inline-flex rounded-md border border-primary/10 bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          Mingguan #{slot.recurrence_index + 1}
                        </span>
                      )}
                      <h3 className="text-lg font-extrabold text-foreground">{slot.subject_name}</h3>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">{slot.location}</p>
                    </div>
                    <p className="text-right text-sm font-extrabold text-primary">{formatCurrency(slot.price_total)}</p>
                  </div>
                  <div className="mb-4 space-y-2 text-sm font-medium text-foreground">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {formatDate(slot.starts_at)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-primary" />
                      {formatTimeRange(slot.starts_at, slot.ends_at)}
                    </p>
                    <p className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-primary" />
                      Maksimal {slot.max_participants} siswa
                    </p>
                  </div>
                  {slot.notes && <p className="mb-4 rounded-lg bg-secondary p-3 text-sm font-medium text-muted-foreground">{slot.notes}</p>}
                  <button
                    type="button"
                    disabled={isSaving || slot.status !== 'available'}
                    onClick={() => void handleCancelSlot(slot.id)}
                    className="flex h-10 items-center gap-2 rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary hover:bg-secondary disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                    Batalkan Slot
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function buildSlotOccurrences(date: string, startTime: string, endTime: string, repeatMode: 'once' | 'weekly', repeatWeeks: number) {
  const occurrences: Array<{ startsAt: string; endsAt: string }> = [];
  const initialStart = new Date(`${date}T${startTime}`);
  const initialEnd = new Date(`${date}T${endTime}`);

  if (initialEnd <= initialStart) {
    throw new Error('Jam selesai harus setelah jam mulai.');
  }

  let cursorStart = initialStart;
  let cursorEnd = initialEnd;
  const occurrenceCount = repeatMode === 'weekly' ? Math.min(Math.max(repeatWeeks, 1), 12) : 1;

  for (let index = 0; index < occurrenceCount; index += 1) {
    occurrences.push({
      startsAt: cursorStart.toISOString(),
      endsAt: cursorEnd.toISOString(),
    });

    cursorStart = new Date(cursorStart);
    cursorEnd = new Date(cursorEnd);
    cursorStart.setDate(cursorStart.getDate() + 7);
    cursorEnd.setDate(cursorEnd.getDate() + 7);
  }

  return occurrences;
}

function createClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function TutorTextInput({
  label,
  onChange,
  required,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-semibold text-foreground">{label}</span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function TutorSelect({
  children,
  label,
  onChange,
  required,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-semibold text-foreground">{label}</span>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {children}
      </select>
    </label>
  );
}
