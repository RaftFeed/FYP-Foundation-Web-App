import { BookOpen, CalendarDays, FileBarChart, GraduationCap, Home, LogOut, RefreshCcw, Save, ShieldCheck, SquarePen, Trash2, Users, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NoticeModal, type NoticeModalState } from './ui/NoticeModal';
import {
  Booking,
  BookingStatus,
  Profile,
  Subject,
  TutorProfile,
  UserRole,
  bookingStatusLabel,
  deleteSubject,
  deleteTutorProfile,
  fetchAdminBookings,
  fetchProfiles,
  fetchSubjects,
  fetchTutorProfiles,
  formatCurrency,
  formatDate,
  formatTimeRange,
  updateBookingStatus,
  updateProfileRole,
  upsertSubject,
  upsertTutorProfile,
} from '../../lib/dashboardData';
import { TutorAvailabilitySlot, fetchAdminTutorAvailability } from '../../lib/matchmakingData';
import { Report, fetchReports } from '../../lib/paymentsReports';
import { readLocalCache, usePersistentState, writeLocalCache } from '../../lib/browserState';

type AdminTab = 'dashboard' | 'sessions' | 'tutors' | 'subjects' | 'bookings' | 'users' | 'reports';

const navigation: Array<{ label: string; icon: typeof Home; view: AdminTab }> = [
  { label: 'Dashboard', icon: Home, view: 'dashboard' },
  { label: 'Tutor Slots', icon: CalendarDays, view: 'sessions' },
  { label: 'Tutors', icon: GraduationCap, view: 'tutors' },
  { label: 'Subjects', icon: BookOpen, view: 'subjects' },
  { label: 'Bookings', icon: SquarePen, view: 'bookings' },
  { label: 'Users', icon: Users, view: 'users' },
  { label: 'Reports', icon: FileBarChart, view: 'reports' },
];

const emptySubject = { name: '', code: '', description: '' };
const emptyTutor = { full_name: '', subject_id: '', hourly_rate: 0, rating: 0, reviews_count: 0, image_url: '', bio: '' };

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const stateKeyPrefix = user ? `admin-dashboard:${user.id}` : null;
  const [activeTab, setActiveTab] = usePersistentState<AdminTab>(stateKeyPrefix ? `${stateKeyPrefix}:active-tab` : null, 'dashboard');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeModalState | null>(null);
  const [subjectForm, setSubjectForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:subject-form` : null, emptySubject);
  const [editingSubjectId, setEditingSubjectId] = usePersistentState<string | null>(stateKeyPrefix ? `${stateKeyPrefix}:editing-subject-id` : null, null);
  const [tutorForm, setTutorForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:tutor-form` : null, emptyTutor);
  const [editingTutorId, setEditingTutorId] = usePersistentState<string | null>(stateKeyPrefix ? `${stateKeyPrefix}:editing-tutor-id` : null, null);
  const [isAddingTutor, setIsAddingTutor] = useState(false);

  const showNotice = (tone: NoticeModalState['tone'], message: string) => {
    setNotice({ tone, message });
  };

  const loadAdminData = async () => {
    const cacheKey = user ? `admin-dashboard:${user.id}:data:v2` : null;
    const cachedData = cacheKey
      ? readLocalCache<{
          subjects: Subject[];
          tutors: TutorProfile[];
          slots: TutorAvailabilitySlot[];
          bookings: Booking[];
          profiles: Profile[];
          reports: Report[];
        }>(cacheKey)
      : null;

    if (cachedData) {
      setSubjects(cachedData.subjects);
      setTutors(cachedData.tutors);
      setSlots(cachedData.slots);
      setBookings(cachedData.bookings);
      setProfiles(cachedData.profiles);
      setReports(cachedData.reports);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const [nextSubjects, nextTutors, nextSlots, nextBookings, nextProfiles, nextReports] = await Promise.all([
        fetchSubjects(),
        fetchTutorProfiles(),
        fetchAdminTutorAvailability(),
        fetchAdminBookings(),
        fetchProfiles(),
        fetchReports(),
      ]);
      setSubjects(nextSubjects);
      setTutors(nextTutors);
      setSlots(nextSlots);
      setBookings(nextBookings);
      setProfiles(nextProfiles);
      setReports(nextReports);
      if (cacheKey) {
        writeLocalCache(cacheKey, {
          subjects: nextSubjects,
          tutors: nextTutors,
          slots: nextSlots,
          bookings: nextBookings,
          profiles: nextProfiles,
          reports: nextReports,
        });
      }
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal memuat admin dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, []);

  const stats = useMemo(
    () => [
      { label: 'Total Students', value: String(profiles.filter((profile) => profile.role === 'student').length), icon: Users },
      { label: 'Total Tutors', value: String(tutors.length), icon: GraduationCap },
      { label: 'Courses Listed', value: String(subjects.length), icon: BookOpen },
      { label: 'Tutor Slots', value: String(slots.length), icon: CalendarDays },
    ],
    [profiles, slots, subjects, tutors],
  );
  const handleTutorSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runAdminAction(async () => {
      await upsertTutorProfile({
        id: editingTutorId ?? undefined,
        full_name: tutorForm.full_name,
        subject_id: tutorForm.subject_id,
        hourly_rate: Number(tutorForm.hourly_rate),
        rating: Number(tutorForm.rating),
        reviews_count: Number(tutorForm.reviews_count),
        image_url: tutorForm.image_url || null,
        bio: tutorForm.bio || null,
        status: 'approved',
      });
      setTutorForm(emptyTutor);
      setEditingTutorId(null);
    }, 'Tutor saved.');
  };

  const handleSubjectSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runAdminAction(async () => {
      await upsertSubject({
        id: editingSubjectId ?? undefined,
        name: subjectForm.name,
        code: subjectForm.code || null,
        description: subjectForm.description || null,
      });
      setSubjectForm(emptySubject);
      setEditingSubjectId(null);
    }, 'Subject saved.');
  };

  const runAdminAction = async (action: () => Promise<void>, successMessage: string) => {
    setNotice(null);
    try {
      await action();
      showNotice('success', successMessage);
      await loadAdminData();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Admin action failed.');
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
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveTab(item.view)}
                  className={`flex min-w-max items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition lg:w-full ${
                    activeTab === item.view ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-primary'
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
          <header className="flex items-center justify-between gap-4 pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-[0.22em] text-primary">
              {navigation.find((item) => item.view === activeTab)?.label || 'Dashboard'}
            </h1>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-lg border border-primary/10 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm md:inline-flex">
                {isLoading ? 'Loading database...' : 'Connected to Supabase'}
              </span>
              <button
                type="button"
                onClick={() => void loadAdminData()}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-white text-primary shadow-sm hover:bg-secondary"
                aria-label="Refresh"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex items-center gap-2 rounded-lg border border-primary/10 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>

          {activeTab === 'dashboard' && (
            <section>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <article
                      key={stat.label}
                      className="relative min-h-[112px] rounded-xl border border-primary/10 bg-white p-4 shadow-md transition hover:border-primary/30 hover:-translate-y-0.5"
                    >
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-3xl font-extrabold leading-none text-foreground">{stat.value}</p>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">{stat.label}</p>
                    </article>
                  );
                })}
              </div>

              <div className="overflow-hidden rounded-xl border border-primary/10 bg-white p-6 shadow-md">
                <div className="mb-4 flex items-center gap-3 text-primary">
                  <ShieldCheck className="h-7 w-7" />
                  <div>
                    <p className="text-xl font-extrabold text-foreground">Admin Control Center</p>
                    <p className="text-sm font-medium text-muted-foreground">{user?.email ?? 'Signed out'}</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Selamat datang di panel kendali Admin FYP Foundation. Gunakan sidebar untuk mengelola tutor, mata kuliah, booking, dan pengguna.
                </p>
              </div>
            </section>
          )}

          {activeTab === 'sessions' && <AvailabilityPanel slots={slots} />}

          {activeTab === 'tutors' && (
            <TutorsPanel
              tutors={tutors}
              onEdit={(tutor) => {
                setIsAddingTutor(false);
                setEditingTutorId(tutor.id);
                setTutorForm({
                  full_name: tutor.full_name,
                  subject_id: tutor.subject_id ?? '',
                  hourly_rate: tutor.hourly_rate,
                  rating: tutor.rating,
                  reviews_count: tutor.reviews_count,
                  image_url: tutor.image_url ?? '',
                  bio: tutor.bio ?? '',
                });
              }}
              onDelete={(id) => runAdminAction(() => deleteTutorProfile(id), 'Tutor deleted.')}
              onAdd={() => {
                setEditingTutorId(null);
                setTutorForm(emptyTutor);
                setIsAddingTutor(true);
              }}
            />
          )}

          {(editingTutorId !== null || isAddingTutor) && (
            <TutorEditModal
              form={tutorForm}
              isNew={isAddingTutor}
              subjects={subjects}
              onChange={setTutorForm}
              onSubmit={handleTutorSubmit}
              onCancel={() => {
                setIsAddingTutor(false);
                setEditingTutorId(null);
                setTutorForm(emptyTutor);
              }}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectsPanel
              editingId={editingSubjectId}
              form={subjectForm}
              subjects={subjects}
              onChange={setSubjectForm}
              onSubmit={handleSubjectSubmit}
              onEdit={(subject) => {
                setEditingSubjectId(subject.id);
                setSubjectForm({ name: subject.name, code: subject.code ?? '', description: subject.description ?? '' });
              }}
              onDelete={(id) => runAdminAction(() => deleteSubject(id), 'Subject deleted.')}
              onCancel={() => {
                setEditingSubjectId(null);
                setSubjectForm(emptySubject);
              }}
            />
          )}

          {activeTab === 'bookings' && (
            <BookingsPanel
              bookings={bookings}
              onStatusChange={(id, status) => runAdminAction(() => updateBookingStatus(id, status), 'Booking updated.')}
            />
          )}

          {activeTab === 'users' && (
            <UsersPanel
              profiles={profiles}
              onRoleChange={(id, role) => runAdminAction(() => updateProfileRole(id, role), 'User role updated.')}
            />
          )}

          {activeTab === 'reports' && <ReportsPanel reports={reports} />}
        </main>
      </div>

      {notice && <NoticeModal notice={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}

function SubjectsPanel({
  editingId,
  form,
  onCancel,
  onChange,
  onDelete,
  onEdit,
  onSubmit,
  subjects,
}: {
  editingId: string | null;
  form: typeof emptySubject;
  onCancel: () => void;
  onChange: (form: typeof emptySubject) => void;
  onDelete: (id: string) => void;
  onEdit: (subject: Subject) => void;
  onSubmit: (event: FormEvent) => void;
  subjects: Subject[];
}) {
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
      <AdminForm title={editingId ? 'Edit Subject' : 'Add Subject'} onSubmit={onSubmit} onCancel={editingId ? onCancel : undefined}>
        <TextInput label="Name" value={form.name} onChange={(value) => onChange({ ...form, name: value })} required />
        <TextInput label="Code" value={form.code} onChange={(value) => onChange({ ...form, code: value })} />
        <TextArea label="Description" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
      </AdminForm>

      <DataTable headers={['Name', 'Code', 'Description', 'Actions']}>
        {subjects.map((subject) => (
          <tr key={subject.id}>
            <Cell strong>{subject.name}</Cell>
            <Cell>{subject.code}</Cell>
            <Cell>{subject.description}</Cell>
            <ActionCell onEdit={() => onEdit(subject)} onDelete={() => onDelete(subject.id)} />
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function TutorsPanel({
  tutors,
  onEdit,
  onDelete,
  onAdd,
}: {
  tutors: TutorProfile[];
  onEdit: (tutor: TutorProfile) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">{tutors.length} tutor terdaftar</p>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 transition"
        >
          <GraduationCap className="h-4 w-4" />
          Tambah Tutor
        </button>
      </div>

      <DataTable headers={['Name', 'Subject', 'Rate', 'Actions']}>
        {tutors.map((tutor) => (
          <tr key={tutor.id}>
            <Cell strong>{tutor.full_name}</Cell>
            <Cell>{tutor.subject?.name ?? '-'}</Cell>
            <Cell>{formatCurrency(tutor.hourly_rate)}</Cell>
            <ActionCell onEdit={() => onEdit(tutor)} onDelete={() => onDelete(tutor.id)} />
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function TutorEditModal({
  form,
  isNew,
  subjects,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: typeof emptyTutor;
  isNew: boolean;
  subjects: Subject[];
  onChange: (form: typeof emptyTutor) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-primary/10 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold text-foreground">{isNew ? 'Tambah Tutor' : 'Edit Tutor'}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="space-y-3">
            <TextInput label="Name" value={form.full_name} onChange={(v) => onChange({ ...form, full_name: v })} required />
            <SelectInput label="Subject" value={form.subject_id} onChange={(v) => onChange({ ...form, subject_id: v })} required>
              <option value="">Choose subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </SelectInput>
            <TextInput label="Hourly Rate" type="number" value={String(form.hourly_rate)} onChange={(v) => onChange({ ...form, hourly_rate: Number(v) })} />
            <TextInput label="Rating" type="number" value={String(form.rating)} onChange={(v) => onChange({ ...form, rating: Number(v) })} />
            <TextInput label="Reviews" type="number" value={String(form.reviews_count)} onChange={(v) => onChange({ ...form, reviews_count: Number(v) })} />
            <TextInput label="Image URL" value={form.image_url} onChange={(v) => onChange({ ...form, image_url: v })} />
            <TextArea label="Bio" value={form.bio} onChange={(v) => onChange({ ...form, bio: v })} />
          </div>
          <div className="mt-5 flex gap-3 justify-end">
            <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary hover:bg-secondary transition">
              Cancel
            </button>
            <button type="submit" className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 transition">
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AvailabilityPanel({ slots }: { slots: TutorAvailabilitySlot[] }) {
  return (
    <section className="mt-6">
      <DataTable headers={['Subject', 'Tutor', 'Schedule', 'Location', 'Total Price', 'Capacity', 'Status']}>
        {slots.map((slot) => (
          <tr key={slot.id}>
            <Cell strong>{slot.subject_name}</Cell>
            <Cell>{slot.tutor_name}</Cell>
            <Cell>{formatDate(slot.starts_at)} {formatTimeRange(slot.starts_at, slot.ends_at)}</Cell>
            <Cell>{slot.location}</Cell>
            <Cell>{formatCurrency(slot.price_total)}</Cell>
            <Cell>{slot.max_participants} siswa</Cell>
            <Cell>{slot.status}</Cell>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function BookingsPanel({ bookings, onStatusChange }: { bookings: Booking[]; onStatusChange: (id: string, status: BookingStatus) => void }) {
  return (
    <section className="mt-6">
      <DataTable headers={['Student', 'Session', 'Total', 'Status']}>
        {bookings.map((booking) => (
          <tr key={booking.id}>
            <Cell strong>{booking.student?.full_name ?? booking.student?.email ?? booking.student_id}</Cell>
            <Cell>{booking.session?.title ?? booking.session_id}</Cell>
            <Cell>{formatCurrency(booking.total_price)}</Cell>
            <td className="px-4 py-4">
              <select
                value={booking.status}
                onChange={(event) => onStatusChange(booking.id, event.target.value as BookingStatus)}
                className="h-9 rounded-lg border border-primary/20 bg-white px-3 text-sm font-semibold text-primary"
              >
                <option value="pending_payment">{bookingStatusLabel('pending_payment')}</option>
                <option value="upcoming">{bookingStatusLabel('upcoming')}</option>
                <option value="completed">{bookingStatusLabel('completed')}</option>
                <option value="cancelled">{bookingStatusLabel('cancelled')}</option>
              </select>
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function UsersPanel({ profiles, onRoleChange }: { profiles: Profile[]; onRoleChange: (id: string, role: UserRole) => void }) {
  return (
    <section className="mt-6">
      <DataTable headers={['Email', 'Name', 'Role']}>
        {profiles.map((profile) => (
          <tr key={profile.id}>
            <Cell strong>{profile.email}</Cell>
            <Cell>{profile.full_name}</Cell>
            <td className="px-4 py-4">
              <select
                value={profile.role}
                onChange={(event) => onRoleChange(profile.id, event.target.value as UserRole)}
                className="h-9 rounded-lg border border-primary/20 bg-white px-3 text-sm font-semibold text-primary"
              >
                <option value="student">Student</option>
                <option value="tutor">Tutor</option>
                <option value="admin">Admin</option>
              </select>
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function ReportsPanel({ reports }: { reports: Report[] }) {
  return (
    <section className="mt-6">
      <DataTable headers={['Type', 'Period Start', 'Period End', 'Created', 'Data Preview']}>
        {reports.map((report) => (
          <tr key={report.id}>
            <Cell strong>{report.report_type}</Cell>
            <Cell>{report.period_start}</Cell>
            <Cell>{report.period_end}</Cell>
            <Cell>{formatDate(report.created_at)}</Cell>
            <Cell>{formatReportData(report.data)}</Cell>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function AdminForm({ children, onCancel, onSubmit, title }: { children: React.ReactNode; onCancel?: () => void; onSubmit: (event: FormEvent) => void; title: string }) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-extrabold text-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
      <div className="mt-5 flex gap-3">
        <button type="submit" className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90">
          <Save className="h-4 w-4" />
          Save
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-primary hover:bg-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function DataTable({ children, headers }: { children: React.ReactNode; headers: string[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`px-4 py-4 ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{children || '-'}</td>;
}

function ActionCell({ onDelete, onEdit }: { onDelete: () => void; onEdit: () => void }) {
  return (
    <td className="px-4 py-4">
      <div className="flex gap-2">
        <button type="button" onClick={onEdit} className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-secondary">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-primary transition hover:bg-secondary" aria-label="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </td>
  );
}

function TextInput({
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
    <label className="block">
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

function TextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function SelectInput({
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
    <label className="block">
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

function formatReportData(data: unknown) {
  if (!data) {
    return '-';
  }

  const serialized = typeof data === 'string' ? data : JSON.stringify(data);
  return serialized.length > 80 ? `${serialized.slice(0, 80)}...` : serialized;
}
