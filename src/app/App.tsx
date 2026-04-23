import { useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { MatkulCatalog } from './components/MatkulCatalog';
import { TutorCard } from './components/TutorCard';
import { HowItWorks } from './components/HowItWorks';
import { Testimonials } from './components/Testimonials';
import { MobileStickyCTA } from './components/MobileStickyCTA';
import { Footer } from './components/Footer';
import { GlobalStateProvider } from './context/GlobalState';

const tutors = [
  {
    name: 'Dr. Budi Santoso',
    subject: 'Fisika Dasar',
    rating: 4.9,
    reviews: 127,
    hourlyRate: 75000,
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
  },
  {
    name: 'Siti Nurhaliza',
    subject: 'Kalkulus',
    rating: 5.0,
    reviews: 89,
    hourlyRate: 85000,
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
  },
  {
    name: 'Ahmad Fauzi',
    subject: 'Kimia Dasar',
    rating: 4.8,
    reviews: 156,
    hourlyRate: 70000,
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
  },
  {
    name: 'Rani Wijaya',
    subject: 'Pemrograman',
    rating: 4.9,
    reviews: 94,
    hourlyRate: 90000,
    imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
  },
  {
    name: 'Dimas Pratama',
    subject: 'Matematika Diskrit',
    rating: 5.0,
    reviews: 112,
    hourlyRate: 80000,
    imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
  },
  {
    name: 'Lestari Putri',
    subject: 'Biologi Umum',
    rating: 4.7,
    reviews: 78,
    hourlyRate: 65000,
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
  },
];

const themeTokens: Record<string, Record<string, string>> = {
  default: {
    '--primary': '#27269d',
    '--accent': '#e4bf46',
    '--secondary': '#F0FDF8',
    '--foreground': '#111827',
    '--radius': '0.75rem',
    '--background': '#ffffff',
  }
};

export default function App() {
  useEffect(() => {
    const root = document.documentElement;
    const tokens = themeTokens.default;
    Object.entries(tokens).forEach(([prop, val]) => root.style.setProperty(prop, val));
  }, []);

  return (
    <GlobalStateProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <HeroSection />
        <MatkulCatalog />
        <HowItWorks />
        <Testimonials />

        {/* Katalog Tutor */}
      <section id="katalog" className="py-20 bg-secondary">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-4">
            <div>
              <p className="text-primary text-sm mb-2" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Temukan Tutor
              </p>
              <h2 className="text-foreground">
                Tutor Terbaik<br />
                <span className="text-primary">Siap Membantumu</span>
              </h2>
            </div>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              Pilih tutor terverifikasi berdasarkan mata kuliah, harga, dan rating terbaik.
            </p>
          </div>

          <div className="flex gap-8 items-start">
            <div className="flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-5">
                {tutors.map((tutor, index) => (
                  <TutorCard key={index} {...tutor} />
                ))}
              </div>

              <div className="text-center mt-10">
                <button className="px-8 py-3 border-2 border-primary text-primary rounded-xl hover:bg-primary hover:text-white transition-all text-sm">
                  Muat Lebih Banyak Tutor
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <MobileStickyCTA />
    </div>
    </GlobalStateProvider>
  );
}
