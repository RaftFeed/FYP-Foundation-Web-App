import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock3,
  Home,
  LogOut,
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
  CourseSession,
  bookCourseSession,
  bookingStatusLabel,
  cancelBooking,
  fetchProfileById,
  fetchCourseSessions,
  fetchMyBookings,
  formatCurrency,
  formatDate,
  formatTimeRange,
  updateProfileName,
  type Profile,
} from '../../lib/dashboardData';

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
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
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
      sessions: CourseSession[];
      bookings: Booking[];
      profile: Profile | null;
    }>(cacheKey);

    if (cachedData) {
      setSessions(cachedData.sessions);
      setBookings(cachedData.bookings);
      setProfile(cachedData.profile);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const [nextSessions, nextBookings, nextProfile] = await Promise.all([
        fetchCourseSessions(),
        fetchMyBookings(user.id),
        fetchProfileById(user.id),
      ]);
      setSessions(nextSessions);
      setBookings(nextBookings);
      setProfile(nextProfile);
      writeLocalCache(cacheKey, {
        sessions: nextSessions,
        bookings: nextBookings,
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

  const handleBook = async (sessionId: string) => {
    setNotice(null);
    try {
      await bookCourseSession(sessionId);
      setNotice('Booking berhasil dibuat. Status awal: Menunggu Pembayaran.');
      await loadDashboard();
      setActiveView('bookings');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal membuat booking.');
    }
  };

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

          {activeView === 'courses' && <CoursesView isLoading={isLoading} query={query} sessions={sessions} setQuery={setQuery} onBook={handleBook} />}
          {activeView === 'lobbies' && <MatchmakingLobbyView />}
          {activeView === 'bookings' && <BookingsView bookings={bookings} onCancel={handleCancel} stateKeyPrefix={stateKeyPrefix} />}
          {activeView === 'schedule' && <TutorScheduleView sessions={sessions} />}
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
          {activeView === 'dashboard' && <DashboardView bookings={bookings} displayName={displayName} sessions={sessions} setActiveView={setActiveView} />}
        </main>
      </div>
    </div>
  );
}

function DashboardView({
  bookings,
  displayName,
  sessions,
  setActiveView,
}: {
  bookings: Booking[];
  displayName: string;
  sessions: CourseSession[];
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
              Belum ada kelas mendatang. Ada {sessions.length} kelas tersedia untuk kamu.
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
  sessions,
  setQuery,
  onBook,
}: {
  isLoading: boolean;
  query: string;
  sessions: CourseSession[];
  setQuery: (query: string) => void;
  onBook: (sessionId: string) => void;
}) {
  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return sessions;
    }

    return sessions.filter((session) =>
      [session.subject_name, session.tutor_name, session.code, session.title].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, sessions]);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">Mata Kuliah</p>
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground">Pilih Mata Kuliah</h1>
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
            Berikut adalah kelas grup yang tersedia langsung dari database Supabase.
          </p>
        </div>
      </div>

      <label className="relative mb-6 block">
        <span className="sr-only">Cari kelas</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari kelas, tutor, atau kode kelas"
          className="h-10 w-full rounded-lg border border-primary/20 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-normal text-foreground">Kelas Tersedia</h2>
        <p className="text-sm font-medium text-muted-foreground">Menampilkan {filteredSessions.length} data</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
        {isLoading && <div className="p-6 text-sm font-medium text-muted-foreground">Memuat kelas...</div>}
        {!isLoading && filteredSessions.length === 0 && <div className="p-6 text-sm font-medium text-muted-foreground">Tidak ada kelas yang cocok.</div>}
        {filteredSessions.map((session) => {
          const isFull = session.booked_seats >= session.capacity;

          return (
            <article
              key={session.id}
              className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 xl:grid-cols-[104px_1.25fr_1fr_0.95fr_auto] xl:items-center"
            >
              <div className="relative h-24 w-24 rounded-xl border border-primary/10 bg-secondary">
                <span className="absolute left-2 top-2 rounded-md border border-primary/20 bg-white px-2 py-0.5 text-xs font-semibold text-primary">
                  {session.booked_seats}/{session.capacity}
                </span>
              </div>
              <div>
                <h3 className="mb-1 text-lg font-extrabold text-foreground">Matkul - {session.subject_name}</h3>
                <p className="mb-4 text-sm font-medium text-muted-foreground">Tutor : {session.tutor_name}</p>
                <div className="space-y-2 text-sm font-medium text-foreground xl:hidden">
                  <CourseSchedule startsAt={session.starts_at} endsAt={session.ends_at} />
                </div>
              </div>
              <div className="hidden space-y-2 text-sm font-medium text-foreground xl:block">
                <CourseSchedule startsAt={session.starts_at} endsAt={session.ends_at} />
              </div>
              <div>
                <p className="mb-4 text-base font-extrabold text-primary">{formatCurrency(session.price_per_seat)} / sesi</p>
                <p className="mb-1 text-sm font-medium text-muted-foreground">Kode Kelas</p>
                <p className="inline-flex rounded-md border-2 border-dashed border-primary/30 bg-secondary px-3 py-1.5 text-sm font-semibold tracking-[0.18em] text-primary">
                  {session.code}
                </p>
              </div>
              <button
                type="button"
                disabled={isFull}
                onClick={() => onBook(session.id)}
                className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {isFull ? 'Kelas Penuh' : 'Gabung'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BookingsView({
  bookings,
  onCancel,
  stateKeyPrefix,
}: {
  bookings: Booking[];
  onCancel: (bookingId: string) => void;
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

      <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
        {visibleBookings.length === 0 && <div className="p-6 text-sm font-medium text-muted-foreground">Belum ada booking pada kategori ini.</div>}
        {visibleBookings.map((booking) => (
          <BookingRow key={booking.id} booking={booking} onCancel={onCancel} />
        ))}
      </div>
    </section>
  );
}

function BookingRow({ booking, onCancel }: { booking: Booking; onCancel?: (bookingId: string) => void }) {
  const session = booking.session;

  return (
    <article className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 lg:grid-cols-[92px_1fr_220px] lg:items-center">
      <div className="h-20 w-20 rounded-xl border border-primary/10 bg-secondary" />
      <div>
        <h3 className="mb-1 text-base font-extrabold text-foreground">Matkul - {session?.subject?.name ?? session?.title ?? 'Kelas'}</h3>
        <p className="mb-4 text-sm font-medium text-muted-foreground">Tutor : {session?.tutor?.full_name ?? '-'}</p>
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

function TutorScheduleView({ sessions }: { sessions: CourseSession[] }) {
  const upcoming = sessions.slice(0, 10);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">Jadwal Tutor</p>
        <p className="max-w-4xl text-sm font-medium leading-relaxed text-muted-foreground">
          Jadwal berikut berasal dari tabel course_sessions dan akan berubah saat admin mengubah sesi.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
        {upcoming.length === 0 && <div className="p-6 text-sm font-medium text-muted-foreground">Belum ada jadwal tutor.</div>}
        {upcoming.map((session) => (
          <article key={session.id} className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 md:grid-cols-[1fr_1fr_160px] md:items-center">
            <div>
              <p className="text-base font-extrabold text-foreground">{session.tutor_name}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{session.subject_name}</p>
            </div>
            <div className="space-y-2 text-sm font-medium text-foreground">
              <CourseSchedule startsAt={session.starts_at} endsAt={session.ends_at} />
            </div>
            <p className="rounded-lg bg-secondary px-3 py-2 text-center text-sm font-semibold text-primary">{session.booked_seats}/{session.capacity} kursi</p>
          </article>
        ))}
      </div>
    </section>
  );
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
