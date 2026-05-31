import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { MatkulCatalog } from './components/MatkulCatalog';
import { TutorCard } from './components/TutorCard';
import { HowItWorks } from './components/HowItWorks';
import { Testimonials } from './components/Testimonials';
import { MobileStickyCTA } from './components/MobileStickyCTA';
import { Footer } from './components/Footer';
import { GlobalStateProvider } from './context/GlobalState';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthPage } from './components/AuthPage';
import { StudentDashboard } from './components/StudentDashboard';
import { TutorDashboard } from './components/TutorDashboard';
import { fetchApprovedTutorCards, type PublicTutorCard } from '../lib/dashboardData';

const themeTokens: Record<string, Record<string, string>> = {
  default: {
    '--primary': '#27269d',
    '--accent': '#e4bf46',
    '--secondary': '#FAF8F2',
    '--foreground': '#111827',
    '--radius': '0.75rem',
    '--background': '#ffffff',
  }
};

function getCurrentRoute() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = window.location.pathname;
  return path.startsWith(base) ? path.slice(base.length) || '/' : path;
}

export default function App() {
  useEffect(() => {
    const root = document.documentElement;
    const tokens = themeTokens.default;
    Object.entries(tokens).forEach(([prop, val]) => root.style.setProperty(prop, val));
  }, []);

  return (
    <GlobalStateProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GlobalStateProvider>
  );
}

function AppContent() {
  const { session, role, isAuthLoading } = useAuth();
  const [route, setRoute] = useState(getCurrentRoute);
  const [tutors, setTutors] = useState<PublicTutorCard[]>([]);
  const [isLoadingTutors, setIsLoadingTutors] = useState(false);

  useEffect(() => {
    function handleRouteChange() {
      setRoute(getCurrentRoute());
    }

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  useEffect(() => {
    if (session) {
      return;
    }

    let active = true;
    setIsLoadingTutors(true);

    fetchApprovedTutorCards()
      .then((nextTutors) => {
        if (active) {
          setTutors(nextTutors);
        }
      })
      .catch(() => {
        if (active) {
          setTutors([]);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingTutors(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session]);

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-secondary border-t-primary" />
          <p className="text-sm font-semibold text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (session && role === 'admin') {
    return <AdminDashboard />;
  }

  if (session && role === 'student') {
    return <StudentDashboard />;
  }

  if (session && role === 'tutor') {
    return <TutorDashboard />;
  }

  if (route === '/login') {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <MatkulCatalog />
      <HowItWorks />
      <Testimonials />

      {/* Katalog Tutor */}
      <section id="katalog" className="py-20 bg-secondary">
        <div className="max-w-7xl mx-auto px-4 md:px-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-4">
            <div>
              {/* <p className="text-primary text-sm mb-2" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Temukan Tutor
              </p> */}
              <h2 className="text-foreground">
                Tutor Terbaik<br />
                <span className="text-primary">Siap Membantumu</span>
              </h2>
            </div>

          </div>

          <div className="flex gap-8 items-start">
            <div className="flex-1">
              <div className="overflow-x-auto pb-5 [scrollbar-color:rgba(39,38,157,0.35)_transparent] [scrollbar-width:thin]">
                {isLoadingTutors && (
                  <div className="rounded-xl border border-primary/10 bg-white p-6 text-sm font-medium text-muted-foreground">
                    Memuat tutor dari database...
                  </div>
                )}
                {!isLoadingTutors && tutors.length === 0 && (
                  <div className="rounded-xl border border-primary/10 bg-white p-6 text-sm font-medium text-muted-foreground">
                    Belum ada tutor approved di database.
                  </div>
                )}
                {tutors.length > 0 && (
                  <div className="flex min-w-max gap-6">
                    {tutors.map((tutor) => (
                      <div key={tutor.id} className="w-[220px] shrink-0">
                        <TutorCard {...tutor} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <MobileStickyCTA />
    </div>
  );
}
