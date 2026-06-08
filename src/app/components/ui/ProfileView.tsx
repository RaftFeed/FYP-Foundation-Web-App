import { UserRound } from 'lucide-react';
import { useRef, useState } from 'react';

export interface Subject {
  id: string;
  name: string;
}

export interface ProfileViewProps {
  profileForm: {
    fullName: string;
    subjectId?: string;
    hourlyRate?: number;
    bio?: string;
    imageUrl?: string;
  };
  setProfileForm: React.Dispatch<React.SetStateAction<any>>;
  onProfileSave: (e: React.FormEvent) => void | Promise<void>;
  onAvatarSelect: (file: File) => void | Promise<void>;
  isSaving: boolean;
  isUploadingAvatar: boolean;
  avatarUrl: string | null;
  profile?: { created_at?: string; email?: string; subject_id?: string } | null;
  userEmail?: string | null;

  // Tutor dashboard specific props
  isTutor?: boolean;
  approved?: boolean;
  subjects?: Subject[];
}

export function ProfileView({
  profileForm,
  setProfileForm,
  onProfileSave,
  onAvatarSelect,
  isSaving,
  isUploadingAvatar,
  avatarUrl,
  profile,
  userEmail,
  isTutor = false,
  approved = false,
  subjects = [],
}: ProfileViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

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
            onSubmit={(e) => {
              e.preventDefault();
              void onProfileSave(e);
            }}
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

            {isTutor && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-foreground">Mata Kuliah yang Diajar</label>
                  <select
                    value={profileForm.subjectId || ''}
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
                  <label className="block text-sm font-semibold text-foreground">Harga Default per Kelas</label>
                  <p className="mt-0.5 mb-2 text-xs text-muted-foreground">Harga ini akan otomatis terisi saat membuat slot jadwal baru.</p>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">Rp</span>
                    <input
                      type="number"
                      value={profileForm.hourlyRate ?? 120000}
                      onChange={(e) => setProfileForm({ ...profileForm, hourlyRate: Number(e.target.value) })}
                      min={0}
                      step={1000}
                      className="mt-0 h-11 w-full rounded-lg border border-primary/20 bg-white pl-10 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-foreground/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground">Bio singkat</label>
                  <textarea
                    value={profileForm.bio || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    rows={4}
                    placeholder="Ceritakan singkat tentang dirimu..."
                    className="mt-2 w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-medium text-foreground outline-none transition placeholder:text-foreground/30 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </>
            )}

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
                <p className="mt-0.5 text-sm font-medium text-white">{userEmail || profile?.email || '-'}</p>
              </div>

              {isTutor && (
                <>
                  <div>
                    <p className="text-xs text-white/70">Mata Kuliah</p>
                    <p className="mt-0.5 text-sm font-medium text-white">
                      {subjects.find((s) => s.id === (profileForm.subjectId || profile?.subject_id))?.name ?? '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/70">Harga per Kelas</p>
                    <p className="mt-0.5 text-sm font-medium text-white">
                      {profileForm.hourlyRate ? `Rp ${profileForm.hourlyRate.toLocaleString('id-ID')}` : '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/70">Status</p>
                    <p className={`mt-0.5 text-sm font-medium ${approved ? 'text-accent' : 'text-amber-300'}`}>
                      {approved ? '✓ Disetujui Admin' : '⏳ Menunggu Approval'}
                    </p>
                  </div>
                </>
              )}

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
