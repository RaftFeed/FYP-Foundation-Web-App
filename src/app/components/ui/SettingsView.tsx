import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NoticeModalState } from './NoticeModal';

export function SettingsView({ showNotice }: { showNotice: (tone: NoticeModalState['tone'], message: string) => void }) {
  const { user, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Check if the user has an email/password identity
  const isEmailUser = user?.app_metadata?.providers?.includes('email') ?? false;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const { supabase } = await import('../../../lib/supabase');

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
      showNotice('error', error instanceof Error ? error.message : 'Gagal memperbarui password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <section>
      <div className="grid gap-6">
        <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-md">
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Ganti Password</h1>
          {!isEmailUser ? (
            <div className="rounded-lg border border-primary/10 bg-secondary/50 p-4 text-sm">
              <p className="font-semibold text-primary mb-1">Akun Pihak Ketiga</p>
              <p className="text-muted-foreground">Akun kamu terhubung menggunakan penyedia layanan pihak ketiga (seperti Google). Kata sandi kamu diatur melalui layanan tersebut.</p>
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
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan password saat ini"
                    className="mt-2 h-11 w-full rounded-lg border border-primary/20 bg-white px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Password Baru</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    className="mt-2 h-11 w-full rounded-lg border border-primary/20 bg-white px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
      </div>
    </section>
  );
}
