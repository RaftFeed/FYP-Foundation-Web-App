import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  Home,
  LogOut,
  NotebookTabs,
  Plus,
  Search,
  Settings,
  SquarePen,
  EyeOff,
  CircleCheck,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

type StudentView = 'dashboard' | 'courses' | 'bookings' | 'schedule' | 'profile' | 'settings';

const navigation = [
  { label: 'Dashboard', icon: Home, view: 'dashboard' },
  { label: 'Mata Kuliah', icon: BookOpen, view: 'courses' },
  { label: 'Booking Saya', icon: SquarePen, view: 'bookings' },
  { label: 'Jadwal Tutor', icon: CalendarDays, view: 'schedule' },
  { label: 'Profil', icon: UserRound, view: 'profile' },
  { label: 'Pengaturan', icon: Settings, view: 'settings' },
] satisfies Array<{ label: string; icon: typeof Home; view: StudentView }>;

const courses = [
  { subject: 'Kalkulus Dasar', tutor: 'Dr. Budi Santoso', date: 'Sabtu, 23 Februari 2026', time: '10.00 - 11.30', price: 'Rp75.000', code: 'MAT201-3921', seats: '3/4' },
  { subject: 'Fisika Dasar', tutor: 'Ahmad Fauzi', date: 'Senin, 25 Februari 2026', time: '13.00 - 14.30', price: 'Rp70.000', code: 'FIS101-8840', seats: '2/4' },
  { subject: 'Pemrograman', tutor: 'Rani Wijaya', date: 'Rabu, 27 Februari 2026', time: '09.00 - 10.30', price: 'Rp90.000', code: 'PRG220-1208', seats: '3/4' },
  { subject: 'Kimia Dasar', tutor: 'Lestari Putri', date: 'Jumat, 29 Februari 2026', time: '15.00 - 16.30', price: 'Rp65.000', code: 'KIM110-7712', seats: '1/4' },
];

const bookings = [
  { subject: 'Kalkulus Dasar', tutor: 'Dr. Budi Santoso', date: 'Sabtu, 23 Februari 2026', time: '10.00 - 11.30', price: 'Rp150.000', status: 'Menunggu Pembayaran' },
  { subject: 'Fisika Dasar', tutor: 'Ahmad Fauzi', date: 'Senin, 25 Februari 2026', time: '13.00 - 14.30', price: 'Rp140.000', status: 'Mendatang' },
  { subject: 'Pemrograman', tutor: 'Rani Wijaya', date: 'Rabu, 27 Februari 2026', time: '09.00 - 10.30', price: 'Rp180.000', status: 'Selesai' },
  { subject: 'Kimia Dasar', tutor: 'Lestari Putri', date: 'Jumat, 29 Februari 2026', time: '15.00 - 16.30', price: 'Rp130.000', status: 'Dibatalkan' },
];

const bookingTabs = ['Semua', 'Mendatang', 'Selesai', 'Dibatalkan', 'Menunggu Pembayaran'];

const calendarDays = [
  { day: 30, outside: true },
  { day: 31, outside: true },
  { day: 1 },
  { day: 2 },
  { day: 3 },
  { day: 4 },
  { day: 5 },
  { day: 6 },
  { day: 7 },
  { day: 8, hasSchedule: true },
  { day: 9 },
  { day: 10 },
  { day: 11 },
  { day: 12 },
  { day: 13 },
  { day: 14, hasSchedule: true },
  { day: 15 },
  { day: 16, selected: true, hasSchedule: true },
  { day: 17 },
  { day: 18 },
  { day: 19 },
  { day: 20 },
  { day: 21 },
  { day: 22, hasSchedule: true },
  { day: 23, hasSchedule: true },
  { day: 24 },
  { day: 25 },
  { day: 26 },
  { day: 27 },
  { day: 28, hasSchedule: true },
  { day: 29 },
  { day: 30 },
  { day: 1, outside: true },
  { day: 2, outside: true },
  { day: 3, outside: true },
];

const tutorSchedule = [
  { time: '09.00-12.00', tutor: 'Dr. Budi Santoso', subject: 'Kalkulus Dasar' },
  { time: '13.00-15.00', tutor: 'Ahmad Fauzi', subject: 'Fisika Dasar' },
  { time: '13.00-19.00', tutor: 'Rani Wijaya', subject: 'Pemrograman' },
  { time: '15.00-17.00', tutor: 'Lestari Putri', subject: 'Kimia Dasar' },
];

const stats = [
  { label: 'Kelas Aktif', value: '15' },
  { label: 'Menunggu Pembayaran', value: '1' },
  { label: 'Kelas Selesai', value: '9' },
  { label: 'Total Pengeluaran', value: 'Rp1.067.000', wide: true },
];

const upcomingClasses = [
  { subject: 'Kalkulus Dasar', tutor: 'Dr. Budi Santoso', date: 'Sabtu, 23 Februari 2026', time: '10.00 - 11.30' },
  { subject: 'Fisika Dasar', tutor: 'Siti Nurhaliza', date: 'Senin, 25 Februari 2026', time: '13.00 - 14.30' },
  { subject: 'Pemrograman', tutor: 'Rani Wijaya', date: 'Rabu, 27 Februari 2026', time: '09.00 - 10.30' },
];

function getDisplayName(email?: string) {
  if (!email) {
    return 'Student';
  }

  const name = email.split('@')[0].replace(/[._-]+/g, ' ');
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function StudentDashboard() {
  const { user, signOut } = useAuth();
  const [activeView, setActiveView] = useState<StudentView>('dashboard');
  const displayName = getDisplayName(user?.email);

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
          <header className="mb-8 flex items-center justify-end gap-4">
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-white text-primary shadow-sm hover:bg-secondary"
              aria-label="Notifications"
            >
              <Bell className="h-6 w-6" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
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

          {activeView === 'courses' && <CoursesView />}
          {activeView === 'bookings' && <BookingsView />}
          {activeView === 'schedule' && <TutorScheduleView />}
          {activeView === 'settings' && <SettingsView />}
          {activeView !== 'courses' && activeView !== 'bookings' && activeView !== 'schedule' && activeView !== 'settings' && <DashboardView displayName={displayName} />}
        </main>
      </div>
    </div>
  );
}

function DashboardView({ displayName }: { displayName: string }) {
  return (
    <section className="mx-auto max-w-6xl">
            <p className="mb-5 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">
              Dashboard
            </p>
            <h1 className="mb-3 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">
              Hello, {displayName}!
            </h1>
            <p className="mb-6 text-base font-medium text-muted-foreground">Belajar apa hari ini?</p>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <article key={stat.label} className="relative min-h-[112px] rounded-xl border border-primary/10 bg-white p-4 shadow-md transition hover:border-primary/30 hover:-translate-y-0.5">
                  <p className="mb-3 max-w-[80%] text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className={`${stat.wide ? 'text-2xl' : 'text-3xl'} font-extrabold leading-none text-foreground`}>
                    {stat.value}
                  </p>
                  <button
                    type="button"
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
                <button type="button" className="text-sm font-semibold text-foreground hover:underline">
                  Lihat Semua
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
                {upcomingClasses.map((item) => (
                  <article
                    key={`${item.subject}-${item.time}`}
                    className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 md:grid-cols-[88px_1.2fr_1fr_auto] md:items-center"
                  >
                    <div className="h-20 w-20 rounded-xl bg-secondary border border-primary/10" />
                    <div>
                      <h3 className="mb-2 text-base font-extrabold text-foreground">Matkul - {item.subject}</h3>
                      <p className="text-sm font-medium text-muted-foreground">Tutor : {item.tutor}</p>
                    </div>
                    <div className="space-y-2 text-sm font-medium text-foreground">
                      <p className="flex items-center gap-3">
                        <NotebookTabs className="h-4 w-4 text-primary" />
                        {item.date}
                      </p>
                      <p className="flex items-center gap-3">
                        <Clock3 className="h-4 w-4 text-primary" />
                        {item.time}
                      </p>
                    </div>
                    <button type="button" className="h-10 rounded-lg border border-primary/20 bg-secondary px-5 text-sm font-semibold text-primary hover:bg-primary hover:text-white">
                      Lihat Detail
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-8 flex flex-col gap-4 rounded-xl border border-primary/10 bg-white p-5 shadow-md md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-primary/20 bg-secondary text-primary">
                  <CircleHelp className="h-9 w-9" />
                </div>
                <div>
                  <h2 className="mb-1 text-lg font-extrabold tracking-normal text-foreground">Butuh bantuan?</h2>
                  <p className="text-sm font-medium text-muted-foreground">Hubungi kami melalui Whatsapp!</p>
                </div>
              </div>
              <button type="button" className="h-10 rounded-lg bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90">
                Hubungi Kami
              </button>
            </section>
          </section>
  );
}

function CoursesView() {
  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">
            Mata Kuliah
          </p>
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground">Pilih Mata Kuliah</h1>
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
            Berikut adalah kelas grup yang tersedia. Bergabunglah dengan kelas yang sudah dibuat oleh siswa lain.
          </p>
        </div>
        <button
          type="button"
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Buat Kelas Baru
        </button>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
        <label className="relative block">
          <span className="sr-only">Cari kelas</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Cari kelas, tutor, atau kode kelas"
            className="h-10 w-full rounded-lg border border-primary/20 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <FilterButton icon={BookOpen} label="Semua Matkul" />
        <FilterButton icon={CalendarDays} label="Semua Tanggal" />
        <FilterButton icon={UserRound} label="Semua Tutor" />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-normal text-foreground">Kelas Tersedia</h2>
        <p className="text-sm font-medium text-muted-foreground">Menampilkan 1-4 dari 12 data</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
        {courses.map((course) => (
          <article
            key={course.code}
            className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 xl:grid-cols-[104px_1.25fr_1fr_0.95fr_auto] xl:items-center"
          >
            <div className="relative h-24 w-24 rounded-xl border border-primary/10 bg-secondary">
              <span className="absolute left-2 top-2 rounded-md border border-primary/20 bg-white px-2 py-0.5 text-xs font-semibold text-primary">
                {course.seats}
              </span>
            </div>
            <div>
              <h3 className="mb-1 text-lg font-extrabold text-foreground">Matkul - {course.subject}</h3>
              <p className="mb-4 text-sm font-medium text-muted-foreground">Tutor : {course.tutor}</p>
              <div className="space-y-2 text-sm font-medium text-foreground xl:hidden">
                <CourseSchedule course={course} />
              </div>
            </div>
            <div className="hidden space-y-2 text-sm font-medium text-foreground xl:block">
              <CourseSchedule course={course} />
            </div>
            <div>
              <p className="mb-4 text-base font-extrabold text-primary">{course.price} / sesi</p>
              <p className="mb-1 text-sm font-medium text-muted-foreground">Kode Kelas</p>
              <p className="inline-flex rounded-md border-2 border-dashed border-primary/30 bg-secondary px-3 py-1.5 text-sm font-semibold tracking-[0.18em] text-primary">
                {course.code}
              </p>
            </div>
            <button
              type="button"
              className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Lihat Detail & Gabung
            </button>
          </article>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button type="button" className="h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary">
          Prev
        </button>
        {[1, 2, 3].map((page) => (
          <button
            key={page}
            type="button"
            className={`h-10 w-10 rounded-lg text-sm font-semibold ${page === 1 ? 'bg-primary text-white' : 'bg-secondary text-primary hover:bg-primary hover:text-white'}`}
          >
            {page}
          </button>
        ))}
        <button type="button" className="h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary">
          Next
        </button>
      </div>
    </section>
  );
}

function BookingsView() {
  const [activeTab, setActiveTab] = useState('Semua');
  const visibleBookings = activeTab === 'Semua' ? bookings : bookings.filter((booking) => booking.status === activeTab);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
          <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">
          Booking Saya
        </p>
        <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground">Histori Pemesanan Kelas</h1>
        <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
          Berikut adalah riwayat pemesanan kelas yang pernah anda lakukan.
        </p>
      </div>

      <div className="mb-5 flex gap-3 overflow-x-auto border-b border-primary/10">
        {bookingTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`min-w-max border-b-2 px-4 pb-3 text-sm font-semibold transition ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-md">
        {visibleBookings.map((booking) => (
          <article
            key={`${booking.subject}-${booking.status}`}
            className="grid gap-4 border-b border-primary/10 p-4 last:border-b-0 lg:grid-cols-[92px_1fr_180px] lg:items-center"
          >
            <div className="h-20 w-20 rounded-xl border border-primary/10 bg-secondary" />
            <div>
              <h3 className="mb-1 text-base font-extrabold text-foreground">Matkul - {booking.subject}</h3>
              <p className="mb-4 text-sm font-medium text-muted-foreground">Tutor : {booking.tutor}</p>
              <div className="flex flex-col gap-2 text-sm font-medium text-foreground sm:flex-row sm:gap-5">
                <p className="flex items-center gap-2">
                  <NotebookTabs className="h-4 w-4 text-primary" />
                  {booking.date}
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {booking.time}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 lg:block lg:text-right">
              <div>
                <p className="mb-2 inline-flex rounded-lg border border-primary/20 bg-secondary px-3 py-1 text-xs font-semibold text-primary lg:mb-4">
                  {booking.status}
                </p>
                <p className="text-base font-semibold text-primary">{booking.price}</p>
              </div>
              <button type="button" className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90 lg:mt-4">
                Lihat Detail
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-muted-foreground">Menampilkan 1-4 dari 12 data</p>
        <div className="flex items-center gap-3">
          <button type="button" className="h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary">
            Prev
          </button>
          {[1, 2, 3].map((page) => (
            <button
              key={page}
              type="button"
              className={`h-10 w-10 rounded-lg text-sm font-semibold ${page === 1 ? 'bg-primary text-white' : 'bg-secondary text-primary hover:bg-primary hover:text-white'}`}
            >
              {page}
            </button>
          ))}
          <button type="button" className="h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary">
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function TutorScheduleView() {
  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">
          Jadwal Tutor
        </p>
        <p className="max-w-4xl text-sm font-medium leading-relaxed text-muted-foreground">
          Lihat ketersediaan tutor berdasarkan tanggal. Arahkan kursor pada tanggal untuk melihat detail tutor yang mengajar.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-white text-primary hover:bg-secondary">
            <ChevronDown className="h-5 w-5 rotate-90" />
          </button>
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-white text-primary hover:bg-secondary">
            <ChevronDown className="h-5 w-5 -rotate-90" />
          </button>
          <button type="button" className="ml-2 flex h-10 items-center gap-2 rounded-lg px-2 text-lg font-extrabold text-primary hover:bg-secondary">
            April 2026
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FilterButton icon={BookOpen} label="Semua Matkul" />
          <FilterButton icon={UserRound} label="Semua Tutor" />
        </div>
      </div>

      <div className="relative rounded-xl border border-primary/10 bg-white p-4 shadow-md">
        <div className="mb-3 grid grid-cols-7 text-center text-sm font-extrabold text-primary">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-primary/10">
          {calendarDays.map((item, index) => (
            <button
              key={`${item.day}-${index}`}
              type="button"
              className={`relative min-h-[88px] border-b border-r border-primary/10 p-3 text-left text-base font-semibold transition hover:bg-secondary ${
                item.outside ? 'text-muted-foreground/60' : 'text-foreground'
              } ${item.selected ? 'bg-secondary text-primary ring-1 ring-primary/30' : 'bg-white'} ${(index + 1) % 7 === 0 ? 'border-r-0' : ''} ${
                index >= 28 ? 'border-b-0' : ''
              }`}
            >
              {item.day}
              {item.hasSchedule && <span className="absolute bottom-3 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent" />}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-primary/10 bg-white p-4 shadow-xl xl:absolute xl:right-28 xl:top-[300px] xl:mt-0 xl:w-[320px]">
          <p className="mb-4 text-sm font-extrabold text-primary">Kamis, 16 April 2026</p>
          <div className="space-y-4">
            {tutorSchedule.map((item) => (
              <div key={`${item.time}-${item.tutor}`} className="grid grid-cols-[10px_1fr_1fr] gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-accent" />
                <p className="font-semibold text-foreground">{item.time}</p>
                <div>
                  <p className="font-extrabold text-foreground">{item.tutor}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{item.subject}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-primary/10 pt-4">
            <button type="button" className="text-sm font-semibold text-primary hover:underline">
              Lihat Semua Jadwal
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsView() {
  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-7">
        <p className="mb-4 text-2xl font-semibold uppercase tracking-[0.22em] text-primary lg:text-3xl">
          Pengaturan
        </p>
        <p className="max-w-4xl text-sm font-medium leading-relaxed text-muted-foreground">
          Atur preferensi keamanan, dan pengaturan notifikasi untuk pengalaman yang lebih personal.
        </p>
      </div>

      <div className="max-w-2xl">
        <section className="mb-7">
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground">Ubah Password</h1>
          <p className="mb-5 text-sm font-medium text-muted-foreground">
            Gunakan password yang kuat untuk menjaga keamanan akun anda.
          </p>

          <form className="space-y-4">
            <PasswordField label="Password Lama" placeholder="Masukkan password lama Anda" />
            <PasswordField label="Password Baru" placeholder="Masukkan password baru Anda" />
            <PasswordField label="Konfirmasi Password Baru" placeholder="Masukkan password baru Anda" />

            <div className="rounded-xl border border-primary/10 bg-secondary p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <p className="mb-3 text-sm font-extrabold text-foreground">Password Harus :</p>
                  <div className="space-y-2 text-sm font-medium text-foreground">
                    {['Minimal 8 karakter', 'Mengandung huruf besar dan kecil', 'Mengandung angka atau simbol'].map((rule) => (
                      <p key={rule} className="flex items-center gap-2">
                        <CircleCheck className="h-4 w-4 text-primary" />
                        {rule}
                      </p>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="h-10 rounded-lg bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Simpan Password
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
          <h2 className="mb-2 text-lg font-extrabold tracking-normal text-foreground">Hapus Akun</h2>
          <p className="mb-5 max-w-lg text-sm font-medium leading-relaxed text-muted-foreground">
            Setelah menghapus akun, semua data anda akan dihapus secara permanen dan tidak dapat dipulihkan.
          </p>
          <button type="button" className="h-10 rounded-lg border border-primary/30 px-6 text-sm font-semibold text-primary hover:bg-secondary">
            Hapus Akun
          </button>
        </section>
      </div>
    </section>
  );
}

function PasswordField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-foreground">{label}</span>
      <span className="relative block">
        <input
          type="password"
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-primary/20 bg-white px-4 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <EyeOff className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
      </span>
    </label>
  );
}

function FilterButton({ icon: Icon, label }: { icon: typeof BookOpen; label: string }) {
  return (
    <button
      type="button"
      className="flex h-10 items-center justify-between gap-3 rounded-lg border border-primary/20 bg-white px-3 text-sm font-semibold text-primary hover:bg-secondary"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ChevronDown className="h-4 w-4 text-primary/70" />
    </button>
  );
}

function CourseSchedule({ course }: { course: (typeof courses)[number] }) {
  return (
    <>
      <p className="flex items-center gap-2">
        <NotebookTabs className="h-4 w-4 text-primary" />
        {course.date}
      </p>
      <p className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-primary" />
        {course.time}
      </p>
    </>
  );
}
