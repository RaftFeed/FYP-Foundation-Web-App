import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleCheck,
  Clock3,
  Home,
  LogOut,
  MapPin,
  NotebookTabs,
  Search,
  Settings,
  SquarePen,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MatchmakingLobbyView } from './MatchmakingLobbyView';
import { readLocalCache, usePersistentState, writeLocalCache } from '../../lib/browserState';
import {
  Booking,
  bookingStatusLabel,
  cancelBooking,
  fetchProfileById,
  fetchMyBookings,
  fetchSubjectMatchmakingSummaries,
  formatCurrency,
  formatDate,
  formatTimeRange,
  SubjectMatchmakingSummary,
  updateProfileName,
  type Profile,
} from '../../lib/dashboardData';
import { MatchmakingLobby, TutorAvailabilitySlot, fetchAvailableTutorSlots, fetchMatchmakingLobbies, fetchStudentTutorScheduleSlots, leaveMatchmakingLobby } from '../../lib/matchmakingData';

type StudentView = 'dashboard' | 'courses' | 'lobbies' | 'bookings' | 'schedule' | 'profile' | 'settings';

const navigation = [
  { label: 'Dashboard', icon: Home, view: 'dashboard' },
  { label: 'Mata Kuliah', icon: BookOpen, view: 'courses' },
  { label: 'Lobby Grup', icon: Users, view: 'lobbies' },
  { label: 'Booking Saya', icon: SquarePen, view: 'bookings' },
  { label: 'Jadwal Tutor', icon: CalendarDays, view: 'schedule' },
  { label: 'Profil', icon: UserRound, view: 'profile' },
  { label: 'Pengaturan', icon: Settings, view: 'settings' },
] satisfies Array<{ label: string; icon: typeof Home; view: StudentView }>;

const bookingTabs = ['Semua', 'Mendatang', 'Selesai', 'Dibatalkan', 'Menunggu Pembayaran'];

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
  const [nameInput, setNameInput] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:name-input` : null, '');
  const [availableTutorSlots, setAvailableTutorSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [scheduleTutorSlots, setScheduleTutorSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [subjects, setSubjects] = useState<SubjectMatchmakingSummary[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [joinedLobbies, setJoinedLobbies] = useState<MatchmakingLobby[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const displayName = profile?.full_name?.trim() ? profile.full_name : getDisplayName(user?.email);

  const loadDashboard = async () => {
    if (!user) {
      return;
    }

    const cacheKey = `student-dashboard:${user.id}:data`;
    const cachedData = readLocalCache<{
      availableTutorSlots: TutorAvailabilitySlot[];
      scheduleTutorSlots: TutorAvailabilitySlot[];
      subjects: SubjectMatchmakingSummary[];
      bookings: Booking[];
      joinedLobbies: MatchmakingLobby[];
      profile: Profile | null;
    }>(cacheKey);

    if (cachedData) {
      setAvailableTutorSlots(cachedData.availableTutorSlots);
      setScheduleTutorSlots(cachedData.scheduleTutorSlots);
      setSubjects(cachedData.subjects);
      setBookings(cachedData.bookings);
      setJoinedLobbies(cachedData.joinedLobbies);
      setProfile(cachedData.profile);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const [nextAvailableTutorSlots, nextScheduleTutorSlots, nextSubjects, nextBookings, nextLobbies, nextProfile] = await Promise.all([
        fetchAvailableTutorSlots(),
        fetchStudentTutorScheduleSlots(),
        fetchSubjectMatchmakingSummaries(),
        fetchMyBookings(user.id),
        fetchMatchmakingLobbies(),
        fetchProfileById(user.id),
      ]);
      const nextJoinedLobbies = nextLobbies.filter((lobby) => lobby.current_user_is_member);
      setAvailableTutorSlots(nextAvailableTutorSlots);
      setScheduleTutorSlots(nextScheduleTutorSlots);
      setSubjects(nextSubjects);
      setBookings(nextBookings);
      setJoinedLobbies(nextJoinedLobbies);
      setProfile(nextProfile);
      writeLocalCache(cacheKey, {
        availableTutorSlots: nextAvailableTutorSlots,
        scheduleTutorSlots: nextScheduleTutorSlots,
        subjects: nextSubjects,
        bookings: nextBookings,
        joinedLobbies: nextJoinedLobbies,
        profile: nextProfile,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal memuat data dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [user?.id]);

  useEffect(() => {
    if (profile?.full_name && !nameInput.trim()) {
      setNameInput(profile.full_name);
    }
  }, [nameInput, profile?.full_name, setNameInput]);

  const handleCancel = async (bookingId: string) => {
    setNotice(null);
    try {
      await cancelBooking(bookingId);
      setNotice('Booking dibatalkan.');
      await loadDashboard();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal membatalkan booking.');
    }
  };

  const handleNameSave = async () => {
    if (!user) {
      return;
    }

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setNotice('Nama lengkap tidak boleh kosong.');
      return;
    }

    setIsSavingName(true);
    setNotice(null);
    try {
      await updateProfileName(user.id, trimmedName);
      const nextProfile = await fetchProfileById(user.id);
      setProfile(nextProfile);
      setNotice('Nama berhasil diperbarui.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal memperbarui nama.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleLeaveLobby = async (lobbyId: string) => {
    setNotice(null);
    try {
      await leaveMatchmakingLobby(lobbyId);
      setNotice('Berhasil keluar dari lobby grup.');
      await loadDashboard();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal keluar dari lobby grup.');
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

        <main className="px-5 py-5 lg:px-8 lg:py-6">
          <header className="mb-6 flex items-center justify-end gap-4">
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-white text-primary shadow-sm hover:bg-secondary"
              aria-label="Notifications"
            >
              <Bell className="h-6 w-6" />
              {bookings.some((booking) => booking.status === 'pending_payment') && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <UserRound className="h-7 w-7 text-primary" />
              </div>
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
          </header>

          {notice && (
            <div className="mb-5 rounded-lg border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm">
              {notice}
            </div>
          )}

          {activeView === 'courses' && <CoursesView isLoading={isLoading} query={query} subjects={subjects} setQuery={setQuery} />}
          {activeView === 'lobbies' && <MatchmakingLobbyView onLobbyChange={() => void loadDashboard()} />}
          {activeView === 'bookings' && (
            <BookingsView
              bookings={bookings}
              joinedLobbies={joinedLobbies}
              onCancel={handleCancel}
              onLeaveLobby={handleLeaveLobby}
              stateKeyPrefix={stateKeyPrefix}
            />
          )}
          {activeView === 'schedule' && <TutorScheduleView slots={scheduleTutorSlots} />}
          {activeView === 'settings' && <SettingsView />}
          {activeView === 'profile' && (
            <ProfileView
              bookings={bookings}
              displayName={displayName}
              email={user?.email ?? ''}
              isSavingName={isSavingName}
              nameInput={nameInput}
              onNameChange={setNameInput}
              onNameSave={handleNameSave}
            />
          )}
          {activeView === 'dashboard' && (
            <DashboardView bookings={bookings} displayName={displayName} availableTutorSlots={availableTutorSlots} setActiveView={setActiveView} />
          )}
        </main>
      </div>
    </div>
  );
}

function DashboardView({
  bookings,
  displayName,
  availableTutorSlots,
  setActiveView,
}: {
  bookings: Booking[];
  displayName: string;
  availableTutorSlots: TutorAvailabilitySlot[];
  setActiveView: (view: StudentView) => void;
}) {
  const activeBookings = bookings.filter((booking) => booking.status === 'upcoming' || booking.status === 'pending_payment');
  const completedBookings = bookings.filter((booking) => booking.status === 'completed');
  const pendingPayment = bookings.filter((booking) => booking.status === 'pending_payment');
  const totalSpend = bookings
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((sum, booking) => sum + booking.total_price, 0);

  const stats = [
    { label: 'Kelas Aktif', value: String(activeBookings.length), view: 'bookings' as StudentView },
    { label: 'Menunggu Pembayaran', value: String(pendingPayment.length), view: 'bookings' as StudentView },
    { label: 'Kelas Selesai', value: String(completedBookings.length), view: 'bookings' as StudentView },
    { label: 'Total Pengeluaran', value: formatCurrency(totalSpend), view: 'bookings' as StudentView, wide: true },
  ];

  const upcoming = bookings
    .filter((booking) => booking.status === 'upcoming' || booking.status === 'pending_payment')
    .slice(0, 3);

  return (
    <section className="mx-auto max-w-6xl">
      <p className="mb-5 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">Dashboard</p>
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
          <button type="button" onClick={() => setActiveView('courses')} className="text-sm font-semibold text-foreground hover:underline">
            Cari Kelas
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
          {upcoming.length > 0 ? (
            upcoming.map((booking) => <BookingRow key={booking.id} booking={booking} />)
          ) : (
            <div className="p-6 text-sm font-medium text-muted-foreground">
              Belum ada booking mendatang. Ada {availableTutorSlots.length} slot tutor tersedia untuk kamu.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function CoursesView({
  isLoading,
  query,
  subjects,
  setQuery,
}: {
  isLoading: boolean;
  query: string;
  subjects: SubjectMatchmakingSummary[];
  setQuery: (query: string) => void;
}) {
  const filteredSubjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return subjects;
    }

    return subjects.filter((subject) =>
      [subject.name, subject.code ?? '', subject.description ?? ''].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, subjects]);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">Mata Kuliah</p>
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground">Pilih Mata Kuliah</h1>
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
            Setiap kartu menampilkan jumlah lobby matchmaking aktif untuk mata kuliah tersebut.
          </p>
        </div>
      </div>

      <label className="relative mb-6 block">
        <span className="sr-only">Cari mata kuliah</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari mata kuliah atau kode"
          className="h-10 w-full rounded-lg border border-primary/20 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-normal text-foreground">Daftar Mata Kuliah</h2>
        <p className="text-sm font-medium text-muted-foreground">Menampilkan {filteredSubjects.length} data</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && (
          <div className="col-span-full rounded-xl border border-primary/10 bg-white p-6 text-sm font-medium text-muted-foreground shadow-md">
            Memuat mata kuliah...
          </div>
        )}
        {!isLoading && filteredSubjects.length === 0 && (
          <div className="col-span-full rounded-xl border border-primary/10 bg-white p-6 text-sm font-medium text-muted-foreground shadow-md">
            Tidak ada mata kuliah yang cocok.
          </div>
        )}
        {filteredSubjects.map((subject) => {
          const hasMatchmaking = subject.matchmaking_count > 0;

          return (
            <article key={subject.id} className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mata Kuliah</p>
                  <h3 className="text-lg font-extrabold text-foreground">{subject.name}</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    hasMatchmaking ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {subject.matchmaking_count} Matchmaking
                </span>
              </div>

              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-md border border-primary/20 bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
                  {subject.code ?? 'Tanpa kode'}
                </span>
              </div>

              <p className="min-h-[72px] text-sm font-medium leading-relaxed text-muted-foreground">
                {subject.description?.trim() || 'Deskripsi mata kuliah belum tersedia.'}
              </p>

              <div className="mt-5 rounded-lg border border-primary/10 bg-secondary/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status Lobby</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {hasMatchmaking ? `Ada ${subject.matchmaking_count} lobby aktif untuk matkul ini.` : 'Belum ada lobby aktif untuk matkul ini.'}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BookingsView({
  bookings,
  joinedLobbies,
  onCancel,
  onLeaveLobby,
  stateKeyPrefix,
}: {
  bookings: Booking[];
  joinedLobbies: MatchmakingLobby[];
  onCancel: (bookingId: string) => void;
  onLeaveLobby: (lobbyId: string) => void;
  stateKeyPrefix: string | null;
}) {
  const [activeTab, setActiveTab] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:booking-tab` : null, 'Semua');
  const visibleBookings = activeTab === 'Semua' ? bookings : bookings.filter((booking) => bookingStatusLabel(booking.status) === activeTab);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">Booking Saya</p>
        <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground">Histori Pemesanan Kelas</h1>
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
            className={`min-w-max border-b-2 px-4 pb-3 text-sm font-semibold transition ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold tracking-normal text-foreground">Lobby Grup Saya</h2>
          <p className="text-sm font-medium text-muted-foreground">{joinedLobbies.length} lobby diikuti</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
          {joinedLobbies.length === 0 && <div className="p-6 text-sm font-medium text-muted-foreground">Kamu belum bergabung ke lobby grup mana pun.</div>}
          {joinedLobbies.map((lobby) => (
            <JoinedLobbyRow key={lobby.id} lobby={lobby} onLeave={onLeaveLobby} />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
        {visibleBookings.length === 0 && <div className="p-6 text-sm font-medium text-muted-foreground">Belum ada booking pada kategori ini.</div>}
        {visibleBookings.map((booking) => (
          <BookingRow key={booking.id} booking={booking} onCancel={onCancel} />
        ))}
      </div>
    </section>
  );
}

function JoinedLobbyRow({ lobby, onLeave }: { lobby: MatchmakingLobby; onLeave: (lobbyId: string) => void }) {
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
        {canLeave && (
          <button
            type="button"
            onClick={() => onLeave(lobby.id)}
            className="mt-3 h-10 rounded-lg border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-100 hover:border-red-300"
          >
            Keluar
          </button>
        )}
      </div>
    </article>
  );
}

function BookingRow({ booking, onCancel }: { booking: Booking; onCancel?: (bookingId: string) => void }) {
  const session = booking.session;
  const bookingLabel = session?.subject?.name ?? session?.title ?? `Booking ${booking.id.slice(0, 8)}`;
  const createdAtLabel = formatDate(booking.created_at);

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
        {onCancel && booking.status !== 'cancelled' && booking.status !== 'completed' && (
          <button
            type="button"
            onClick={() => onCancel(booking.id)}
            className="h-10 rounded-lg border border-primary/20 px-5 text-sm font-semibold text-primary hover:bg-secondary lg:mt-4"
          >
            Batalkan
          </button>
        )}
      </div>
    </article>
  );
}

function TutorScheduleView({ slots }: { slots: TutorAvailabilitySlot[] }) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const seedDate = slots[0]?.starts_at ? new Date(slots[0].starts_at) : today;
    return new Date(seedDate.getFullYear(), seedDate.getMonth(), 1);
  });
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTutor, setSelectedTutor] = useState('all');
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);

  const subjectOptions = useMemo(
    () => ['all', ...Array.from(new Set(slots.map((slot) => slot.subject_name))).sort((a, b) => a.localeCompare(b, 'id-ID'))],
    [slots],
  );
  const tutorOptions = useMemo(
    () => ['all', ...Array.from(new Set(slots.map((slot) => slot.tutor_name))).sort((a, b) => a.localeCompare(b, 'id-ID'))],
    [slots],
  );

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (selectedSubject !== 'all' && slot.subject_name !== selectedSubject) {
        return false;
      }

      if (selectedTutor !== 'all' && slot.tutor_name !== selectedTutor) {
        return false;
      }

      return true;
    });
  }, [selectedSubject, selectedTutor, slots]);

  const monthSessions = useMemo(
    () =>
      filteredSlots.filter((slot) => {
        const startsAt = new Date(slot.starts_at);
        return startsAt.getFullYear() === currentMonth.getFullYear() && startsAt.getMonth() === currentMonth.getMonth();
      }),
    [currentMonth, filteredSlots],
  );

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, TutorAvailabilitySlot[]>();
    for (const slot of monthSessions) {
      const key = getDateKey(new Date(slot.starts_at));
      const existing = groups.get(key) ?? [];
      existing.push(slot);
      groups.set(key, existing);
    }

    for (const entries of groups.values()) {
      entries.sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime());
    }

    return groups;
  }, [monthSessions]);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">Jadwal Tutor</p>
        <p className="max-w-4xl text-sm font-medium leading-relaxed text-muted-foreground">
          Lihat ketersediaan tutor berdasarkan tanggal. Data diambil langsung dari jadwal tutor yang tersedia.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/10 bg-white p-4 shadow-md lg:p-5">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/15 text-primary transition hover:bg-secondary"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/15 text-primary transition hover:bg-secondary"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentMonth)}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mata Kuliah</span>
              <select
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                className="h-10 w-full rounded-lg border border-primary/15 bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="all">Semua Matkul</option>
                {subjectOptions.slice(1).map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tutor</span>
              <select
                value={selectedTutor}
                onChange={(event) => setSelectedTutor(event.target.value)}
                className="h-10 w-full rounded-lg border border-primary/15 bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="all">Semua Tutor</option>
                {tutorOptions.slice(1).map((tutor) => (
                  <option key={tutor} value={tutor}>
                    {tutor}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {slots.length === 0 && (
          <div className="mb-5 rounded-xl border border-primary/10 bg-secondary/30 px-4 py-3 text-sm font-medium text-muted-foreground">
            Belum ada jadwal tutor yang tersedia untuk ditampilkan.
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-primary/10">
          <div className="grid grid-cols-7 border-b border-primary/10 bg-secondary/60">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
              <div key={day} className="px-3 py-3 text-center text-sm font-bold text-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const daySessions = groupedByDay.get(day.key) ?? [];
              const isToday = day.key === getDateKey(today);
              const isHovered = hoveredDateKey === day.key;

              return (
                <div
                  key={day.key}
                  className={`relative min-h-[108px] border-b border-r border-primary/10 p-3 text-left align-top transition sm:min-h-[118px] ${
                    day.isCurrentMonth ? 'bg-white hover:bg-secondary/40' : 'bg-secondary/30 text-muted-foreground/70'
                  } ${isHovered ? 'z-20 bg-primary/[0.05]' : ''}`}
                  onMouseEnter={() => setHoveredDateKey(daySessions.length > 0 ? day.key : null)}
                  onMouseLeave={() => setHoveredDateKey((current) => (current === day.key ? null : current))}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold ${
                        isToday ? 'bg-primary text-white' : isHovered ? 'bg-primary/10 text-primary' : 'text-foreground'
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                    {daySessions.length > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{daySessions.length}</span>}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {daySessions.slice(0, 4).map((session) => (
                      <span key={session.id} className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                    ))}
                    {daySessions.length > 4 && <span className="text-[11px] font-bold text-primary">+{daySessions.length - 4}</span>}
                  </div>

                  {isHovered && daySessions.length > 0 && (
                    <div className="absolute left-1/2 top-[calc(100%-8px)] z-30 w-[280px] -translate-x-1/2 rounded-2xl border border-primary/15 bg-white p-4 text-left shadow-2xl">
                      <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-primary/15 bg-white" />
                      <div className="relative">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detail Jadwal</p>
                        <h2 className="mt-2 text-base font-extrabold text-foreground">{formatCalendarHeading(day.key)}</h2>
                        <div className="mt-4 space-y-3">
                          {daySessions.map((session) => (
                            <article key={session.id} className="rounded-xl border border-primary/10 bg-secondary/20 p-3">
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-extrabold text-foreground">{session.tutor_name}</p>
                                  <p className="mt-1 text-xs font-medium text-muted-foreground">{session.subject_name}</p>
                                </div>
                                <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                                  {session.status}
                                </span>
                              </div>

                              <div className="space-y-1.5 text-xs font-medium text-foreground">
                                <p className="flex items-center gap-2">
                                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                                  {formatTimeRange(session.starts_at, session.ends_at)}
                                </p>
                                <p className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-primary" />
                                  {session.location ?? 'Online'}
                                </p>
                                {session.notes && (
                                  <p className="flex items-center gap-2">
                                    <NotebookTabs className="h-3.5 w-3.5 text-primary" />
                                    {session.notes}
                                  </p>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function getDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayFirstOffset);
  const totalVisibleDays = mondayFirstOffset + lastDay.getDate();
  const cellCount = Math.ceil(totalVisibleDays / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      key: getDateKey(date),
      date,
      isCurrentMonth: date.getMonth() === month,
    };
  });
}

function formatCalendarHeading(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function ProfileView({
  bookings,
  displayName,
  email,
  isSavingName,
  nameInput,
  onNameChange,
  onNameSave,
}: {
  bookings: Booking[];
  displayName: string;
  email: string;
  isSavingName: boolean;
  nameInput: string;
  onNameChange: (value: string) => void;
  onNameSave: () => void;
}) {
  return (
    <section className="mx-auto max-w-6xl">
      <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">Profil</p>
      <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <UserRound className="h-9 w-9 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{displayName}</h1>
            <p className="text-sm font-medium text-muted-foreground">{email}</p>
          </div>
        </div>
        <form
          className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onNameSave();
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-foreground">Nama lengkap</span>
            <input
              type="text"
              value={nameInput}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Masukkan nama lengkap"
              className="mt-2 h-11 w-full rounded-lg border border-primary/20 bg-white px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <button
            type="submit"
            disabled={isSavingName}
            className="h-11 rounded-lg bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {isSavingName ? 'Menyimpan...' : 'Simpan nama'}
          </button>
        </form>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <ProfileStat label="Total Booking" value={String(bookings.length)} />
          <ProfileStat label="Aktif" value={String(bookings.filter((booking) => booking.status === 'upcoming' || booking.status === 'pending_payment').length)} />
          <ProfileStat label="Selesai" value={String(bookings.filter((booking) => booking.status === 'completed').length)} />
        </div>
      </div>
    </section>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-primary/10 bg-secondary p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-primary">{value}</p>
    </div>
  );
}

function SettingsView() {
  return (
    <section className="mx-auto max-w-6xl">
      <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">Pengaturan</p>
      <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-md">
        <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground">Preferensi Akun</h1>
        <p className="mb-5 text-sm font-medium text-muted-foreground">
          Pengaturan profil lanjutan bisa ditambahkan setelah kebutuhan final dashboard ditentukan.
        </p>
        {['Login Supabase aktif', 'Data booking tersimpan di database', 'Role akun dikontrol oleh admin'].map((rule) => (
          <p key={rule} className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <CircleCheck className="h-4 w-4 text-primary" />
            {rule}
          </p>
        ))}
      </div>
    </section>
  );
}

function CourseSchedule({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  return (
    <>
      <p className="flex items-center gap-2">
        <NotebookTabs className="h-4 w-4 text-primary" />
        {formatDate(startsAt)}
      </p>
      <p className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-primary" />
        {formatTimeRange(startsAt, endsAt)}
      </p>
    </>
  );
}
