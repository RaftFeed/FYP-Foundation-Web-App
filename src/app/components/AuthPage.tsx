import { FormEvent, useEffect, useState } from 'react';
import { BookOpen, Chrome, GraduationCap, Loader2, Lock, Mail, Play, UserRound } from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';

type AuthMode = 'login' | 'signup';

function getInitialMode(): AuthMode {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'signup' ? 'signup' : 'login';
}

function navigateHome() {
  const homePath = import.meta.env.BASE_URL || '/';
  window.history.pushState({}, '', homePath);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function AuthPage() {
  const { signIn, signInWithGoogle, signUp, authError, clearAuthError } = useAuth();
  const [mode, setMode] = useState<AuthMode>(getInitialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    clearAuthError();
    setMessage(null);
  }, [clearAuthError, mode]);

  function setAuthMode(nextMode: AuthMode) {
    setMode(nextMode);
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    window.history.replaceState({}, '', `${base}/login${nextMode === 'signup' ? '?mode=signup' : ''}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, role);
        setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
        setAuthMode('login');
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
    <main className="min-h-screen bg-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden min-h-screen overflow-hidden bg-muted lg:block">
          <img
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&h=1400&fit=crop"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-primary/30" />
          <button
            type="button"
            onClick={navigateHome}
            className="absolute left-8 top-8 flex h-12 w-12 items-center justify-center rounded-lg bg-white/90 text-primary shadow-lg backdrop-blur transition hover:bg-white"
            aria-label="Back to home"
          >
            <Play className="h-6 w-6 fill-current" />
          </button>
        </section>

        <section className="flex min-h-screen items-center justify-center px-6 py-10">
          <div className="w-full max-w-[440px] rounded-lg border border-border bg-white px-8 py-8 shadow-sm">
            <div className="mx-auto mb-7 flex h-12 max-w-[260px] items-center justify-center rounded-lg bg-muted px-4 text-center text-xs font-extrabold uppercase tracking-[0.08em] text-foreground">
              Logo FYP Foundation
            </div>

            <div className="mb-7 grid grid-cols-2 border-b border-border text-sm font-semibold text-foreground">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`pb-3 transition ${mode === 'login' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-primary'}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`pb-3 transition ${mode === 'signup' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-primary'}`}
              >
                Daftar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="relative block">
                <span className="sr-only">Email</span>
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-lg border border-border pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Email atau No. Telp"
                  required
                />
              </label>

              <label className="relative block">
                <span className="sr-only">Password</span>
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-lg border border-border pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Password"
                  minLength={6}
                  required
                />
              </label>

              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-sm transition ${
                      role === 'student' ? 'border-primary bg-secondary text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <BookOpen className="h-4 w-4" />
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('tutor')}
                    className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-sm transition ${
                      role === 'tutor' ? 'border-primary bg-secondary text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    Tutor
                  </button>
                </div>
              )}

              {mode === 'login' && (
                <div className="text-right">
                  <button type="button" className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
                    Lupa password?
                  </button>
                </div>
              )}

              {(authError || message) && (
                <div className={`rounded-lg px-4 py-3 text-sm ${authError ? 'bg-red-50 text-red-700' : 'bg-secondary text-primary'}`}>
                  {authError ?? message}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'login' ? 'Login' : 'Daftar'}
              </button>

              <button
                type="button"
                onClick={() => setAuthMode(mode === 'login' ? 'signup' : 'login')}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold text-primary transition hover:bg-secondary"
              >
                <UserRound className="h-4 w-4" />
                {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Login'}
              </button>
            </form>

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground">atau login dengan</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-5 w-5" />}
              Login dengan Google
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
