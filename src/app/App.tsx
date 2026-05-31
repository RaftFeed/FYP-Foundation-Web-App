import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
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
import tamaImage from '../img/Tutor/tama.jpeg';
import nataImage from '../img/Tutor/nata.jpg';
import deboraImage from '../img/Tutor/debora.jpg';
import rifqiImage from '../img/Tutor/rifqi.jpg';
import hezkiImage from '../img/Tutor/hezki.jpg';
import farahImage from '../img/Tutor/siti-farhah-siratuyasa.jpeg';
import hannanImage from '../img/Tutor/muhammad-abdi-hannan.jpg';
import windiImage from '../img/Tutor/windi.png';
import rafidImage from '../img/Tutor/rafid.jpg';

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

const featuredTutors = [
  {
    id: 'juniarto-gautama-simanjuntak',
    name: 'Juniarto Gautama Simanjuntak, S.Si., M.Si',
    nickname: 'Kak Tama',
    education: 'S1 Biologi IPB, S2 Biosains Hewan IPB, saat ini S3 Biomedical Science di NAIST Jepang.',
    expertise: 'Biologi, Bahasa Inggris, Karya Tulis, bimbingan khusus',
    achievement: 'Asisten praktikum Biologi Dasar reguler dan internasional 2018-2023, ASEAN Youth Organization Ambassador 2020, publikasi jurnal ilmiah Scopus dan SINTA.',
    instagram: '@juntama17',
    imageUrl: tamaImage,
  },
  {
    id: 'dzulfiqar-yudha-pranata',
    name: 'Dzulfiqar Yudha Pranata',
    nickname: 'Kak Nata',
    education: 'S1 Fisika IPB Angkatan 59.',
    expertise: 'Fisika, Kalkulus',
    achievement: 'Asisten Praktikum Fisika ST 2023.',
    instagram: '@prnataydha',
    imageUrl: nataImage,
  },
  {
    id: 'maria-debora-fransiska',
    name: 'Maria Debora Fransiska',
    nickname: 'Kak Debora',
    education: 'S1 Kedokteran Hewan - SKHB IPB Angkatan 58.',
    expertise: 'Profesi Veteriner dan Kesejahteraan Hewan (PVKH)',
    achievement: 'Asisten Praktikum Biologi ST 2023.',
    instagram: '@midbrfs',
    imageUrl: deboraImage,
  },
  {
    id: 'rifqi-aulia-ramadhan',
    name: 'Rifqi Aulia Ramadhan',
    nickname: 'Kak Iqi',
    education: 'S1 Kimia IPB Angkatan 58.',
    expertise: 'Kimia Organik, Dasar Kimia Pangan, Kimia ST',
    achievement: 'Finalis ONMIPA-PT Kimia 2023 dan 2024, Juara 1 Chemistry National Olympiad XXVIII Universitas Udayana 2024, asisten praktikum Kimia Organik dan Kimia ST.',
    instagram: '@rifqi_aramadhan',
    imageUrl: rifqiImage,
  },
  {
    id: 'yehezki-novandri-liman',
    name: 'Yehezki Novandri Liman',
    nickname: 'Kak Hezki',
    education: 'S1 Statistika dan Sains Data IPB Angkatan 60.',
    expertise: 'Statistika dan Analisis Data, Computational Thinking (CT)',
    achievement: 'Juara 3 OSTARWIL Matematika tingkat kabupaten 2022 dan Staff IHMSI Nasional 2024-2026.',
    instagram: 'instagram.com/ynl.washere_',
    imageUrl: hezkiImage,
  },
  {
    id: 'siti-farhah-siratuyasa',
    name: 'Siti Farhah Siratuyasa',
    nickname: 'Kak Farah',
    education: 'S1-S2 Fisika IPB Angkatan 58 melalui program sinergi.',
    expertise: 'Fisika, Matematika dan Berpikir Logis (MBL), Kalkulus',
    achievement: 'Mahasiswa sinergi S1-S2 Fisika IPB dan asisten praktikum Fisika International Class.',
    instagram: '@farahsrtysa',
    imageUrl: farahImage,
  },
  {
    id: 'muhammad-abdi-hannan',
    name: 'Muhammad Abdi Hannan',
    nickname: 'Kak Hannan',
    education: 'S1 Teknik Industri Pertanian Angkatan 58, program sinergi S2.',
    expertise: 'Kimia ST, Matematika dan IPA SMA',
    achievement: 'Asisten Praktikum Kimia ST 2022-2023 dan finalis OSP Kimia Jawa Tengah 2020.',
    instagram: '@abdi_hnn',
    imageUrl: hannanImage,
  },
  {
    id: 'windi-gunawan',
    name: 'Windi Gunawan',
    nickname: 'Kak Windi',
    education: 'S1 Statistika dan Sains Data IPB Angkatan 58.',
    expertise: 'Statistika dan Analisis Data',
    achievement: 'Juara 1 dan Best Speaker Infographic Competition Jambore Statistika XIII 2024, serta beberapa capaian kompetisi statistik nasional lainnya.',
    instagram: '@wndignwn',
    imageUrl: windiImage,
  },
  {
    id: 'rafid-harsyah-syauqirahman',
    name: 'Rafid Harsyah Syauqirahman',
    nickname: 'Kak Rafid',
    education: 'S1 Ilmu Komputer IPB Angkatan 61.',
    expertise: 'Fisika, Matematika dan Berpikir Logis (MBL)',
    achievement: 'Juara 1 Mathematics Competition Himatika UIN Jakarta 2023.',
    instagram: '@rafidhrsyh',
    imageUrl: rafidImage,
  },
] as const;

const featuredTutorRows = [
  featuredTutors.filter((_, index) => index % 2 === 0),
  featuredTutors.filter((_, index) => index % 2 === 1),
] as const;

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
  const [tutorTopEmblaRef, tutorTopEmblaApi] = useEmblaCarousel({
    align: 'start',
    loop: true,
    duration: 24,
  });
  const [tutorBottomEmblaRef, tutorBottomEmblaApi] = useEmblaCarousel({
    align: 'start',
    loop: true,
    duration: 24,
  });

  useEffect(() => {
    function handleRouteChange() {
      setRoute(getCurrentRoute());
    }

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  useEffect(() => {
    if (!tutorTopEmblaApi || featuredTutorRows[0].length <= 1) {
      return;
    }

    const autoplay = window.setInterval(() => {
      if (!tutorTopEmblaApi.canScrollNext()) {
        tutorTopEmblaApi.scrollTo(0);
        return;
      }

      tutorTopEmblaApi.scrollNext();
    }, 3400);

    return () => window.clearInterval(autoplay);
  }, [tutorTopEmblaApi]);

  useEffect(() => {
    if (!tutorBottomEmblaApi || featuredTutorRows[1].length <= 1) {
      return;
    }

    const autoplay = window.setInterval(() => {
      if (!tutorBottomEmblaApi.canScrollPrev()) {
        tutorBottomEmblaApi.scrollTo(featuredTutorRows[1].length - 1);
        return;
      }

      tutorBottomEmblaApi.scrollPrev();
    }, 3400);

    return () => window.clearInterval(autoplay);
  }, [tutorBottomEmblaApi]);

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
      <section id="katalog" className="py-16 bg-secondary">
        <div className="max-w-7xl mx-auto px-4 md:px-5">
          <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
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
            <div className="min-w-0 flex-1">
              <div className="space-y-4">
                <div className="overflow-hidden" ref={tutorTopEmblaRef}>
                  <div className="-ml-5 flex">
                    {featuredTutorRows[0].map((tutor) => (
                      <div
                        key={tutor.id}
                        className="min-w-0 flex-[0_0_100%] pl-5 sm:flex-[0_0_88%] md:flex-[0_0_70%] lg:flex-[0_0_48%] xl:flex-[0_0_39%]"
                      >
                        <TutorCard {...tutor} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="overflow-hidden" ref={tutorBottomEmblaRef}>
                  <div className="-ml-5 flex">
                    {featuredTutorRows[1].map((tutor) => (
                      <div
                        key={tutor.id}
                        className="min-w-0 flex-[0_0_100%] pl-5 sm:flex-[0_0_88%] md:flex-[0_0_70%] lg:flex-[0_0_48%] xl:flex-[0_0_39%]"
                      >
                        <TutorCard {...tutor} />
                      </div>
                    ))}
                  </div>
                </div>
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
