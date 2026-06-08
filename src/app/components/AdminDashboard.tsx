import { BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Eye, FileBarChart, GraduationCap, Home, List, LogOut, RefreshCcw, Save, Settings, ShieldCheck, SquarePen, Trash2, UserRound, Users, X } from 'lucide-react';
import logoUrl from '../../img/FYP_no_bg.png';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NoticeModal, type NoticeModalState } from './ui/NoticeModal';
import { ProfileView } from './ui/student-dashboard/ProfileView';
import { SettingsView } from './ui/SettingsView';
import {
  Profile,
  Subject,
  TutorProfile,
  UserRole,
  deleteSubject,
  deleteTutorProfile,
  deleteUserAccount,
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
import { TutorAvailabilitySlot, MatchmakingLobby, fetchAdminTutorAvailability, fetchLobbyStudents, fetchMatchmakingLobbies, SlotStudent, deleteTutorAvailability } from '../../lib/matchmakingData';
import { Report, fetchReports, PaidPayment, fetchPaidPayments, fetchAllPaymentsWithTutorInfo } from '../../lib/paymentsReports';
import { readLocalCache, usePersistentState, writeLocalCache } from '../../lib/browserState';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  ChartOptions,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  TooltipItem,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

type AdminTab = 'dashboard' | 'sessions' | 'tutors' | 'subjects' | 'bookings' | 'users' | 'reports' | 'profile' | 'settings';

const navigation: Array<{ label: string; icon: typeof Home; view: AdminTab }> = [
  { label: 'Dashboard', icon: Home, view: 'dashboard' },
  { label: 'Tutor Slots', icon: CalendarDays, view: 'sessions' },
  { label: 'Tutors', icon: GraduationCap, view: 'tutors' },
  { label: 'Mata Kuliah', icon: BookOpen, view: 'subjects' },
  { label: 'Bookings', icon: SquarePen, view: 'bookings' },
  { label: 'Users', icon: Users, view: 'users' },
  { label: 'Laporan', icon: FileBarChart, view: 'reports' },
  { label: 'Profil', icon: UserRound, view: 'profile' },
  { label: 'Pengaturan', icon: Settings, view: 'settings' },
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
  const [paidPayments, setPaidPayments] = useState<PaidPayment[]>([]);
  const [allPayments, setAllPayments] = useState<PaidPayment[]>([]);
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
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

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
      const [nextSubjects, nextTutors, nextSlots, nextLobbies, nextProfiles, nextReports, nextPaidPayments, nextAllPayments] = await Promise.all([
        fetchSubjects(),
        fetchTutorProfiles(),
        fetchAdminTutorAvailability(),
        fetchMatchmakingLobbies(),
        fetchProfiles(),
        fetchReports(),
        fetchPaidPayments().catch(() => [] as PaidPayment[]),
        fetchAllPaymentsWithTutorInfo().catch(() => [] as PaidPayment[]),
      ]);
      setSubjects(nextSubjects);
      setTutors(nextTutors);
      setSlots(nextSlots);
      setLobbies(nextLobbies);
      setProfiles(nextProfiles);
      setReports(nextReports);
      setPaidPayments(nextPaidPayments);
      setAllPayments(nextAllPayments);
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

  const handleDeleteUser = async (profile: Profile) => {
    if (profile.id === user?.id) {
      showNotice('error', 'Akun admin yang sedang dipakai tidak dapat dihapus.');
      return;
    }

    setDeletingUserId(profile.id);
    setNotice(null);
    try {
      await deleteUserAccount(profile.id);
      showNotice('success', `User ${profile.email ?? profile.full_name ?? profile.id} berhasil dihapus.`);
      await loadAdminData();
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Gagal menghapus user.');
    } finally {
      setDeletingUserId(null);
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

          {activeTab === 'sessions' && <AvailabilityPanel slots={slots} onRefresh={loadAdminData} />}

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
              currentUserId={user?.id}
              deletingUserId={deletingUserId}
              profiles={profiles}
              onDeleteUser={handleDeleteUser}
              onRoleChange={(id, role) => runAdminAction(() => updateProfileRole(id, role), 'User role updated.')}
            />
          )}

          {activeTab === 'reports' && <ReportsPanel reports={reports} paidPayments={paidPayments} allPayments={allPayments} />}
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenAdd = () => {
    onCancel();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (subject: Subject) => {
    onEdit(subject);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    onCancel();
  };

  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">{subjects.length} mata kuliah terdaftar</p>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 transition"
        >
          <BookOpen className="h-4 w-4" />
          Tambah Mata Kuliah
        </button>
      </div>

      <DataTable headers={['Nama', 'Kode', 'Deskripsi', 'Aksi']}>
        {subjects.map((subject) => (
          <tr key={subject.id}>
            <Cell strong>{subject.name}</Cell>
            <Cell>{subject.code}</Cell>
            <Cell>{subject.description}</Cell>
            <ActionCell onEdit={() => handleOpenEdit(subject)} onDelete={() => onDelete(subject.id)} />
          </tr>
        ))}
      </DataTable>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-primary/10 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-extrabold text-foreground">{editingId ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah'}</h2>
              <button type="button" onClick={handleClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(e) => { onSubmit(e); if (!editingId) handleClose(); }}>
              <div className="space-y-3">
                <TextInput label="Nama" value={form.name} onChange={(value) => onChange({ ...form, name: value })} required />
                <TextInput label="Kode" value={form.code} onChange={(value) => onChange({ ...form, code: value })} />
                <TextArea label="Deskripsi" value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
              </div>
              <div className="mt-5 flex gap-3 justify-end">
                <button type="button" onClick={handleClose} className="h-10 rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary hover:bg-secondary transition">
                  Batal
                </button>
                <button type="submit" className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 transition">
                  <Save className="h-4 w-4" />
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

type AvailabilityViewMode = 'table' | 'calendar';

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
    return { key: getDateKey(date), date, isCurrentMonth: date.getMonth() === month };
  });
}

function formatCalendarHeading(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
}

const slotStatusLabels: Record<string, string> = {
  available: 'Tersedia',
  held: 'Lobby Terbuat',
  booked: 'Terbooking',
  cancelled: 'Dibatalkan',
};

function AvailabilityPanel({ slots, onRefresh }: { slots: TutorAvailabilitySlot[]; onRefresh: () => Promise<void> }) {
  const [viewMode, setViewMode] = useState<AvailabilityViewMode>('table');
  const [sortKey, setSortKey] = useState<AvailabilitySortKey>('starts_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTutor, setSelectedTutor] = useState('all');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<TutorAvailabilitySlot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState<NoticeModalState | null>(null);

  const handleDeleteSlot = async (slot: TutorAvailabilitySlot) => {
    setConfirmDeleteSlot(null);
    setIsDeleting(true);
    try {
      await deleteTutorAvailability(slot.id);
      setNotice({ tone: 'success', message: 'Slot jadwal berhasil dihapus.' });
      await onRefresh();
    } catch (err) {
      setNotice({ tone: 'error', message: err instanceof Error ? err.message : 'Gagal menghapus slot.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const subjectOptions = useMemo(
    () => ['all', ...Array.from(new Set(slots.map((s) => s.subject_name))).sort((a, b) => a.localeCompare(b, 'id-ID'))],
    [slots],
  );
  const tutorOptions = useMemo(
    () => ['all', ...Array.from(new Set(slots.map((s) => s.tutor_name))).sort((a, b) => a.localeCompare(b, 'id-ID'))],
    [slots],
  );

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (selectedSubject !== 'all' && slot.subject_name !== selectedSubject) return false;
      if (selectedTutor !== 'all' && slot.tutor_name !== selectedTutor) return false;
      return true;
    });
  }, [selectedSubject, selectedTutor, slots]);

  const sortedSlots = useMemo(() => {
    const compare = (left: TutorAvailabilitySlot, right: TutorAvailabilitySlot) => {
      let result = 0;
      switch (sortKey) {
        case 'subject_name': result = left.subject_name.localeCompare(right.subject_name); break;
        case 'tutor_name': result = left.tutor_name.localeCompare(right.tutor_name); break;
        case 'starts_at': result = new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(); break;
        case 'location': result = left.location.localeCompare(right.location); break;
        case 'price_total': result = left.price_total - right.price_total; break;
        case 'max_participants': result = left.max_participants - right.max_participants; break;
        case 'status': result = left.status.localeCompare(right.status); break;
      }
      return sortDirection === 'asc' ? result : -result;
    };
    return [...filteredSlots].sort(compare);
  }, [filteredSlots, sortDirection, sortKey]);

  const monthSessions = useMemo(
    () => filteredSlots.filter((slot) => {
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
  const selectedDateSessions = selectedDateKey ? groupedByDay.get(selectedDateKey) ?? [] : [];

  const toggleSort = (nextSortKey: AvailabilitySortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection('asc');
  };

  const sortIndicator = (nextSortKey: AvailabilitySortKey) => {
    if (nextSortKey !== sortKey) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return <ChevronDown className={`h-3 w-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />;
  };

  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${viewMode === 'table' ? 'bg-primary text-white' : 'border border-primary/20 text-primary hover:bg-secondary'}`}
          >
            <List className="h-4 w-4" />
            Tabel
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${viewMode === 'calendar' ? 'bg-primary text-white' : 'border border-primary/20 text-primary hover:bg-secondary'}`}
          >
            <CalendarDays className="h-4 w-4" />
            Kalender
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-primary/10 bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm">
          <span>{filteredSlots.length} slot</span>
        </div>
      </div>

      {viewMode === 'table' && (
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
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
                      Jadwal {sortIndicator('starts_at')}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleSort('location')} className="flex items-center gap-1 font-semibold hover:text-primary">
                      Lokasi {sortIndicator('location')}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleSort('price_total')} className="flex items-center gap-1 font-semibold hover:text-primary">
                      Harga Total {sortIndicator('price_total')}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleSort('max_participants')} className="flex items-center gap-1 font-semibold hover:text-primary">
                      Kapasitas {sortIndicator('max_participants')}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => toggleSort('status')} className="flex items-center gap-1 font-semibold hover:text-primary">
                      Status {sortIndicator('status')}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">Catatan</th>
                  <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedSlots.map((slot) => (
                  <tr key={slot.id} className={new Date(slot.ends_at).getTime() < Date.now() ? 'bg-red-50/40' : ''}>
                    <Cell strong>{slot.subject_name}</Cell>
                    <Cell>{slot.tutor_name}</Cell>
                    <Cell>{formatDate(slot.starts_at)} {formatTimeRange(slot.starts_at, slot.ends_at)}</Cell>
                    <Cell>{slot.location}</Cell>
                    <Cell>{formatCurrency(slot.price_total)}</Cell>
                    <Cell>{slot.max_participants} siswa</Cell>
                    <Cell>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        slot.status === 'available' ? 'bg-emerald-50 text-emerald-700' :
                        slot.status === 'held' ? 'bg-amber-50 text-amber-700' :
                        slot.status === 'booked' ? 'bg-blue-50 text-blue-700' :
                        new Date(slot.ends_at).getTime() < Date.now() ? 'bg-red-50 text-red-700' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {new Date(slot.ends_at).getTime() < Date.now() ? 'Kadaluarsa' : (slotStatusLabels[slot.status] ?? slot.status)}
                      </span>
                    </Cell>
                    <Cell>{slot.notes ?? '-'}</Cell>
                    <Cell className="text-right">
                      {(slot.status === 'available' || slot.status === 'cancelled' || new Date(slot.ends_at).getTime() < Date.now()) && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSlot(slot)}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition"
                          title="Hapus Slot"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="flex flex-col rounded-2xl border border-primary/10 bg-white p-3 shadow-md lg:p-4">
          <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 text-primary transition hover:bg-secondary" aria-label="Bulan sebelumnya">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 text-primary transition hover:bg-secondary" aria-label="Bulan berikutnya">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))} className="rounded-lg border border-primary/15 px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary">
                {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(currentMonth)}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:w-[380px]">
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mata Kuliah</span>
                <select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)} className="h-8 w-full rounded-lg border border-primary/15 bg-white px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15">
                  <option value="all">Semua Matkul</option>
                  {subjectOptions.slice(1).map((subject) => (<option key={subject} value={subject}>{subject}</option>))}
                </select>
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tutor</span>
                <select value={selectedTutor} onChange={(event) => setSelectedTutor(event.target.value)} className="h-8 w-full rounded-lg border border-primary/15 bg-white px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15">
                  <option value="all">Semua Tutor</option>
                  {tutorOptions.slice(1).map((tutor) => (<option key={tutor} value={tutor}>{tutor}</option>))}
                </select>
              </label>
            </div>
          </div>

          <div className="relative flex flex-col rounded-2xl border border-primary/10">
            <div className="grid grid-cols-7 border-b border-primary/10 bg-secondary/60 rounded-t-2xl">
              {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
                <div key={day} className="px-2 py-1.5 text-center text-xs font-bold text-foreground">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1">
              {calendarDays.map((day) => {
                const daySessions = groupedByDay.get(day.key) ?? [];
                const isToday = day.key === getDateKey(today);
                const isSelected = selectedDateKey === day.key;
                const hasSessions = daySessions.length > 0;
                return (
                  <div
                    key={day.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => hasSessions && setSelectedDateKey((prev) => (prev === day.key ? null : day.key))}
                    onKeyDown={(e) => { if (hasSessions && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedDateKey((prev) => (prev === day.key ? null : day.key)); } }}
                    className={`relative border-b border-r border-primary/10 p-2 text-left align-top transition ${day.isCurrentMonth ? isSelected ? 'bg-primary/[0.08] ring-1 ring-inset ring-primary/30' : 'bg-white hover:bg-secondary/40' : 'bg-secondary/30 text-muted-foreground/70'} ${hasSessions ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${isToday ? 'bg-primary text-white' : isSelected ? 'bg-primary/15 text-primary' : 'text-foreground'}`}>
                        {day.date.getDate()}
                      </span>
                      {hasSessions && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{daySessions.length}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedDateKey && (
            <div className="mt-4 rounded-2xl border border-primary/15 bg-white p-5 shadow-lg">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{selectedDateSessions.length} Sesi</p>
                  <h2 className="mt-1 text-xl font-extrabold text-foreground">{formatCalendarHeading(selectedDateKey)}</h2>
                </div>
                <button type="button" onClick={() => setSelectedDateKey(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Tutup panel">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {selectedDateSessions.length === 0 ? (
                <p className="py-6 text-center text-sm font-medium text-muted-foreground">Tidak ada sesi pada tanggal ini.</p>
              ) : (
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {selectedDateSessions.map((session) => (
                    <article key={session.id} className={`rounded-xl border bg-white p-4 shadow-sm ${new Date(session.ends_at).getTime() < Date.now() ? 'border-red-200 bg-red-50/30' : 'border-primary/10'}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
                            session.status === 'available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            session.status === 'held' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            session.status === 'booked' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            new Date(session.ends_at).getTime() < Date.now() ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-muted text-muted-foreground border-border'
                          }`}>
                            {new Date(session.ends_at).getTime() < Date.now() ? 'Kadaluarsa' : (slotStatusLabels[session.status] ?? session.status)}
                          </span>
                          <span className="text-sm font-bold text-primary">{formatCurrency(session.price_total)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatTimeRange(session.starts_at, session.ends_at)}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{session.subject_name} — {session.tutor_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{session.location} · Maks {session.max_participants} siswa</p>
                      {session.notes && <p className="mt-2 rounded-lg bg-secondary p-2 text-xs text-muted-foreground">{session.notes}</p>}
                      {(session.status === 'available' || session.status === 'cancelled' || new Date(session.ends_at).getTime() < Date.now()) && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSlot(session)}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus Slot
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {monthSessions.length === 0 && (
            <div className="mt-4 rounded-xl border border-primary/10 bg-secondary/30 px-4 py-3 text-sm font-medium text-muted-foreground">
              Tidak ada slot pada bulan ini.
            </div>
          )}
        </div>
      )}
      {confirmDeleteSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-primary/10 bg-white p-5 shadow-xl">
            <h2 className="mb-2 text-lg font-extrabold text-foreground">Hapus Slot Permanen?</h2>
            <p className="mb-5 text-sm font-medium text-muted-foreground">
              Slot <span className="font-semibold text-foreground">{confirmDeleteSlot.subject_name}</span> oleh{' '}
              <span className="font-semibold text-foreground">{confirmDeleteSlot.tutor_name}</span> pada{' '}
              <span className="font-semibold text-foreground">{formatDate(confirmDeleteSlot.starts_at)}</span>{' '}
              ({formatTimeRange(confirmDeleteSlot.starts_at, confirmDeleteSlot.ends_at)}) akan dihapus secara permanen.
              Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDeleteSlot(null)}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary transition"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSlot(confirmDeleteSlot)}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:cursor-not-allowed disabled:bg-red-300"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && <NoticeModal notice={notice} onClose={() => setNotice(null)} />}
    </section>
  );
}

type LobbySortKey = 'title' | 'subject_name' | 'tutor_name' | 'member_count' | 'price_per_member' | 'status';

function LobbyBookingsPanel({ lobbies }: { lobbies: MatchmakingLobby[] }) {
  const [sortKey, setSortKey] = useState<LobbySortKey>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [studentModalLobby, setStudentModalLobby] = useState<MatchmakingLobby | null>(null);
  const [students, setStudents] = useState<SlotStudent[] | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  const activeLobbies = useMemo(
    () => lobbies.filter((lobby) => ['open', 'pending_payment', 'paid'].includes(lobby.status)),
    [lobbies],
  );

  const sortedLobbies = useMemo(() => {
    const compare = (left: MatchmakingLobby, right: MatchmakingLobby) => {
      let result = 0;
      switch (sortKey) {
        case 'title':
          result = left.title.localeCompare(right.title);
          break;
        case 'subject_name':
          result = left.subject_name.localeCompare(right.subject_name);
          break;
        case 'tutor_name':
          result = left.tutor_name.localeCompare(right.tutor_name);
          break;
        case 'member_count':
          result = (left.member_count ?? 0) - (right.member_count ?? 0);
          break;
        case 'price_per_member':
          result = left.price_per_member - right.price_per_member;
          break;
        case 'status':
          result = left.status.localeCompare(right.status);
          break;
      }
      return sortDirection === 'asc' ? result : -result;
    };
    return [...activeLobbies].sort(compare);
  }, [activeLobbies, sortDirection, sortKey]);

  const toggleSort = (nextSortKey: LobbySortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection('asc');
  };

  const sortIndicator = (nextSortKey: LobbySortKey) => {
    if (nextSortKey !== sortKey) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return <ChevronDown className={`h-3 w-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />;
  };

  const handleViewStudents = async (lobby: MatchmakingLobby) => {
    setStudentModalLobby(lobby);
    setLoadingStudents(true);
    setStudentError(null);
    setStudents(null);
    try {
      const data = await fetchLobbyStudents(lobby.id, lobby.tutor_user_id);
      setStudents(data);
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : 'Gagal memuat daftar siswa.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const lobbyStatusLabels: Record<string, string> = {
    open: 'Mencari Anggota',
    pending_payment: 'Menunggu Pembayaran',
    paid: 'Kelas Aktif',
  };

  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">{activeLobbies.length} lobby aktif</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('title')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Lobby {sortIndicator('title')}
                  </button>
                </th>
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
                  <button type="button" onClick={() => toggleSort('member_count')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Anggota {sortIndicator('member_count')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('price_per_member')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Harga/Orang {sortIndicator('price_per_member')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('status')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Status {sortIndicator('status')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">Siswa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedLobbies.map((lobby) => (
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
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {lobbyStatusLabels[lobby.status] ?? lobby.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => void handleViewStudents(lobby)}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-secondary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Lihat Siswa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {studentModalLobby && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4" onClick={() => setStudentModalLobby(null)}>
          <div className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-5 shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground">Daftar Siswa</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {studentModalLobby.title} · {studentModalLobby.subject_name}
                </p>
                {studentModalLobby.description && (
                  <p className="mt-1 text-xs text-muted-foreground italic">{studentModalLobby.description}</p>
                )}
              </div>
              <button type="button" onClick={() => setStudentModalLobby(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1">
              {loadingStudents && <div className="py-10 text-center text-sm font-medium text-muted-foreground">Memuat daftar siswa...</div>}
              {!loadingStudents && studentError && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">{studentError}</div>}
              {!loadingStudents && students && students.length === 0 && <div className="py-10 text-center text-sm font-medium text-muted-foreground">Belum ada siswa yang bergabung.</div>}
              {!loadingStudents && students && students.length > 0 && (
                <div className="space-y-2">
                  {students.map((s) => (
                    <div key={s.student_id} className="flex items-center gap-3 rounded-lg border border-primary/10 bg-secondary/30 px-4 py-3">
                      {s.student_image_url ? (
                        <img src={s.student_image_url} alt={s.student_name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {s.student_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{s.student_name}</p>
                          {s.payment_status && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${s.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {s.payment_status === 'paid' ? 'Lunas' : 'Belum Lunas'}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{s.student_email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type UserSortKey = 'email' | 'full_name' | 'role';

function UsersPanel({
  profiles,
  onRoleChange,
  onDeleteUser,
  currentUserId,
  deletingUserId,
}: {
  profiles: Profile[];
  onRoleChange: (id: string, role: UserRole) => void;
  onDeleteUser: (profile: Profile) => void | Promise<void>;
  currentUserId?: string;
  deletingUserId?: string | null;
}) {
  const [sortKey, setSortKey] = useState<UserSortKey>('email');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<Profile | null>(null);

  const sortedProfiles = useMemo(() => {
    const compare = (left: Profile, right: Profile) => {
      let result = 0;
      switch (sortKey) {
        case 'email':
          result = (left.email ?? '').localeCompare(right.email ?? '');
          break;
        case 'full_name':
          result = (left.full_name ?? '').localeCompare(right.full_name ?? '');
          break;
        case 'role':
          result = left.role.localeCompare(right.role);
          break;
      }
      return sortDirection === 'asc' ? result : -result;
    };
    return [...profiles].sort(compare);
  }, [profiles, sortDirection, sortKey]);

  const toggleSort = (nextSortKey: UserSortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection('asc');
  };

  const sortIndicator = (nextSortKey: UserSortKey) => {
    if (nextSortKey !== sortKey) return <ChevronDown className="h-3 w-3 opacity-30" />;
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
                  <button type="button" onClick={() => toggleSort('email')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Email {sortIndicator('email')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('full_name')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Nama {sortIndicator('full_name')}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort('role')} className="flex items-center gap-1 font-semibold hover:text-primary">
                    Role {sortIndicator('role')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedProfiles.map((profile) => (
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
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteProfile(profile)}
                      disabled={profile.id === currentUserId || deletingUserId === profile.id}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                      title={profile.id === currentUserId ? 'Akun aktif tidak dapat dihapus' : 'Hapus user'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDeleteProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4">
          <div className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-foreground">Hapus User?</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Tindakan ini akan menghapus data user dari dashboard admin dan mencoba membersihkan data terkait yang dimiliki user tersebut.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteProfile(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-900">{confirmDeleteProfile.full_name || 'Tanpa Nama'}</p>
              <p className="mt-1 text-sm text-red-800">{confirmDeleteProfile.email || confirmDeleteProfile.id}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-red-700">{confirmDeleteProfile.role}</p>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteProfile(null)}
                className="h-10 rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary transition hover:bg-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const profile = confirmDeleteProfile;
                  setConfirmDeleteProfile(null);
                  await onDeleteUser(profile);
                }}
                disabled={deletingUserId === confirmDeleteProfile.id}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                <Trash2 className="h-4 w-4" />
                {deletingUserId === confirmDeleteProfile.id ? 'Menghapus...' : 'Ya, Hapus User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type ReportPeriod = 'day' | 'week' | 'month';

function getPeriodKey(date: Date, period: ReportPeriod) {
  if (period === 'day') {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }
  if (period === 'week') {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(weekStart)} – ${new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(weekEnd)}`;
  }
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
}

function getPeriodSortKey(date: Date, period: ReportPeriod) {
  if (period === 'day') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  if (period === 'week') {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function ReportsPanel({ paidPayments, reports, allPayments }: { paidPayments: PaidPayment[]; reports: Report[]; allPayments: PaidPayment[] }) {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [detailPage, setDetailPage] = useState(1);
  const DETAIL_PAGE_SIZE = 15;

  const aggregated = useMemo(() => {
    const groups = new Map<string, { label: string; sortKey: string; count: number; revenue: number }>();
    for (const payment of paidPayments) {
      const dateStr = payment.paid_at ?? payment.created_at;
      if (!dateStr) continue;
      const date = new Date(dateStr);
      const label = getPeriodKey(date, period);
      const sortKey = getPeriodSortKey(date, period);
      const existing = groups.get(sortKey);
      if (existing) {
        existing.count += 1;
        existing.revenue += payment.amount;
      } else {
        groups.set(sortKey, { label, sortKey, count: 1, revenue: payment.amount });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [paidPayments, period]);

  const subjectBreakdown = useMemo(() => {
    const groups = new Map<string, number>();
    for (const payment of paidPayments) {
      const subject = payment.lobby?.subject_name ?? 'Lainnya';
      groups.set(subject, (groups.get(subject) ?? 0) + payment.amount);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [paidPayments]);

  // Tutor-level revenue breakdown using allPayments which has tutor info
  const tutorBreakdown = useMemo(() => {
    const groups = new Map<string, { name: string; count: number; revenue: number }>();
    for (const payment of allPayments) {
      if (payment.status !== 'paid') continue;
      const tutorName = (payment as any).lobby?.tutor?.full_name ?? 'Tidak Diketahui';
      const existing = groups.get(tutorName);
      if (existing) {
        existing.count += 1;
        existing.revenue += payment.amount;
      } else {
        groups.set(tutorName, { name: tutorName, count: 1, revenue: payment.amount });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.revenue - a.revenue);
  }, [allPayments]);

  // Detailed payment list (sorted newest first)
  const detailPayments = useMemo(() => {
    return [...allPayments]
      .filter((p) => p.status === 'paid')
      .sort((a, b) => {
        const dateA = a.paid_at ?? a.created_at;
        const dateB = b.paid_at ?? b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [allPayments]);

  const detailTotalPages = Math.ceil(detailPayments.length / DETAIL_PAGE_SIZE);
  const paginatedDetails = useMemo(() => {
    const start = (detailPage - 1) * DETAIL_PAGE_SIZE;
    return detailPayments.slice(start, start + DETAIL_PAGE_SIZE);
  }, [detailPayments, detailPage]);

  const totalClasses = paidPayments.length;
  const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const avgRevenue = totalClasses > 0 ? Math.round(totalRevenue / totalClasses) : 0;
  const refundedTotal = allPayments
    .filter((p) => p.status === 'refunded')
    .reduce((sum, p) => sum + p.amount, 0);
  const netGrossRevenue = totalRevenue - refundedTotal;
  const platformFee = Math.round(netGrossRevenue * 0.2);
  const tutorNetIncome = Math.round(netGrossRevenue * 0.8);

  const barChartData = useMemo(() => ({
    labels: aggregated.map((a) => a.label),
    datasets: [
      {
        label: 'Jumlah Kelas',
        data: aggregated.map((a) => a.count),
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }), [aggregated]);

  const lineChartData = useMemo(() => ({
    labels: aggregated.map((a) => a.label),
    datasets: [
      {
        label: 'Pendapatan',
        data: aggregated.map((a) => a.revenue),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }), [aggregated]);

  const doughnutColors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(34, 197, 94, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(20, 184, 166, 0.8)',
    'rgba(249, 115, 22, 0.8)',
  ];

  const doughnutChartData = useMemo(() => ({
    labels: subjectBreakdown.map((s) => s.name),
    datasets: [
      {
        label: 'Pendapatan per Mata Kuliah',
        data: subjectBreakdown.map((s) => s.value),
        backgroundColor: subjectBreakdown.map((_, i) => doughnutColors[i % doughnutColors.length]),
        borderColor: subjectBreakdown.map((_, i) => doughnutColors[i % doughnutColors.length].replace('0.8', '1')),
        borderWidth: 1,
      },
    ],
  }), [subjectBreakdown]);

  const getCartesianTooltipLabel = (ctx: TooltipItem<'bar'> | TooltipItem<'line'>) => {
    const numericValue = typeof ctx.parsed.y === 'number' ? ctx.parsed.y : 0;
    if (ctx.dataset.label === 'Pendapatan' || ctx.dataset.label === 'Pendapatan per Mata Kuliah') {
      return `${ctx.dataset.label}: ${formatCurrency(numericValue)}`;
    }
    return `${ctx.dataset.label}: ${numericValue}`;
  };

  const barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => getCartesianTooltipLabel(ctx),
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: string | number) => {
            const num = typeof value === 'string' ? Number(value) : value;
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}jt`;
            if (num >= 1000) return `${(num / 1000).toFixed(0)}rb`;
            return num;
          },
        },
      },
    },
  };

  const lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => getCartesianTooltipLabel(ctx),
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: string | number) => {
            const num = typeof value === 'string' ? Number(value) : value;
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}jt`;
            if (num >= 1000) return `${(num / 1000).toFixed(0)}rb`;
            return num;
          },
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { padding: 16, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: number; label: string }) => `${ctx.label}: ${formatCurrency(ctx.parsed)}`,
        },
      },
    },
  };

  return (
    <section className="mt-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-muted-foreground">{totalClasses} kelas terbayar</p>
        <div className="flex items-center gap-1 rounded-lg border border-primary/15 bg-white p-1">
          {(['day', 'week', 'month'] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${period === p ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {p === 'day' ? 'Harian' : p === 'week' ? 'Mingguan' : 'Bulanan'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="min-w-0 rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total Kelas</p>
          <p className="mt-2 truncate text-2xl font-extrabold text-foreground sm:text-3xl">{totalClasses}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pendapatan Kotor</p>
          <p className="mt-2 truncate text-2xl font-extrabold text-foreground sm:text-3xl">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Fee Platform (20%)</p>
          <p className="mt-2 truncate text-2xl font-extrabold text-amber-700 sm:text-3xl">{formatCurrency(platformFee)}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-green-700">Pendapatan Tutor (80%)</p>
          <p className="mt-2 truncate text-2xl font-extrabold text-green-700 sm:text-3xl">{formatCurrency(tutorNetIncome)}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-red-700">Dana Dikembalikan</p>
          <p className="mt-2 truncate text-2xl font-extrabold text-red-700 sm:text-3xl">{formatCurrency(refundedTotal)}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pendapatan Bersih Sistem</p>
          <p className="mt-2 truncate text-2xl font-extrabold text-foreground sm:text-3xl">{formatCurrency(platformFee)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-foreground">Jumlah Kelas per Periode</h3>
          {aggregated.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data pembayaran.</p>
          ) : (
            <div className="h-64">
              <Bar data={barChartData} options={barChartOptions} />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-foreground">Tren Pendapatan</h3>
          {aggregated.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data pembayaran.</p>
          ) : (
            <div className="h-64">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-foreground">Pendapatan per Mata Kuliah</h3>
        {subjectBreakdown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data pembayaran.</p>
        ) : (
          <div className="mx-auto h-72 max-w-md">
            <Doughnut data={doughnutChartData} options={doughnutOptions} />
          </div>
        )}
      </div>

      {tutorBreakdown.length > 0 && (
        <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-foreground">Pendapatan per Tutor</h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tutor</th>
                    <th className="px-4 py-3 font-semibold text-center">Jumlah Kelas</th>
                    <th className="px-4 py-3 font-semibold text-right">Pendapatan Kotor</th>
                    <th className="px-4 py-3 font-semibold text-right">Pendapatan Tutor (80%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tutorBreakdown.map((tutor) => (
                    <tr key={tutor.name}>
                      <td className="px-4 py-3 font-semibold text-foreground">{tutor.name}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{tutor.count}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(tutor.revenue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(Math.round(tutor.revenue * 0.8))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-foreground">Detail Pembayaran Kelas</h3>
          <p className="text-xs font-medium text-muted-foreground">{detailPayments.length} transaksi</p>
        </div>
        {detailPayments.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data pembayaran.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Tanggal</th>
                      <th className="px-4 py-3 font-semibold">Lobby</th>
                      <th className="px-4 py-3 font-semibold">Mata Kuliah</th>
                      <th className="px-4 py-3 font-semibold text-right">Jumlah</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedDetails.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {payment.paid_at ? formatDate(payment.paid_at) : formatDate(payment.created_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{payment.lobby?.title ?? '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{payment.lobby?.subject_name ?? '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(payment.amount)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                            Lunas
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {detailTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  Halaman {detailPage} dari {detailTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                    disabled={detailPage === 1}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/20 bg-white px-3 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="h-3 w-3" /> Sebelumnya
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailPage((p) => Math.min(detailTotalPages, p + 1))}
                    disabled={detailPage === detailTotalPages}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/20 bg-white px-3 text-xs font-semibold text-primary hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Selanjutnya <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {reports.length > 0 && (
        <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-foreground">Laporan Tersimpan</h3>
          <DataTable headers={['Tipe', 'Periode Mulai', 'Periode Selesai', 'Dibuat', 'Data']}>
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
        </div>
      )}
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
          {headers.length > 0 && (
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({
  children,
  strong,
  className = '',
}: {
  children: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-4 py-4 ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'} ${className}`}>
      {children || '-'}
    </td>
  );
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
