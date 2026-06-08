import { ArrowUpRight, Bell, BookOpen, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, CircleCheck, Clock3, Home, LogOut, MapPin, NotebookTabs, RefreshCcw, Search, Settings, SquarePen, UserRound, Users } from 'lucide-react';
import logoUrl from '../../img/FYP_no_bg.png';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MatchmakingLobbyView } from './MatchmakingLobbyView';
import { NoticeModal, type NoticeModalState } from './ui/NoticeModal';
import { readLocalCache, usePersistentState, writeLocalCache } from '../../lib/browserState';
import { DashboardView } from './ui/student-dashboard/DashboardView';
import { CoursesView } from './ui/student-dashboard/CoursesView';
import { BookingsView } from './ui/student-dashboard/BookingsView';
import { TutorScheduleView } from './ui/student-dashboard/TutorScheduleView';
import { ProfileView } from './ui/ProfileView';
import { SettingsView } from './ui/SettingsView';
import {
  fetchProfileById,
  fetchSubjectMatchmakingSummaries,
  formatCurrency,
  formatDate,
  formatTimeRange,
  SubjectMatchmakingSummary,
  type Profile,
} from '../../lib/dashboardData';
import {
  MatchmakingLobby,
  MatchmakingLobbyStatus,
  TutorAvailabilitySlot,
  fetchAvailableTutorSlots,
  fetchMatchmakingLobbies,
  fetchStudentTutorScheduleSlots,
  leaveMatchmakingLobby,
} from '../../lib/matchmakingData';

export type StudentView = 'dashboard' | 'courses' | 'lobbies' | 'bookings' | 'schedule' | 'profile' | 'settings';
type BookingTab = 'Semua' | 'Mendatang' | 'Selesai' | 'Dibatalkan' | 'Menunggu Pembayaran';

const navigation = [
  { label: 'Dashboard', icon: Home, view: 'dashboard' },
  { label: 'Mata Kuliah', icon: BookOpen, view: 'courses' },
  { label: 'Lobby Grup', icon: Users, view: 'lobbies' },
  { label: 'Booking Saya', icon: SquarePen, view: 'bookings' },
  { label: 'Jadwal Tutor', icon: CalendarDays, view: 'schedule' },
  { label: 'Profil', icon: UserRound, view: 'profile' },
  { label: 'Pengaturan', icon: Settings, view: 'settings' },
] satisfies Array<{ label: string; icon: typeof Home; view: StudentView }>;

const lobbyStatusesByTab: Record<Exclude<BookingTab, 'Semua'>, MatchmakingLobbyStatus[]> = {
  Mendatang: ['open', 'paid'],
  Selesai: ['completed'],
  Dibatalkan: ['cancelled'],
  'Menunggu Pembayaran': ['pending_payment'],
};

function getDisplayName(email?: string) {
  if (!email) {
    return 'Student';
  }

  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function StudentDashboard() {
  const { user, signOut } = useAuth();
  const stateKeyPrefix = user ? `student-dashboard:${user.id}` : null;
  const [activeView, setActiveView] = usePersistentState<StudentView>(stateKeyPrefix ? `${stateKeyPrefix}:active-view` : null, 'dashboard');
  const [query, setQuery] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:course-query` : null, '');
  const [profileForm, setProfileForm] = useState({
    fullName: '',
  });
  const [availableTutorSlots, setAvailableTutorSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [scheduleTutorSlots, setScheduleTutorSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [subjects, setSubjects] = useState<SubjectMatchmakingSummary[]>([]);
  const [joinedLobbies, setJoinedLobbies] = useState<MatchmakingLobby[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeModalState | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const previousActiveView = useRef<StudentView>(activeView);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setIsRefreshing(false);
    }
  };
  const [pendingLobbySlotId, setPendingLobbySlotId] = useState<string | null>(null);
  const displayName = profile?.full_name?.trim() ? profile.full_name : getDisplayName(user?.email);
  const avatarUrl = profile?.image_url || user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const showNotice = (tone: NoticeModalState['tone'], message: string) => {
    setNotice({ tone, message });
  };

  const loadDashboard = async () => {
    if (!user) {
      return;
    }

    const cacheKey = `student-dashboard:${user.id}:data`;
    const cachedData = readLocalCache<{
      availableTutorSlots: TutorAvailabilitySlot[];
      scheduleTutorSlots: TutorAvailabilitySlot[];
      subjects: SubjectMatchmakingSummary[];
      joinedLobbies: MatchmakingLobby[];
      profile: Profile | null;
    }>(cacheKey);

    if (cachedData) {
      setAvailableTutorSlots(cachedData.availableTutorSlots);
      setScheduleTutorSlots(cachedData.scheduleTutorSlots);
      setSubjects(cachedData.subjects);
      setJoinedLobbies(cachedData.joinedLobbies);
      setProfile(cachedData.profile);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const [nextAvailableTutorSlots, nextScheduleTutorSlots, nextSubjects, nextLobbies, nextProfile] = await Promise.all([
        fetchAvailableTutorSlots(),
        fetchStudentTutorScheduleSlots(),
        fetchSubjectMatchmakingSummaries(),
        fetchMatchmakingLobbies(),
        fetchProfileById(user.id),
      ]);
      const nextJoinedLobbies = nextLobbies.filter((lobby) => lobby.current_user_is_member);
      setAvailableTutorSlots(nextAvailableTutorSlots);
      setScheduleTutorSlots(nextScheduleTutorSlots);
      setSubjects(nextSubjects);
      setJoinedLobbies(nextJoinedLobbies);
      setProfile(nextProfile);

      writeLocalCache(cacheKey, {
        availableTutorSlots: nextAvailableTutorSlots,
        scheduleTutorSlots: nextScheduleTutorSlots,
        subjects: nextSubjects,
        joinedLobbies: nextJoinedLobbies,
        profile: nextProfile,
      });
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal memuat data dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [user?.id]);

  useEffect(() => {
    if (activeView === 'profile' && previousActiveView.current !== 'profile') {
      setProfileForm({ fullName: '' });
    }

    previousActiveView.current = activeView;
  }, [activeView]);



  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setIsUploadingAvatar(true);
    setNotice(null);
    try {
      const { uploadAvatar } = await import('../../lib/storage');
      const { updateProfileDetails } = await import('../../lib/dashboardData');
      const { supabase } = await import('../../lib/supabase');

      const newAvatarUrl = await uploadAvatar(file, user.id);

      await Promise.all([
        updateProfileDetails(user.id, { image_url: newAvatarUrl }),
        supabase.auth.updateUser({
          data: { custom_avatar_url: newAvatarUrl, avatar_url: newAvatarUrl },
        }),
      ]);

      await loadDashboard();
      showNotice('success', 'Foto profil berhasil diperbarui.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal memperbarui foto profil.');
    } finally {
      setIsUploadingAvatar(false);
    }

  };

  const handleProfileSave = async () => {
    if (!user) {
      return;
    }

    const trimmedName = profileForm.fullName.trim();
    if (!trimmedName) {
      showNotice('error', 'Tidak ada perubahan yang dilakukan.');
      return;
    }

    setIsSavingName(true);
    setNotice(null);
    try {
      const { updateProfileDetails } = await import('../../lib/dashboardData');
      await updateProfileDetails(user.id, {
        full_name: trimmedName,
      });

      const nextProfile = await fetchProfileById(user.id);
      setProfile(nextProfile);
      showNotice('success', 'Profil berhasil diperbarui.');
      setProfileForm({ fullName: '' });
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal memperbarui profil.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleLeaveLobby = async (lobbyId: string) => {
    setNotice(null);
    try {
      await leaveMatchmakingLobby(lobbyId);
      showNotice('success', 'Berhasil keluar dari lobby grup.');
      await loadDashboard();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal keluar dari lobby grup.');
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
          <header className="flex items-center justify-between gap- pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-[0.22em] text-primary">
              {navigation.find((item) => item.view === activeView)?.label || 'Dashboard'}
            </h1>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-white text-primary shadow-sm hover:bg-secondary"
                aria-label="Refresh"
              >
                <RefreshCcw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-white text-primary shadow-sm hover:bg-secondary"
                aria-label="Notifications"
              >
                <Bell className="h-6 w-6" />
                {joinedLobbies.some((lobby) => lobby.status === 'pending_payment' && !lobby.current_user_has_paid) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />}
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

          {activeView === 'courses' && <CoursesView isLoading={isLoading} query={query} subjects={subjects} setQuery={setQuery} availableTutorSlots={availableTutorSlots} />}
          {activeView === 'lobbies' && (
            <MatchmakingLobbyView
              onLobbyChange={() => void loadDashboard()}
              initialSlotId={pendingLobbySlotId}
              onInitialSlotConsumed={() => setPendingLobbySlotId(null)}
            />
          )}
          {activeView === 'bookings' && (
            <BookingsView
              joinedLobbies={joinedLobbies}
              onLeaveLobby={handleLeaveLobby}
              onPaySuccess={async () => {
                showNotice('success', 'Pembayaran berhasil! Status kelas telah diperbarui.');
                await loadDashboard();
              }}
              onPayError={(errorMsg: string) => {
                showNotice('error', errorMsg);
              }}
              onRefresh={loadDashboard}
              stateKeyPrefix={stateKeyPrefix}
            />
          )}
          {activeView === 'schedule' && (
            <TutorScheduleView
              slots={scheduleTutorSlots}
              isStudentView
              onCreateLobby={(slotId) => {
                setPendingLobbySlotId(slotId);
                setActiveView('lobbies');
              }}
            />
          )}
          {activeView === 'settings' && <SettingsView showNotice={showNotice} />}
          {activeView === 'profile' && (
            <ProfileView
              profileForm={profileForm}
              setProfileForm={setProfileForm}
              onProfileSave={handleProfileSave}
              onAvatarSelect={handleAvatarUpload}
              isSaving={isSavingName}
              isUploadingAvatar={isUploadingAvatar}
              avatarUrl={avatarUrl}
              profile={profile}
            />
          )}
          {activeView === 'dashboard' && (
            <DashboardView joinedLobbies={joinedLobbies} displayName={displayName} availableTutorSlots={availableTutorSlots} setActiveView={setActiveView} onLeaveLobby={(lobbyId) => void handleLeaveLobby(lobbyId)} />
          )}
        </main>
      </div>

      {notice && <NoticeModal notice={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}


