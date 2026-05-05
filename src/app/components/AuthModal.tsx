import { FormEvent, useEffect, useState } from 'react';
import { BookOpen, Chrome, GraduationCap, Loader2, UserRound, X } from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';

type AuthMode = 'login' | 'signup';

interface AuthModalProps {
  initialMode: AuthMode;
  onClose: () => void;
}

export function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const { signIn, signInWithGoogle, signUp, authError, clearAuthError } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    clearAuthError();
    setMessage(null);
  }, [clearAuthError, mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        onClose();
      } else {
        await signUp(email, password, fullName, role);
        setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
        setMode('login');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      await signInWithGoogle();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/50 px-4 py-6">
      <div className="w-full max-w-md rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </p>
            <h2 className="mt-1 text-2xl text-foreground">
              {mode === 'login' ? 'Masuk ke FYP Foundation' : 'Daftar FYP Foundation'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close authentication dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {mode === 'signup' && (
            <div className="space-y-2">
              <label htmlFor="auth-full-name" className="block text-sm text-foreground">
                Nama Lengkap
              </label>
              <input
                id="auth-full-name"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Nama lengkap"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="auth-email" className="block text-sm text-foreground">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="auth-password" className="block text-sm text-foreground">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Minimum 6 characters"
              minLength={6}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="space-y-3">
              <label className="block text-sm text-foreground">Register as</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm transition ${
                    role === 'student'
                      ? 'border-primary bg-secondary text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole('tutor')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm transition ${
                    role === 'tutor'
                      ? 'border-primary bg-secondary text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <GraduationCap className="h-4 w-4" />
                  Tutor
                </button>
              </div>
            </div>
          )}

          {(authError || message) && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                authError ? 'bg-red-50 text-red-700' : 'bg-secondary text-primary'
              }`}
            >
              {authError ?? message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Masuk' : 'Daftar'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-semibold text-primary transition hover:bg-secondary"
          >
            <UserRound className="h-4 w-4" />
            {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
