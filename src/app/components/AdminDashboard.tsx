import { BookOpen, CalendarDays, ChevronDown, FileBarChart, GraduationCap, Home, LogOut, RefreshCcw, Save, Settings, ShieldCheck, SquarePen, Trash2, UserRound, Users, X } from 'lucide-react';
import logoUrl from '../../img/FYP_no_bg.png';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NoticeModal, type NoticeModalState } from './ui/NoticeModal';
import { ProfileView } from './ui/student-dashboard/ProfileView';
import { SettingsView } from './ui/student-dashboard/SettingsView';
import {
  Profile,
  Subject,
  TutorProfile,
  UserRole,
  deleteSubject,
  deleteTutorProfile,
  fetchProfiles,
  fetchSubjects,
  fetchTutorProfiles,
  formatCurrency,
  formatDate,
  formatTimeRange,
  updateProfileDetails,
  updateProfileRole,
  upsertSubject,
  upsertTutorProfile,
} from '../../lib/dashboardData';
import { supabase } from '../../lib/supabase';
import { TutorAvailabilitySlot, MatchmakingLobby, fetchAdminTutorAvailability, fetchMatchmakingLobbies } from '../../lib/matchmakingData';
import { Report, fetchReports } from '../../lib/paymentsReports';
import { readLocalCache, usePersistentState, writeLocalCache } from '../../lib/browserState';

type AdminTab = 'dashboard' | 'sessions' | 'tutors' | 'subjects' | 'bookings' | 'users' | 'reports' | 'profile' | 'settings';

const navigation: Array<{ label: string; icon: typeof Home; view: AdminTab }> = [
  { label: 'Dashboard', icon: Home, view: 'dashboard' },
  { label: 'Tutor Slots', icon: CalendarDays, view: 'sessions' },
  { label: 'Tutors', icon: GraduationCap, view: 'tutors' },
  { label: 'Subjects', icon: BookOpen, view: 'subjects' },
  { label: 'Bookings', icon: SquarePen, view: 'bookings' },
  { label: 'Users', icon: Users, view: 'users' },
  { label: 'Reports', icon: FileBarChart, view: 'reports' },
  { label: 'Profile', icon: UserRound, view: 'profile' },
  { label: 'Settings', icon: Settings, view: 'settings' },
];

const emptySubject = { name: '', code: '', description: '' };
const emptyTutor = { full_name: '', subject_id: '', hourly_rate: 0, rating: 0, reviews_count: 0, image_url: '', bio: '' };

function getDisplayName(email?: string) {
  if (!email) {
    return 'Admin';
  }

  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const stateKeyPrefix = user ? `admin-dashboard:${user.id}` : null;
  const [activeTab, setActiveTab] = usePersistentState<AdminTab>(stateKeyPrefix ? `${stateKeyPrefix}:active-tab` : null, 'dashboard');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [slots, setSlots] = useState<TutorAvailabilitySlot[]>([]);
  const [lobbies, setLobbies] = useState<MatchmakingLobby[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeModalState | null>(null);
  const [subjectForm, setSubjectForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:subject-form` : null, emptySubject);
  const [editingSubjectId, setEditingSubjectId] = usePersistentState<string | null>(stateKeyPrefix ? `${stateKeyPrefix}:editing-subject-id` : null, null);
  const [tutorForm, setTutorForm] = usePersistentState(stateKeyPrefix ? `${stateKeyPrefix}:tutor-form` : null, emptyTutor);
  const [editingTutorId, setEditingTutorId] = usePersistentState<string | null>(stateKeyPrefix ? `${stateKeyPrefix}:editing-tutor-id` : null, null);
  const [isAddingTutor, setIsAddingTutor] = useState(false);
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: '' });
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAdminData();
    } finally {
      setIsRefreshing(false);
    }
  };
  const displayName = getDisplayName(user?.email);
  const currentProfile = useMemo(() => profiles.find((profile) => profile.id === user?.id) ?? null, [profiles, user?.id]);
  const avatarUrl = currentProfile?.image_url || user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  useEffect(() => {
    const nextName = currentProfile?.full_name?.trim() || displayName;

    if (nextName && !profileForm.fullName) {
      setProfileForm({ fullName: nextName });
    }
  }, [currentProfile?.full_name, displayName, profileForm.fullName]);

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
          lobbies: MatchmakingLobby[];
          profiles: Profile[];
          reports: Report[];
        }>(cacheKey)
      : null;

    if (cachedData) {
      setSubjects(cachedData.subjects);
      setTutors(cachedData.tutors);
      setSlots(cachedData.slots);
      setLobbies(cachedData.lobbies);
      setProfiles(cachedData.profiles);
      setReports(cachedData.reports);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const [nextSubjects, nextTutors, nextSlots, nextLobbies, nextProfiles, nextReports] = await Promise.all([
        fetchSubjects(),
        fetchTutorProfiles(),
        fetchAdminTutorAvailability(),
        fetchMatchmakingLobbies(),
        fetchProfiles(),
        fetchReports(),
      ]);
      setSubjects(nextSubjects);
      setTutors(nextTutors);
      setSlots(nextSlots);
      setLobbies(nextLobbies);
      setProfiles(nextProfiles);
      setReports(nextReports);
      if (cacheKey) {
        writeLocalCache(cacheKey, {
          subjects: nextSubjects,
          tutors: nextTutors,
          slots: nextSlots,
          lobbies: nextLobbies,
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

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;

    setIsUploadingAvatar(true);
    setNotice(null);
    try {
      const { uploadAvatar } = await import('../../lib/storage');
      const { updateProfileDetails } = await import('../../lib/dashboardData');
      const newAvatarUrl = await uploadAvatar(file, user.id);

      await updateProfileDetails(user.id, { image_url: newAvatarUrl });

      await supabase.auth.updateUser({
        data: { custom_avatar_url: newAvatarUrl, avatar_url: newAvatarUrl },
      });

      showNotice('success', 'Foto profil berhasil diperbarui.');
      await loadAdminData();
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
      await updateProfileDetails(user.id, {
        full_name: trimmedName,
      });

      await loadAdminData();
      showNotice('success', 'Profil berhasil diperbarui.');
      setProfileForm({ fullName: '' });
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal memperbarui profil.');
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/40 text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <aside className="border-b border-primary/10 bg-white px-4 py-5 shadow-sm lg:border-b-0 lg:border-r">
          <div className="mb-7 flex items-center justify-between lg:block">
            <div className="flex h-14 items-center justify-start gap-1.5 rounded-lg bg-primary px-3.5 shadow-sm">
              <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain shrink-0" />
              <div className="flex flex-col gap-0 text-left font-extrabold leading-none">
                <span className="leading-none text-lg text-white">FYP</span>
                <span className="text-[12px] uppercase tracking-wide text-accent">Foundation</span>
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
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-white text-primary shadow-sm hover:bg-secondary"
                aria-label="Refresh"
              >
                <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="relative flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                  className="flex items-center gap-2 text-sm font-semibold text-primary transition-all duration-200 hover:text-primary/70 active:scale-95 focus:outline-none"
                >
                  {displayName}
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isHeaderDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <span className="inline-flex items-center rounded-full border border-primary/15 bg-secondary/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Admin
                </span>

                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="h-11 w-11 cursor-pointer rounded-full border border-primary/20 bg-white object-cover transition-all duration-200 hover:scale-105 hover:border-primary/50 active:scale-95"
                    onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-primary/10 transition-all duration-200 hover:scale-105 hover:bg-primary/20 active:scale-95"
                    onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                  >
                    <UserRound className="h-7 w-7 text-primary" />
                  </div>
                )}

                {isHeaderDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsHeaderDropdownOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-2 w-48 animate-in fade-in slide-in-from-top-2 rounded-xl border border-primary/10 bg-white p-2 shadow-lg duration-200">
                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderDropdownOpen(false);
                          void signOut();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
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
              editingId={editingTutorId}
              form={tutorForm}
              isAddingTutor={isAddingTutor}
              subjects={subjects}
              tutors={tutors}
              onAdd={() => {
                setEditingTutorId(null);
                setTutorForm(emptyTutor);
                setIsAddingTutor(true);
              }}
              onChange={setTutorForm}
              onSubmit={handleTutorSubmit}
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
              onCancel={() => {
                setEditingTutorId(null);
                setTutorForm(emptyTutor);
              }}
              onSetIsAddingTutor={setIsAddingTutor}
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
            <LobbyBookingsPanel lobbies={lobbies} />
          )}

          {activeTab === 'users' && (
            <UsersPanel
              profiles={profiles}
              onRoleChange={(id, role) => runAdminAction(() => updateProfileRole(id, role), 'User role updated.')}
            />
          )}

          {activeTab === 'reports' && <ReportsPanel reports={reports} />}
          {activeTab === 'profile' && (
            <ProfileView
              profileForm={profileForm}
              setProfileForm={setProfileForm}
              onProfileSave={handleProfileSave}
              onAvatarSelect={handleAvatarUpload}
              isSaving={isSavingName}
              isUploadingAvatar={isUploadingAvatar}
              avatarUrl={avatarUrl}
              profile={currentProfile}
            />
          )}
          {activeTab === 'settings' && <SettingsView showNotice={showNotice} />}
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
  editingId,
  form,
  isAddingTutor,
  onAdd,
  onCancel,
  onChange,
  onDelete,
  onEdit,
  onSubmit,
  onSetIsAddingTutor,
  subjects,
  tutors,
}: {
  editingId: string | null;
  form: typeof emptyTutor;
  isAddingTutor: boolean;
  onAdd: () => void;
  onCancel: () => void;
  onChange: (form: typeof emptyTutor) => void;
  onDelete: (id: string) => void;
  onEdit: (tutor: TutorProfile) => void;
  onSubmit: (event: FormEvent) => void;
  onSetIsAddingTutor: (value: boolean) => void;
  subjects: Subject[];
  tutors: TutorProfile[];
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

      {(editingId !== null || isAddingTutor) && (
        <TutorEditModal
          form={form}
          isNew={isAddingTutor}
          subjects={subjects}
          onChange={onChange}
          onSubmit={onSubmit}
          onCancel={() => {
            onSetIsAddingTutor(false);
            onCancel();
          }}
        />
      )}
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

type AvailabilitySortKey = 'subject_name' | 'tutor_name' | 'starts_at' | 'location' | 'price_total' | 'max_participants' | 'status';

function AvailabilityPanel({ slots }: { slots: TutorAvailabilitySlot[] }) {
  const [sortKey, setSortKey] = useState<AvailabilitySortKey>('starts_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedSlots = useMemo(() => {
    const compare = (left: TutorAvailabilitySlot, right: TutorAvailabilitySlot) => {
      let result = 0;

      switch (sortKey) {
        case 'subject_name':
          result = left.subject_name.localeCompare(right.subject_name);
          break;
        case 'tutor_name':
          result = left.tutor_name.localeCompare(right.tutor_name);
          break;
        case 'starts_at':
          result = new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime();
          break;
        case 'location':
          result = left.location.localeCompare(right.location);
          break;
        case 'price_total':
          result = left.price_total - right.price_total;
          break;
        case 'max_participants':
          result = left.max_participants - right.max_participants;
          break;
        case 'status':
          result = left.status.localeCompare(right.status);
          break;
      }

      return sortDirection === 'asc' ? result : -result;
    };

    return [...slots].sort(compare);
  }, [slots, sortDirection, sortKey]);

  const toggleSort = (nextSortKey: AvailabilitySortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection('asc');
  };

  const sortIndicator = (nextSortKey: AvailabilitySortKey) => {
    if (nextSortKey !== sortKey) {
      return <ChevronDown className="h-3 w-3 opacity-30" />;
    }

    return <ChevronDown className={`h-3 w-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />;
  };

  return (
    <section className="mt-6">
      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('subject_name')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Subject {sortIndicator('subject_name')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('tutor_name')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Tutor {sortIndicator('tutor_name')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('starts_at')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Schedule {sortIndicator('starts_at')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('location')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Location {sortIndicator('location')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('price_total')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Total Price {sortIndicator('price_total')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('max_participants')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Capacity {sortIndicator('max_participants')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('status')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Status {sortIndicator('status')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedSlots.map((slot) => (
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
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LobbyBookingsPanel({ lobbies }: { lobbies: MatchmakingLobby[] }) {
  const lobbyStatusLabels: Record<string, string> = {
    open: 'Mencari Anggota',
    pending_payment: 'Menunggu Pembayaran',
    paid: 'Kelas Aktif',
    expired: 'Kadaluarsa',
    cancelled: 'Dibatalkan',
    completed: 'Selesai',
  };

  return (
    <section className="mt-6">
      <DataTable headers={['Lobby', 'Subject', 'Tutor', 'Members', 'Price/Person', 'Status']}>
        {lobbies.map((lobby) => (
          <tr key={lobby.id}>
            <Cell strong>{lobby.title}</Cell>
            <Cell>{lobby.subject_name}</Cell>
            <Cell>{lobby.tutor_name}</Cell>
            <Cell>{lobby.member_count ?? 0}/{lobby.max_participants}</Cell>
            <Cell>{formatCurrency(lobby.price_per_member)}</Cell>
            <td className="px-4 py-4">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                lobby.status === 'paid' ? 'bg-green-100 text-green-700' :
                lobby.status === 'pending_payment' ? 'bg-amber-100 text-amber-700' :
                lobby.status === 'cancelled' || lobby.status === 'expired' ? 'bg-red-100 text-red-700' :
                lobby.status === 'open' ? 'bg-blue-100 text-blue-700' :
                'bg-secondary text-primary'
              }`}>
                {lobbyStatusLabels[lobby.status] ?? lobby.status}
              </span>
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
