import { BookOpen, CalendarDays, GraduationCap, LogOut, RefreshCcw, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Booking,
  BookingStatus,
  Profile,
  Subject,
  TutorProfile,
  TutorStatus,
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

type AdminTab = 'sessions' | 'tutors' | 'subjects' | 'bookings' | 'users' | 'reports';

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: 'sessions', label: 'Tutor Slots' },
  { id: 'tutors', label: 'Tutors' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'users', label: 'Users' },
  { id: 'reports', label: 'Reports' },
];

const emptySubject = { name: '', code: '', description: '' };
const emptyTutor = { full_name: '', subject_id: '', hourly_rate: 0, rating: 0, reviews_count: 0, image_url: '', bio: '', status: 'pending' as TutorStatus };

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const stateKeyPrefix = user ? `admin-dashboard:${user.id}` : null;
  const [activeTab, setActiveTab] = usePersistentState<AdminTab>(stateKeyPrefix ? `${stateKeyPrefix}:active-tab` : null, 'sessions');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [subjectForm, setSubjectForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:subject-form` : null, emptySubject);
  const [editingSubjectId, setEditingSubjectId] = usePersistentState<string | null>(stateKeyPrefix ? `${stateKeyPrefix}:editing-subject-id` : null, null);
  const [tutorForm, setTutorForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:tutor-form` : null, emptyTutor);
  const [editingTutorId, setEditingTutorId] = usePersistentState<string | null>(stateKeyPrefix ? `${stateKeyPrefix}:editing-tutor-id` : null, null);

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
      setNotice(error instanceof Error ? error.message : 'Gagal memuat admin dashboard.');
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
      { label: 'Active Tutors', value: String(tutors.filter((tutor) => tutor.status === 'approved').length), icon: GraduationCap },
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
        ...tutorForm,
        hourly_rate: Number(tutorForm.hourly_rate),
        rating: Number(tutorForm.rating),
        reviews_count: Number(tutorForm.reviews_count),
        image_url: tutorForm.image_url || null,
        bio: tutorForm.bio || null,
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
      setNotice(successMessage);
      await loadAdminData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Admin action failed.');
    }
  };

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#admin" className="flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">Admin</p>
              <p className="text-lg font-extrabold text-foreground">FYP Foundation</p>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <button
              type="button"
              onClick={() => void loadAdminData()}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-primary transition hover:bg-secondary"
              aria-label="Refresh"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-primary transition hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">Dashboard</p>
            <h1 className="mt-2 text-foreground">Admin Control Center</h1>
          </div>
          <p className="rounded-lg border border-primary/10 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm">
            {isLoading ? 'Loading database...' : 'Connected to Supabase'}
          </p>
        </section>

        {notice && <div className="mb-5 rounded-lg border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm">{notice}</div>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <article key={stat.label} className="rounded-lg border border-border bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-extrabold text-foreground">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{stat.label}</p>
              </article>
            );
          })}
        </section>

        <div className="mt-8 flex gap-2 overflow-x-auto border-b border-primary/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-w-max border-b-2 px-4 pb-3 text-sm font-semibold ${
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'sessions' && (
          <AvailabilityPanel slots={slots} />
        )}

        {activeTab === 'tutors' && (
          <TutorsPanel
            editingId={editingTutorId}
            form={tutorForm}
            subjects={subjects}
            tutors={tutors}
            onChange={setTutorForm}
            onSubmit={handleTutorSubmit}
            onEdit={(tutor) => {
              setEditingTutorId(tutor.id);
              setTutorForm({
                full_name: tutor.full_name,
                subject_id: tutor.subject_id ?? '',
                hourly_rate: tutor.hourly_rate,
                rating: tutor.rating,
                reviews_count: tutor.reviews_count,
                image_url: tutor.image_url ?? '',
                bio: tutor.bio ?? '',
                status: tutor.status,
              });
            }}
            onDelete={(id) => runAdminAction(() => deleteTutorProfile(id), 'Tutor deleted.')}
            onCancel={() => {
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
        {activeTab === 'reports' && (
          <ReportsPanel reports={reports} />
        )}
      </main>
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
  editingId,
  form,
  onCancel,
  onChange,
  onDelete,
  onEdit,
  onSubmit,
  subjects,
  tutors,
}: {
  editingId: string | null;
  form: typeof emptyTutor;
  onCancel: () => void;
  onChange: (form: typeof emptyTutor) => void;
  onDelete: (id: string) => void;
  onEdit: (tutor: TutorProfile) => void;
  onSubmit: (event: FormEvent) => void;
  subjects: Subject[];
  tutors: TutorProfile[];
}) {
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
      <AdminForm title={editingId ? 'Edit Tutor' : 'Add Tutor'} onSubmit={onSubmit} onCancel={editingId ? onCancel : undefined}>
        <TextInput label="Name" value={form.full_name} onChange={(value) => onChange({ ...form, full_name: value })} required />
        <SelectInput label="Subject" value={form.subject_id} onChange={(value) => onChange({ ...form, subject_id: value })} required>
          <option value="">Choose subject</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>{subject.name}</option>
          ))}
        </SelectInput>
        <TextInput label="Hourly Rate" type="number" value={String(form.hourly_rate)} onChange={(value) => onChange({ ...form, hourly_rate: Number(value) })} />
        <TextInput label="Rating" type="number" value={String(form.rating)} onChange={(value) => onChange({ ...form, rating: Number(value) })} />
        <TextInput label="Reviews" type="number" value={String(form.reviews_count)} onChange={(value) => onChange({ ...form, reviews_count: Number(value) })} />
        <SelectInput label="Status" value={form.status} onChange={(value) => onChange({ ...form, status: value as TutorStatus })}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </SelectInput>
        <TextInput label="Image URL" value={form.image_url} onChange={(value) => onChange({ ...form, image_url: value })} />
        <TextArea label="Bio" value={form.bio} onChange={(value) => onChange({ ...form, bio: value })} />
      </AdminForm>

      <DataTable headers={['Name', 'Subject', 'Rate', 'Status', 'Actions']}>
        {tutors.map((tutor) => (
          <tr key={tutor.id}>
            <Cell strong>{tutor.full_name}</Cell>
            <Cell>{tutor.subject?.name ?? '-'}</Cell>
            <Cell>{formatCurrency(tutor.hourly_rate)}</Cell>
            <Cell>{tutor.status}</Cell>
            <ActionCell onEdit={() => onEdit(tutor)} onDelete={() => onDelete(tutor.id)} />
          </tr>
        ))}
      </DataTable>
    </section>
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
