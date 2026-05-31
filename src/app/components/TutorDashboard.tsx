import { ArrowUpRight, BookOpen, CalendarDays, ChevronDown, Home, LogOut, RefreshCcw, Save, Settings, Trash2, UserRound, X } from 'lucide-react';
import logoUrl from '../../img/FYP_no_bg.png';
import { FormEvent, useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { SlotCard, StudentListModal } from './ui/tutor-dashboard/SlotCard';
import { NoticeModal, type NoticeModalState } from './ui/NoticeModal';
import {
  TutorAvailabilitySlot,
  TutorSelfProfile,
  cancelTutorAvailability,
  createTutorAvailability,
  fetchMyTutorAvailability,
  fetchMyTutorProfile,
} from '../../lib/matchmakingData';
import { updateProfileDetails } from '../../lib/dashboardData';
import { supabase } from '../../lib/supabase';

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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  return fallback;
}

type TutorView = 'dashboard' | 'profile' | 'slots' | 'schedule' | 'settings';

const navigation = [
  { label: 'Dashboard', icon: Home, view: 'dashboard' },
  { label: 'Slot Jadwal', icon: BookOpen, view: 'slots' },
  { label: 'Jadwal Bulanan', icon: CalendarDays, view: 'schedule' },
  { label: 'Profil', icon: UserRound, view: 'profile' },
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
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeModalState | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const showNotice = (tone: NoticeModalState['tone'], message: string) => {
    setNotice({ tone, message });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadTutorData(), loadSlots()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const monthRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const slotRepeatMode = slotForm.repeatMode === 'weekly' || Boolean((slotForm as typeof emptySlotForm & { repeatWeekly?: boolean }).repeatWeekly) ? 'weekly' : 'once';
  const effectiveProfileSubjectId = profileForm.subjectId || profile?.subject_id || subjects[0]?.id || '';
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
      showNotice('error', error instanceof Error ? error.message : 'Gagal memuat dashboard tutor.');
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
      showNotice('error', error instanceof Error ? error.message : 'Gagal memuat jadwal tutor.');
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

    const tutorUserId = user?.id;

    if (!profileForm.fullName.trim()) {
      showNotice('error', 'Nama lengkap tutor wajib diisi.');
      return;
    }

    if (!tutorUserId) {
      showNotice('error', 'Sesi login tutor tidak ditemukan.');
      return;
    }

    if (!effectiveProfileSubjectId) {
      showNotice('error', 'Pilih mata kuliah utama tutor terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const trimmedName = profileForm.fullName.trim();
      await Promise.all([
        updateProfileDetails(tutorUserId, {
          full_name: trimmedName,
        }),
        supabase
          .from('tutor_profiles')
          .upsert({
            user_id: tutorUserId,
            full_name: trimmedName,
            subject_id: effectiveProfileSubjectId,
            hourly_rate: Number(profileForm.hourlyRate),
            bio: profileForm.bio || null,
            image_url: profileForm.imageUrl || null,
          }, { onConflict: 'user_id' }),
      ]);

      const activeProfile = await fetchMyTutorProfile(tutorUserId);
      if (!activeProfile) {
        throw new Error('Profil tutor tidak ditemukan setelah disimpan.');
      }

      setProfile(activeProfile);
      setProfileForm({
        fullName: activeProfile.full_name ?? trimmedName,
        subjectId: activeProfile.subject_id ?? effectiveProfileSubjectId,
        hourlyRate: activeProfile.hourly_rate ?? profileForm.hourlyRate,
        bio: activeProfile.bio ?? profileForm.bio,
        imageUrl: activeProfile.image_url ?? profileForm.imageUrl,
      });
      showNotice('success', activeProfile.status === 'approved' ? 'Profil tutor tersimpan.' : 'Profil tutor tersimpan dan menunggu approval admin.');
      await loadSlots();
    } catch (error) {
      showNotice('error', getErrorMessage(error, 'Gagal menyimpan profil tutor.'));
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

      setProfileForm(prev => ({ ...prev, imageUrl: newAvatarUrl }));
      await supabase
        .from('tutor_profiles')
        .update({ image_url: newAvatarUrl })
        .eq('user_id', user.id);

      const refreshedProfile = await fetchMyTutorProfile(user.id);
      if (refreshedProfile) {
        setProfile(refreshedProfile);
      }
      showNotice('success', 'Foto profil tutor berhasil diperbarui.');
      await supabase.auth.updateUser({
        data: { custom_avatar_url: newAvatarUrl, avatar_url: newAvatarUrl },
      });
    } catch (error) {
      showNotice('error', getErrorMessage(error, 'Gagal mengupload foto profil.'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSlotSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!slotForm.subjectId) {
      showNotice('error', 'Pilih mata kuliah untuk slot jadwal.');
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

      showNotice('success', recurrenceGroupId ? `${occurrences.length} slot mingguan berhasil dibuat.` : 'Slot jadwal berhasil dibuat.');
      await loadSlots();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal membuat slot jadwal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSlot = async (slotId: string) => {
    setIsSaving(true);
    setNotice(null);
    try {
      await cancelTutorAvailability(slotId);
      showNotice('success', 'Slot jadwal dibatalkan.');
      await loadSlots();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal membatalkan slot jadwal.');
    } finally {
      setIsSaving(false);
    }
  };

  const isEmailUser = user?.app_metadata?.providers?.includes('email') ?? false;

  const handleUpdatePassword = async (event: FormEvent) => {
    event.preventDefault();

    if (!user?.email) {
      showNotice('error', 'Gagal memverifikasi akun Anda.');
      return;
    }

    if (!currentPassword) {
      showNotice('error', 'Silakan masukkan password saat ini.');
      return;
    }

    if (newPassword.length < 6) {
      showNotice('error', 'Password baru minimal 6 karakter.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        throw new Error('Password saat ini salah.');
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      showNotice('success', 'Password berhasil diperbarui.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      showNotice('error', getErrorMessage(error, 'Gagal memperbarui password.'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };



  return (
    <div className="min-h-screen bg-secondary/40 text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <aside className="border-b border-primary/10 bg-white px-4 py-5 shadow-sm lg:border-b-0 lg:border-r">
          <div className="mb-7 flex items-center justify-between lg:block">
            <div className="flex h-14 items-center justify-start gap-2.5 rounded-lg bg-primary px-3.5 shadow-sm">
              <img src={logoUrl} alt="Logo" className="h-9 w-9 object-contain shrink-0" />
              <div className="flex flex-col text-left font-extrabold leading-none gap-0.5">
                <span className="text-white text-base">FYP</span>
                <span className="text-accent text-[11px] uppercase tracking-wider">Foundation</span>
              </div>
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
                  className={`flex min-w-max items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition lg:w-full ${activeView === item.view ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-primary'
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
                onClick={() => void handleRefresh()}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-white text-primary shadow-sm hover:bg-secondary"
                aria-label="Refresh"
              >
                <RefreshCcw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              <div className="relative flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                  className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/70 active:scale-95 focus:outline-none transition-all duration-200"
                >
                  {displayName}
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isHeaderDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="h-11 w-11 cursor-pointer rounded-full border border-primary/20 bg-white object-cover hover:border-primary/50 hover:scale-105 active:scale-95 transition-all duration-200"
                    onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 hover:scale-105 active:scale-95 transition-all duration-200"
                    onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                  >
                    <UserRound className="h-7 w-7 text-primary" />
                  </div>
                )}

                {isHeaderDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsHeaderDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-primary/10 bg-white p-2 shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveView('profile');
                          setIsHeaderDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-primary transition"
                      >
                        <UserRound className="h-4 w-4" />
                        Profil
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveView('settings');
                          setIsHeaderDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-primary transition"
                      >
                        <Settings className="h-4 w-4" />
                        Pengaturan
                      </button>
                      <hr className="my-1 border-primary/10" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderDropdownOpen(false);
                          void signOut();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                      >
                        <LogOut className="h-4 w-4" />
                        Keluar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {notice && <NoticeModal notice={notice} onClose={() => setNotice(null)} />}

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
                userEmail={user?.email}
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
              <section className="space-y-6">
                <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-md">
                  <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Ganti Password</h1>
                  {!isEmailUser ? (
                    <div className="rounded-lg border border-primary/10 bg-secondary/50 p-4 text-sm">
                      <p className="mb-1 font-semibold text-primary">Akun Pihak Ketiga</p>
                      <p className="text-muted-foreground">
                        Akun kamu terhubung menggunakan penyedia layanan pihak ketiga (seperti Google). Kata sandi kamu diatur melalui layanan tersebut.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="mb-5 text-sm font-medium text-muted-foreground">
                        Perbarui kata sandi akun kamu di sini. Pastikan kata sandi aman.
                      </p>
                      <form onSubmit={handleUpdatePassword} className="max-w-md grid gap-4">
                        <label className="block">
                          <span className="text-sm font-semibold text-foreground">Password Saat Ini</span>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            placeholder="Masukkan password saat ini"
                            className="mt-2 h-11 w-full rounded-lg border border-primary/20 bg-white px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-foreground/30"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm font-semibold text-foreground">Password Baru</span>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="Masukkan password baru"
                            className="mt-2 h-11 w-full rounded-lg border border-primary/20 bg-white px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-foreground/30"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={isUpdatingPassword || !newPassword || !currentPassword}
                          className="h-11 rounded-lg bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                        >
                          {isUpdatingPassword ? 'Menyimpan...' : 'Simpan Password'}
                        </button>
                      </form>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-md">
                  <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-red-900 lg:text-3xl">Sesi Akun</h1>
                  <p className="mb-5 text-sm font-medium text-red-700/80">
                    Keluar dari akun kamu pada perangkat ini. Kamu harus login kembali untuk mengakses dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex h-11 w-fit items-center gap-2 rounded-lg bg-red-600 px-6 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
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
        className="h-10 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-foreground/30 focus:border-primary focus:ring-2 focus:ring-primary/20"
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
        className={`h-10 w-full rounded-lg border border-primary/20 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${value ? 'text-foreground' : 'text-foreground/30'}`}
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
  const [studentModalSlot, setStudentModalSlot] = useState<TutorAvailabilitySlot | null>(null);

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

          <div className="space-y-4">
            {isLoading && <div className="p-6 text-sm font-medium text-muted-foreground">Memuat slot tutor...</div>}
            {!isLoading && upcomingSlots.length === 0 && <div className="p-6 text-sm font-medium text-muted-foreground">Belum ada slot aktif untuk ditampilkan.</div>}
            {upcomingSlots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} onViewStudents={setStudentModalSlot} />
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

      {studentModalSlot && (
        <StudentListModal slot={studentModalSlot} onClose={() => setStudentModalSlot(null)} />
      )}
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
  userEmail,
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
  userEmail?: string | null;
}) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayUrl = avatarFile ? URL.createObjectURL(avatarFile) : avatarUrl;

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    : '-';

  return (
    <section className="w-full">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Informasi Profil */}
        <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-md">
          <h2 className="mb-6 text-xl font-bold text-foreground">Informasi Profil</h2>

          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row">
            <div
              className="group relative h-20 w-20 cursor-pointer overflow-hidden rounded-full border-2 border-primary/20 bg-secondary"
              onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
            >
              {displayUrl ? (
                <img src={displayUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-secondary text-primary">
                  <UserRound className="h-10 w-10" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-[10px] font-bold text-white uppercase text-center leading-tight">
                  {isUploadingAvatar ? 'Mengunggah...' : 'Ubah Foto'}
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
                  const file = e.target.files[0];
                  setAvatarFile(file);
                  void onAvatarSelect(file);
                }
              }}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">Foto Profil</p>
              <p className="text-xs text-muted-foreground mt-1">
                Rekomendasi ukuran 1:1, maksimal 2MB.
              </p>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-5"
          >
            <div>
              <label className="block text-sm font-semibold text-foreground">Nama lengkap</label>
              <input
                type="text"
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                placeholder="Masukkan Nama Profil yang Baru"
                className="mt-2 h-11 w-full rounded-lg border border-primary/20 bg-white px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-foreground/30"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground">Mata Kuliah yang Diajar</label>
              <select
                value={profileForm.subjectId}
                onChange={(e) => setProfileForm({ ...profileForm, subjectId: e.target.value })}
                className={`mt-2 h-11 w-full rounded-lg border border-primary/20 bg-white px-4 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${profileForm.subjectId ? 'text-foreground' : 'text-foreground/30'}`}
              >
                <option value="" disabled>
                  Pilih mata kuliah
                </option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>


            <div>
              <label className="block text-sm font-semibold text-foreground">Bio singkat</label>
              <textarea
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                rows={4}
                placeholder="Ceritakan singkat tentang dirimu..."
                className="mt-2 w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-medium text-foreground outline-none transition placeholder:text-foreground/30 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving || !profileForm.fullName.trim()}
              className="h-11 w-full rounded-lg bg-black text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>

        {/* Right Column - Akun */}
        <div className="space-y-6">
          <div className="rounded-xl bg-primary p-6 shadow-md">
            <h2 className="mb-6 text-xl font-bold text-accent">Informasi Akun</h2>

            <div className="space-y-5">
              <div>
                <p className="text-xs text-white/70">Email</p>
                <p className="mt-0.5 text-sm font-medium text-white">{userEmail || '-'}</p>
              </div>

              <div>
                <p className="text-xs text-white/70">Bergabung Sejak</p>
                <p className="mt-0.5 text-sm font-medium text-white">{joinedDate}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
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
  const [confirmCancelSlot, setConfirmCancelSlot] = useState<TutorAvailabilitySlot | null>(null);
  const [studentModalSlot, setStudentModalSlot] = useState<TutorAvailabilitySlot | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const visibleSlots = useMemo(
    () => slots.filter((s) => s.status !== 'cancelled'),
    [slots],
  );

  const handleOpenCancel = useCallback((slot: TutorAvailabilitySlot) => {
    setConfirmCancelSlot(slot);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!confirmCancelSlot) return;
    const slotId = confirmCancelSlot.id;
    setConfirmCancelSlot(null);
    await onCancelSlot(slotId);
  }, [confirmCancelSlot, onCancelSlot]);

  const handleOpenForm = () => {
    setIsFormModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
  };

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Kelola ketersediaan mengajar</h1>
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
            Buat slot sekali atau mingguan, lalu pantau daftar slot aktif pada bulan yang dipilih.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenForm}
            className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 transition"
          >
            <CalendarDays className="h-4 w-4" />
            Tambah Slot
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-normal text-foreground">Jadwal Bulanan</h2>
          <p className="text-sm font-medium text-muted-foreground">{visibleSlots.length} slot pada bulan ini</p>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!isLoading && visibleSlots.length === 0 && (
          <div className="rounded-xl border border-primary/10 bg-white p-6 text-sm font-medium text-muted-foreground shadow-md md:col-span-2 xl:col-span-3">
            Belum ada slot pada bulan ini.
          </div>
        )}
        {visibleSlots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            onViewStudents={setStudentModalSlot}
            onCancel={handleOpenCancel}
            showCancel={slot.status === 'available'}
          />
        ))}
      </div>

      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-primary/10 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-foreground">Tambah Slot</h2>
                  <p className="text-xs font-medium text-muted-foreground">Bisa dibuat sekali atau diulang mingguan</p>
                </div>
              </div>
              <button type="button" onClick={handleCloseForm} className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(e) => { onSubmit(e); handleCloseForm(); }}>
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
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={handleCloseForm} className="h-10 rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary hover:bg-secondary transition">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
                >
                  <CalendarDays className="h-4 w-4" />
                  Tambah Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmCancelSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-primary/10 bg-white p-5 shadow-xl">
            <h2 className="mb-2 text-lg font-extrabold text-foreground">Batalkan Slot?</h2>
            <p className="mb-5 text-sm font-medium text-muted-foreground">
              Slot <span className="font-semibold text-foreground">{confirmCancelSlot.subject_name}</span> pada{' '}
              <span className="font-semibold text-foreground">{formatDate(confirmCancelSlot.starts_at)}</span>{' '}
              ({formatTimeRange(confirmCancelSlot.starts_at, confirmCancelSlot.ends_at)}) akan dibatalkan.
              Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmCancelSlot(null)}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary transition"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCancel()}
                disabled={isSaving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:cursor-not-allowed disabled:bg-red-300"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {studentModalSlot && (
        <StudentListModal slot={studentModalSlot} onClose={() => setStudentModalSlot(null)} />
      )}
    </section>
  );
}
