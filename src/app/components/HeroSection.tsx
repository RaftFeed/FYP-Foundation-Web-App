import { Search, ArrowRight, Star, Users, BookOpen, Award } from 'lucide-react';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1711763560427-3cbd84a54409?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwc3R1ZHlpbmclMjBib29rcyUyMHVuaXZlcnNpdHklMjBzbWlsaW5nfGVufDF8fHx8MTc3NjY4NzAxMHww&ixlib=rb-4.1.0&q=80&w=1080';

const stats = [
  { icon: BookOpen, value: '12+', label: 'Mata Kuliah' },
  { icon: Users, value: '500+', label: 'Mahasiswa' },
  { icon: Award, value: '80+', label: 'Tutor Terverifikasi' },
  { icon: Star, value: '4.9', label: 'Rating Rata-rata' },
];

export function HeroSection() {
  return (
    <section id="beranda" className="bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div
              className="inline-flex items-center gap-2 bg-secondary border border-primary/20 text-primary px-4 py-1.5 rounded-full mb-6 text-sm"
              style={{ fontWeight: 600 }}
            >
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
              Platform Tutor PPKU Terpercaya
            </div>

            <h1 className="text-foreground mb-5">
              Pilih Mata Kuliah &{' '}
              <span className="relative inline-block text-primary pb-2">
                Gabung Kelas
                <svg
                  className="absolute -bottom-2 left-0 w-full h-auto"
                  viewBox="0 0 300 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M2 9 C 40 2, 80 12, 150 10 S 250 2, 240 8 S 280 12, 298 7"
                    stroke="#F59E0B"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>{' '}
              Belajar!
            </h1>

            <p className="text-muted-foreground mb-8 max-w-md" style={{ fontSize: '1.05rem', lineHeight: '1.7' }}>
              Belajar lebih efektif bersama teman sekelas - pilih mata kuliah PPKU-mu, bergabung ke kelas grup, atau
              buat sesi privat bersama tutor terbaik.
            </p>

            <div className="flex gap-3 mb-8 bg-white border-2 border-border rounded-xl p-2 shadow-md hover:border-primary transition-colors max-w-lg">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari Mata Kuliah..."
                  className="w-full pl-10 pr-3 py-2.5 bg-transparent border-0 focus:outline-none text-sm"
                />
              </div>
              <button className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm flex items-center gap-2 shrink-0">
                Cari
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-10">
              <span className="text-sm text-muted-foreground mr-1" style={{ fontWeight: 600 }}>
                Populer:
              </span>
              {['Fisika Dasar', 'Kalkulus', 'Kimia Dasar', 'Pemrograman'].map((tag) => (
                <button
                  key={tag}
                  className="text-sm px-3.5 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-secondary transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {stats.map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-primary" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                      {value}
                    </span>
                  </div>
                  <p className="text-muted-foreground" style={{ fontSize: '0.78rem' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 lg:order-2 relative flex justify-center">
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: 'radial-gradient(ellipse at 60% 40%, #0D6B5E18 0%, #F0FDF8 60%, transparent 100%)',
                transform: 'scale(1.1)',
              }}
            />

            <div className="relative z-10">
              <div className="w-[320px] sm:w-[380px] h-[380px] sm:h-[440px] rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                <img src={HERO_IMAGE} alt="Mahasiswa belajar" className="w-full h-full object-cover" />
              </div>

              <div className="absolute -left-6 top-8 bg-white rounded-2xl shadow-xl border border-border p-3.5 flex items-center gap-3 min-w-[160px]">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-foreground" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                    500+
                  </p>
                  <p className="text-muted-foreground" style={{ fontSize: '0.72rem' }}>
                    Mahasiswa Aktif
                  </p>
                </div>
              </div>

              <div className="absolute -right-6 bottom-10 bg-white rounded-2xl shadow-xl border border-border p-3.5 flex items-center gap-3 min-w-[160px]">
                <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-foreground" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                    4.9 / 5
                  </p>
                  <p className="text-muted-foreground" style={{ fontSize: '0.72rem' }}>
                    Rating Tutor
                  </p>
                </div>
              </div>

              <div
                className="absolute -right-4 top-6 bg-primary text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm"
                style={{ fontWeight: 700 }}
              >
                <BookOpen className="w-4 h-4" />
                24 Kelas Aktif
              </div>

              <div className="absolute -bottom-4 -left-4 w-16 h-16 opacity-20">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary inline-block m-0.5" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
