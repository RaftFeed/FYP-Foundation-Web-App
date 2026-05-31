import { useEffect, useState } from 'react';
import { Search, Users, Video, ArrowRight } from 'lucide-react';
import papanImage from '../../img/Foto_Papan.png';
import { fetchApprovedTutorCards, type PublicTutorCard } from '../../lib/dashboardData';

const fallbackTutorAvatars = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
];

function openAuthPage(mode: 'login' | 'signup') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  window.history.pushState({}, '', `${base}/login${mode === 'signup' ? '?mode=signup' : ''}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const steps = [
  {
    step: '01',
    icon: Search,
    title: 'Pilih Mata Kuliah',
    description: 'Telusuri katalog PPKU dan temukan mata kuliah yang ingin kamu kuasai bersama tutor berpengalaman.',
  },
  {
    step: '02',
    icon: Users,
    title: 'Gabung atau Buat Grup',
    description: 'Bergabung ke kelas grup yang sudah ada, atau buat grup baru dan undang teman untuk belajar bersama.',
  },
  {
    step: '03',
    icon: Video,
    title: 'Belajar Bersama Tutor',
    description: 'Sesi dipandu tutor berprestasi - online atau tatap muka. Materi jelas, nilai meningkat!',
  },
];

export function HowItWorks() {
  const [tutorAvatars, setTutorAvatars] = useState<PublicTutorCard[]>([]);

  useEffect(() => {
    let active = true;

    fetchApprovedTutorCards(3)
      .then((tutors) => {
        if (active) {
          setTutorAvatars(tutors);
        }
      })
      .catch(() => {
        if (active) {
          setTutorAvatars([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="panduan" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-5">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-foreground mb-4">
              Mulai Belajar dalam
              <br />
              <span className="text-primary">3 Langkah Mudah</span>
            </h2>
            <p className="text-muted-foreground mb-10 text-sm leading-relaxed max-w-md">
              Proses yang simpel dan cepat - dari pilih mata kuliah hingga sesi belajar pertamamu hanya butuh beberapa menit.
            </p>

            <div className="space-y-6">
              {steps.map((step, i) => {
                const Icon = step.icon;

                return (
                  <div key={step.step} className="flex gap-4 group">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-primary transition-colors shrink-0" role="img" aria-label={`Step ${step.step}: ${step.title}`}>
                        <Icon className="w-5 h-5 text-white" aria-hidden="true" />
                      </div>
                      {i < steps.length - 1 && <div className="w-0.5 h-8 bg-border mt-2" aria-hidden="true" />}
                    </div>

                    <div className="pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-primary font-bold tracking-wide">
                          STEP {step.step}
                        </span>
                      </div>
                      <h3 className="text-foreground mb-1 font-semibold">{step.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => openAuthPage('signup')}
              className="mt-10 inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-95 transition-all shadow-md text-sm font-medium"
              aria-label="Mulai daftar sekarang"
            >
              Mulai Sekarang
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative hidden lg:flex justify-center items-center">
            <div className="relative">
              <div className="w-[420px] h-[460px] rounded-3xl overflow-hidden shadow-2xl">
                <img src={papanImage} alt="Tutor mengajar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
              </div>

              <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur rounded-2xl p-4 shadow-xl border border-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground" style={{ fontWeight: 800, fontSize: '1.2rem' }}>
                      20+ Tutor
                    </p>
                    <p className="text-muted-foreground text-xs">Aktif dan Berprestasi</p>
                  </div>

                  <div className="flex -space-x-2">
                    {(tutorAvatars.length > 0 ? tutorAvatars : fallbackTutorAvatars).map((tutor, i) => (
                      <img
                        key={typeof tutor === 'string' ? tutor : tutor.id}
                        src={typeof tutor === 'string' ? tutor : (tutor.imageUrl || fallbackTutorAvatars[i % fallbackTutorAvatars.length])}
                        alt=""
                        className="w-9 h-9 rounded-full border-2 border-white object-cover"
                      />
                    ))}
                    <div
                      className="w-9 h-9 rounded-full border-2 border-white bg-primary flex items-center justify-center text-white text-xs"
                      style={{ fontWeight: 700 }}
                    >
                      +17
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -top-5 -right-5 grid grid-cols-3 gap-1.5 opacity-30">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
