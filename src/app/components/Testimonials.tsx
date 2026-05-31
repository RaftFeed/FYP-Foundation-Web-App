import { Star, Quote } from 'lucide-react';

interface Testimonial {
  id: number;
  name: string;
  role: string;
  achievement: string;
  text: string;
  rating: number;
  image: string;
  verified: boolean;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Aliyah Putri',
    role: 'Mahasiswa PPKU IPB',
    achievement: 'Nilai: C → A',
    text: 'Tutor di sini sangat responsif dan menjelaskan dengan detail. Saya yang tadinya struggle dengan Kalkulus sekarang malah bisa tutor temen-temen. Highly recommended!',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    verified: true,
  },
  {
    id: 2,
    name: 'Muhammad Riza',
    role: 'Mahasiswa PPKU IPB',
    achievement: 'Lulus dengan IP 3.8',
    text: 'Platform ini benar-benar membantu saya organize belajar. Bisa pilih tutor sesuai kebutuhan, fleksibel, dan hasilnya terukur. Investasi terbaik semester ini!',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    verified: true,
  },
  {
    id: 3,
    name: 'Sinta Dewi',
    role: 'Mahasiswa PPKU IPB',
    achievement: 'GPA Meningkat 0.5',
    text: 'Groupnya supportif, tutornya profesional, dan sistemnya transparan. Tidak ada hidden cost atau kompromi kualitas. Perfect untuk mahasiswa PPKU!',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    verified: true,
  },
  {
    id: 4,
    name: 'Budi Santoso',
    role: 'Mahasiswa PPKU IPB',
    achievement: 'Predikat Cum Laude',
    text: 'Kualitas terjamin, tutor2nya qualified dan punya track record bagus. Dapat value lebih dari yang diharapkan untuk setiap rupiah yang dikeluarkan.',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    verified: true,
  },
  {
    id: 5,
    name: 'Budi Santoso',
    role: 'Mahasiswa PPKU IPB',
    achievement: 'Predikat Cum Laude',
    text: 'Kualitas terjamin, tutor2nya qualified dan punya track record bagus. Dapat value lebih dari yang diharapkan untuk setiap rupiah yang dikeluarkan.',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    verified: true,
  },
];

export function Testimonials() {
  return (
    <section className="py-16 bg-gradient-to-b from-white to-secondary/30">
      <div className="max-w-7xl mx-auto px-4 md:px-5">
        <div className="mb-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ribuan Mahasiswa Telah Mencapai<br className="hidden sm:block" />
            <span className="text-primary">Target Akademik Mereka</span>
          </h2>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto leading-relaxed">
            Lihat bagaimana mahasiswa PPKU dari berbagai latar belakang telah meningkatkan prestasi akademik mereka melalui FYP Foundation.
          </p>
        </div>

        <div className="mb-8 overflow-x-auto pb-4 [scrollbar-color:rgba(39,38,157,0.4)_transparent] [scrollbar-width:thin]">
          <div className="flex min-w-max gap-5 snap-x snap-mandatory">
            {testimonials.map((testimonial) => (
              <article
                key={testimonial.id}
                className="w-[300px] snap-start rounded-2xl border border-primary/10 bg-secondary/70 p-4 shadow-sm"
              >
                <div className="mb-4 flex items-start gap-3">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-14 w-14 rounded-full bg-white object-cover"
                    loading="lazy"
                  />

                  <div className="pt-1">
                    <div className="flex items-center gap-1">
                      <p className="text-lg font-semibold text-foreground">{testimonial.name}</p>
                      {testimonial.verified && (
                        <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20" aria-label="Verified">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{testimonial.role}</p>
                  </div>
                </div>

                <div className="mb-3 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < testimonial.rating ? 'fill-primary text-primary' : 'fill-primary/10 text-primary/10'}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>

                <Quote className="mb-2 h-5 w-5 text-primary/20" aria-hidden="true" />

                <p className="mb-4 min-h-[108px] text-sm leading-relaxed text-foreground">
                  "{testimonial.text}"
                </p>

              </article>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border/30 bg-white p-6 sm:grid-cols-4">
          {[
            { label: 'Mahasiswa Aktif', value: '500+' },
            { label: 'Rating Rata-rata', value: '4.9/5' },
            { label: 'Tutor Verifikasi', value: '20+' },
            { label: 'Mata Kuliah', value: '12+' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-primary font-bold text-2xl mb-1">{stat.value}</p>
              <p className="text-muted-foreground text-xs font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
