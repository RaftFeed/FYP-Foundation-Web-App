import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoImage from '../../img/FYP_Logo.png';
import loginImage from '../../img/Login.png';

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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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

    if (password !== confirmPassword) {
      setMessage('Password dan konfirmasi password harus sama.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName);
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
            src={loginImage}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-primary/30" />
          <button
            type="button"
            onClick={navigateHome}
            className="absolute left-8 top-8 flex h-12 w-12 items-center justify-center rounded-lg bg-white/90 text-primary shadow-lg backdrop-blur transition hover:bg-black/10 on-click:ring-1 focus:outline-none focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        </section>

        <section className="flex min-h-screen items-center justify-center px-6 py-10">
          <div className="w-full max-w-[440px] rounded-lg border border-border bg-white px-8 py-8 shadow-sm">
            <div className="mx-auto mb-7 flex h-16 max-w-[260px] items-center justify-center">
              <img
                src={logoImage}
                alt="Logo FYP Foundation"
                className="h-full w-auto object-contain"
              />
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
              {mode === 'signup' && (
                <label className="relative block">
                  <span className="sr-only">Nama Lengkap</span>
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-11 w-full rounded-lg border border-border pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Nama lengkap"
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label className="relative block">
                <span className="sr-only">Email</span>
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-lg border border-border pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Email"
                  required
                />
              </label>

              <label className="relative block">
                <span className="sr-only">Password</span>
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-lg border border-border pl-11 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Password"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label={isPasswordVisible ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={isPasswordVisible}
                >
                  {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>

              <label className="relative block">
                <span className="sr-only">Konfirmasi Password</span>
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 w-full rounded-lg border border-border pl-11 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Konfirmasi password"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label={isPasswordVisible ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={isPasswordVisible}
                >
                  {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>

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
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo />}
              Login dengan Google
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.8v2.3h3c1.8-1.6 2.9-4 2.9-6.8 0-.7-.1-1.4-.2-2H12z" />
      <path fill="#34A853" d="M6.6 14.1l-.7.6-2.4 1.9C5 19.1 8.3 21 12 21c2.6 0 4.8-.9 6.4-2.5l-3-2.3c-.8.5-1.8.8-3.4.8-2.5 0-4.6-1.6-5.4-3.9z" />
      <path fill="#FBBC05" d="M3.5 7.8c-.6 1.2-1 2.6-1 4.2s.4 3 1 4.2l3.1-2.5c-.2-.7-.3-1-.3-1.7s.1-1 .3-1.7L3.5 7.8z" />
      <path fill="#4285F4" d="M12 5.1c1.4 0 2.7.5 3.8 1.5l2.8-2.8C16.8 2.2 14.6 1 12 1 8.3 1 5 2.9 3.5 7.8l3.1 2.5C7.4 6.6 9.5 5.1 12 5.1z" />
    </svg>
  );
}
