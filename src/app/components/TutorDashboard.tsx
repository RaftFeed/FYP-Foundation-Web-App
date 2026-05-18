import { ArrowUpRight, BookOpen, CalendarDays, ChevronDown, Clock3, Home, LogOut, RefreshCcw, Save, Settings, Trash2, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);
import { useAuth } from '../context/AuthContext';
import { readLocalCache, usePersistentState, writeLocalCache } from '../../lib/browserState';
import { Subject, fetchSubjects, formatCurrency, formatDate, formatTimeRange } from '../../lib/dashboardData';
import { TutorScheduleView } from './ui/student-dashboard/TutorScheduleView';
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

type TutorView = 'dashboard' | 'profile' | 'slots' | 'schedule' | 'settings';

const navigation = [
  { label: 'Dashboard', icon: Home, view: 'dashboard' },
  { label: 'Profil', icon: UserRound, view: 'profile' },
  { label: 'Slot Jadwal', icon: BookOpen, view: 'slots' },
  { label: 'Jadwal Bulanan', icon: CalendarDays, view: 'schedule' },
  { label: 'Pengaturan', icon: Settings, view: 'settings' },
] satisfies Array<{ label: string; icon: typeof Home; view: TutorView }>;

export function TutorDashboard() {
  const { user, signOut } = useAuth();
  const stateKeyPrefix = user ? `tutor-dashboard:${user.id}` : null;
  const [activeView, setActiveView] = usePersistentState<TutorView>(stateKeyPrefix ? `${stateKeyPrefix}:active-view` : null, 'dashboard');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [profile, setProfile] = useState<TutorSelfProfile | null>(null);
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [profileForm, setProfileForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:profile-form` : null, emptyProfileForm);
  const [slotForm, setSlotForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:slot-form` : null, emptySlotForm);
  const [selectedMonth, setSelectedMonth] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:selected-month` : null, monthValue(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const monthRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const slotRepeatMode = slotForm.repeatMode === 'weekly' || Boolean((slotForm as typeof emptySlotForm & { repeatWeekly?: boolean }).repeatWeekly) ? 'weekly' : 'once';
  const displayName = profile?.full_name?.trim() ? profile.full_name : getDisplayName(user?.email);
  const avatarUrl = user?.user_metadata?.custom_avatar_url || profile?.image_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const approved = profile?.status === 'approved';
  const currentSlots = slots.filter((slot) => slot.status !== 'cancelled');
  const availableSlots = slots.filter((slot) => slot.status === 'available');
  const bookedSlots = slots.filter((slot) => slot.status === 'booked');
  const heldSlots = slots.filter((slot) => slot.status === 'held');
  const monthlyRevenue = currentSlots.reduce((sum, slot) => sum + slot.price_total, 0);

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

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setIsUploadingAvatar(true);
    setNotice(null);
    try {
      const { uploadAvatar } = await import('../../lib/storage');
      const newAvatarUrl = await uploadAvatar(file, user.id);
      
      const savedProfile = await upsertMyTutorProfile({
        fullName: profileForm.fullName,
        subjectId: profileForm.subjectId,
        hourlyRate: Number(profileForm.hourlyRate),
        bio: profileForm.bio,
        imageUrl: newAvatarUrl,
      });
      setProfile(savedProfile);
      setProfileForm(prev => ({ ...prev, imageUrl: newAvatarUrl }));
      setNotice('Foto profil tutor berhasil diperbarui.');
      
      const { supabase } = await import('../../lib/supabase');
      await supabase.auth.updateUser({
        data: { custom_avatar_url: newAvatarUrl, avatar_url: newAvatarUrl },
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal mengupload foto profil.');
    } finally {
      setIsUploadingAvatar(false);
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



  return (
    <div className="min-h-screen bg-secondary/40 text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <aside className="border-b border-primary/10 bg-white px-4 py-5 shadow-sm lg:border-b-0 lg:border-r">
          <div className="mb-7 flex items-center justify-between lg:block">
            <div className="flex h-12 w-32 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-white shadow-sm">
              FYP<span className="text-accent">&nbsp;Foundation</span>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 text-primary hover:bg-secondary lg:hidden"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveView(item.view)}
                  className={`flex min-w-max items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition lg:w-full ${
                    activeView === item.view ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-primary'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="px-3 py-5 lg:px-5 lg:py-6">
          <header className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold uppercase tracking-[0.22em] text-primary">
              {navigation.find((item) => item.view === activeView)?.label ?? 'Tutor'}
            </h1>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  void loadTutorData();
                  void loadSlots();
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-white text-primary shadow-sm hover:bg-secondary"
                aria-label="Refresh"
              >
                <RefreshCcw className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-11 w-11 rounded-full object-cover border border-primary/20 bg-white" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-7 w-7 text-primary" />
                  </div>
                )}
                <button type="button" className="flex items-center gap-2 text-sm font-semibold text-primary">
                  {displayName}
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="hidden h-9 items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 text-xs font-semibold text-primary hover:bg-secondary lg:flex"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          {notice && <div className="mb-5 rounded-xl border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm">{notice}</div>}

          <div className="space-y-6">
            {activeView === 'dashboard' && (
              <DashboardView
                approved={approved}
                displayName={displayName}
                isLoading={isLoading}
                monthlyRevenue={monthlyRevenue}
                netRevenue={monthlyRevenue * 0.8}
                availableSlots={availableSlots.length}
                bookedSlots={bookedSlots.length}
                heldSlots={heldSlots.length}
                totalSlots={currentSlots.length}
                setActiveView={setActiveView}
                slots={slots}
              />
            )}

            {activeView === 'profile' && (
              <ProfileView
                approved={approved}
                isSaving={isSaving}
                profile={profile}
                profileForm={profileForm}
                subjects={subjects}
                onSubmit={handleProfileSubmit}
                onAvatarSelect={handleAvatarUpload}
                setProfileForm={setProfileForm}
                isUploadingAvatar={isUploadingAvatar}
                avatarUrl={avatarUrl}
              />
            )}

            {activeView === 'slots' && (
              <SlotManagementView
                isLoading={isLoading}
                isSaving={isSaving}
                onSubmit={handleSlotSubmit}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                slotForm={slotForm}
                slotRepeatMode={slotRepeatMode}
                slots={slots}
                subjects={subjects}
                onCancelSlot={handleCancelSlot}
                setSlotForm={setSlotForm}
              />
            )}

            {activeView === 'schedule' && <TutorScheduleView slots={slots} />}

            {activeView === 'settings' && (
              <section className="rounded-2xl border border-primary/10 bg-white p-6 shadow-md">
                <h1 className="text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Preferensi akun tutor</h1>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
                  Area ini disiapkan untuk pengaturan tambahan. Saat ini fokus utama ada pada profil, slot jadwal, dan kalender bulanan.
                </p>
              </section>
            )}
          </div>
        </main>
      </div>
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

function DashboardView({
  approved,
  displayName,
  isLoading,
  monthlyRevenue,
  netRevenue,
  availableSlots,
  bookedSlots,
  heldSlots,
  totalSlots,
  setActiveView,
  slots,
}: {
  approved: boolean;
  displayName: string;
  isLoading: boolean;
  monthlyRevenue: number;
  netRevenue: number;
  availableSlots: number;
  bookedSlots: number;
  heldSlots: number;
  totalSlots: number;
  setActiveView: (view: TutorView) => void;
  slots: TutorAvailabilitySlot[];
}) {
  const upcomingSlots = slots
    .filter((slot) => slot.status !== 'cancelled')
    .slice()
    .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime())
    .slice(0, 3);

  const revenueByDate = useMemo(() => {
    const data: Record<string, number> = {};
    for (const slot of slots) {
      if (slot.status !== 'cancelled') {
        const dateKey = slot.starts_at.slice(0, 10);
        data[dateKey] = (data[dateKey] || 0) + (slot.price_total * 0.8);
      }
    }
    const labels = Object.keys(data).sort();
    const values = labels.map((label) => data[label]);
    return { labels, values };
  }, [slots]);

  const chartData = {
    labels: revenueByDate.labels,
    datasets: [
      {
        label: 'Pendapatan Bersih (80%)',
        data: revenueByDate.values,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: false },
    },
  };

  const stats = [
    { label: 'Slot Aktif', value: String(totalSlots), view: 'slots' as TutorView },
    { label: 'Tersedia', value: String(availableSlots), view: 'schedule' as TutorView },
    { label: 'Terbooking', value: String(bookedSlots), view: 'schedule' as TutorView },
    { label: 'Pendapatan Bersih', value: formatCurrency(netRevenue), view: 'slots' as TutorView, wide: true },
  ];

  return (
    <section>
      <h1 className="mb-3 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Halo, {displayName}!</h1>
      <p className="mb-6 text-base font-medium text-muted-foreground">Kelola profil, slot jadwal, dan kalender mengajar dari satu tempat.</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="relative min-h-[112px] rounded-xl border border-primary/10 bg-white p-4 shadow-md transition hover:-translate-y-0.5 hover:border-primary/30">
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

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-extrabold tracking-normal text-foreground">Slot Mendatang</h2>
            <button type="button" onClick={() => setActiveView('slots')} className="text-sm font-semibold text-foreground hover:underline">
              Kelola Slot
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
            {isLoading && <div className="p-6 text-sm font-medium text-muted-foreground">Memuat slot tutor...</div>}
            {!isLoading && upcomingSlots.length === 0 && <div className="p-6 text-sm font-medium text-muted-foreground">Belum ada slot aktif untuk ditampilkan.</div>}
            {upcomingSlots.map((slot) => (
              <article key={slot.id} className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 lg:grid-cols-[92px_1fr_180px] lg:items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-primary/10 bg-secondary text-primary">
                  <CalendarDays className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="mb-1 text-base font-extrabold text-foreground">{slot.subject_name}</h3>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">{slot.location}</p>
                  <div className="flex flex-col gap-2 text-sm font-medium text-foreground sm:flex-row sm:gap-5">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {formatDate(slot.starts_at)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-primary" />
                      {formatTimeRange(slot.starts_at, slot.ends_at)}
                    </p>
                  </div>
                </div>
                <div className="lg:text-right">
                  <p className="mb-2 inline-flex rounded-lg border border-primary/20 bg-secondary px-3 py-1 text-xs font-semibold text-primary">{slotStatusLabels[slot.status]}</p>
                  <p className="text-base font-semibold text-primary">{formatCurrency(slot.price_total)}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-primary/10 bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-extrabold tracking-normal text-foreground">Grafik Pendapatan Bersih</h2>
            {revenueByDate.labels.length > 0 ? (
              <div className="h-[300px] w-full">
                <Line options={chartOptions} data={chartData} />
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm font-medium text-muted-foreground">
                Belum ada data pendapatan.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-primary/10 bg-white p-5 shadow-md self-start">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-normal text-foreground">Status Akun</h2>
              <p className="text-xs font-medium text-muted-foreground">Ringkasan profil tutor</p>
            </div>
          </div>

          <div className="space-y-3 text-sm font-medium text-foreground">
            <div className="rounded-lg bg-secondary/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Approval</p>
              <p className="mt-1 font-semibold">{approved ? 'Profil disetujui admin' : 'Menunggu approval admin'}</p>
            </div>
            <div className="rounded-lg bg-secondary/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Slot tersedia</p>
              <p className="mt-1 font-semibold">{availableSlots} slot aktif</p>
            </div>
            <div className="rounded-lg bg-secondary/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Slot di-hold</p>
              <p className="mt-1 font-semibold">{heldSlots} slot menunggu lobby</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function ProfileView({
  approved,
  isSaving,
  profile,
  profileForm,
  subjects,
  onSubmit,
  setProfileForm,
  avatarUrl,
  onAvatarSelect,
  isUploadingAvatar,
}: {
  approved: boolean;
  isSaving: boolean;
  profile: TutorSelfProfile | null;
  profileForm: typeof emptyProfileForm;
  subjects: Subject[];
  onSubmit: (event: FormEvent) => void;
  onAvatarSelect: (file: File) => void;
  setProfileForm: React.Dispatch<React.SetStateAction<typeof emptyProfileForm>>;
  isUploadingAvatar?: boolean;
  avatarUrl?: string | null;
}) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayUrl = avatarFile ? URL.createObjectURL(avatarFile) : avatarUrl;

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-primary/10 bg-white p-6 shadow-md">
      <div className="mb-5 flex items-center gap-4">
        <div 
          className="group relative h-16 w-16 cursor-pointer overflow-hidden rounded-full border border-primary/20"
          onClick={() => fileInputRef.current?.click()}
        >
          {displayUrl ? (
            <img src={displayUrl} alt="Profile" className="h-full w-full object-cover bg-white" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary text-primary">
              <UserRound className="h-9 w-9" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-[10px] font-bold text-white uppercase text-center">
              {isUploadingAvatar ? 'Menyimpan...' : (
                <>Ubah<br/>Foto</>
              )}
            </span>
          </div>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          disabled={isUploadingAvatar}
          onChange={(e) => {
            if (e.target.files?.[0]) {
              setAvatarFile(e.target.files[0]);
              onAvatarSelect(e.target.files[0]);
            }
          }}
        />
        <div>
          <h1 className="text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Atur identitas tutor</h1>
          <p className="text-xs font-medium text-muted-foreground">{profile?.status ?? 'Belum dibuat'} · {approved ? 'approved' : 'pending'}</p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <TutorTextInput label="Nama tutor" value={profileForm.fullName} onChange={(value) => setProfileForm({ ...profileForm, fullName: value })} required />
        <TutorSelect label="Mata kuliah utama" value={profileForm.subjectId} onChange={(value) => setProfileForm({ ...profileForm, subjectId: value })} required>
          <option value="">Pilih mata kuliah</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </TutorSelect>
        <TutorTextInput
          label="Harga total default"
          type="number"
          value={String(profileForm.hourlyRate)}
          onChange={(value) => setProfileForm({ ...profileForm, hourlyRate: Number(value) })}
        />
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold text-foreground">Bio singkat</span>
          <textarea
            value={profileForm.bio}
            onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })}
            rows={4}
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
    </section>
  );
}

function SlotManagementView({
  isLoading,
  isSaving,
  onCancelSlot,
  onSubmit,
  selectedMonth,
  setSelectedMonth,
  slotForm,
  slotRepeatMode,
  slots,
  subjects,
  setSlotForm,
}: {
  isLoading: boolean;
  isSaving: boolean;
  onCancelSlot: (slotId: string) => void;
  onSubmit: (event: FormEvent) => void;
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
  slotForm: typeof emptySlotForm;
  slotRepeatMode: 'once' | 'weekly';
  slots: TutorAvailabilitySlot[];
  subjects: Subject[];
  setSlotForm: React.Dispatch<React.SetStateAction<typeof emptySlotForm>>;
}) {
  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Kelola ketersediaan mengajar</h1>
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
            Buat slot sekali atau mingguan, lalu pantau daftar slot aktif pada bulan yang dipilih.
          </p>
        </div>
        <div className="rounded-lg border border-primary/10 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm">
          {isLoading ? 'Memuat data...' : `${slots.length} slot pada bulan ini`}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <form onSubmit={onSubmit} className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
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
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
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
                  onClick={() => void onCancelSlot(slot.id)}
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
    </section>
  );
}
