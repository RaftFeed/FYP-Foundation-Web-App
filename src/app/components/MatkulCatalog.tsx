import { useEffect, useState } from 'react';
import { Atom, Calculator, FlaskConical, Code2, Binary, Dna, ArrowRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { fetchSubjectMatchmakingSummaries, type SubjectMatchmakingSummary } from '../../lib/dashboardData';

const subjectStyles = [
  { icon: Atom, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { icon: Calculator, color: 'text-primary', bgColor: 'bg-secondary' },
  { icon: FlaskConical, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { icon: Code2, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { icon: Binary, color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-50' },
  { icon: Dna, color: 'text-teal-600', bgColor: 'bg-teal-50' },
];

function getSubjectStyle(index: number) {
  return subjectStyles[index % subjectStyles.length];
}

function getSubjectImage(subjectName: string) {
  const normalized = subjectName.toLowerCase();

  if (normalized.includes('fisika')) {
    return 'https://images.unsplash.com/photo-1532187643603-ba119ca4109e?auto=format&fit=crop&w=900&q=80';
  }
  if (normalized.includes('kalkulus') || normalized.includes('matematika')) {
    return 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=900&q=80';
  }
  if (normalized.includes('kimia')) {
    return 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=900&q=80';
  }
  if (normalized.includes('program') || normalized.includes('coding') || normalized.includes('komput')) {
    return 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=900&q=80';
  }
  if (normalized.includes('biologi')) {
    return 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=900&q=80';
  }

  return 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80';
}

export function MatkulCatalog() {
  const [subjects, setSubjects] = useState<SubjectMatchmakingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: true,
    duration: 24,
  });

  useEffect(() => {
    let active = true;

    fetchSubjectMatchmakingSummaries()
      .then((nextSubjects) => {
        if (active) {
          setSubjects(nextSubjects);
        }
      })
      .catch(() => {
        if (active) {
          setSubjects([]);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!emblaApi || subjects.length <= 1) {
      return;
    }

    const autoplay = window.setInterval(() => {
      if (!emblaApi.canScrollNext()) {
        emblaApi.scrollTo(0);
        return;
      }

      emblaApi.scrollNext();
    }, 3200);

    return () => window.clearInterval(autoplay);
  }, [emblaApi, subjects.length]);

  return (
    <section id="matkul" className="bg-secondary py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-5">
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-foreground">
              Pilih & Gabung
              <br />
              <span className="text-primary">Kelas Belajar</span>
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-primary/10 bg-white p-10 text-center text-sm font-medium text-muted-foreground shadow-sm">
            Memuat mata kuliah dari database...
          </div>
        ) : subjects.length === 0 ? (
          <div className="rounded-3xl border border-primary/10 bg-white p-10 text-center text-sm font-medium text-muted-foreground shadow-sm">
            Belum ada mata kuliah yang tersedia di database.
          </div>
        ) : (
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="-ml-5 flex pb-6">
              {subjects.map((subject, index) => {
                const { icon: Icon, color, bgColor } = getSubjectStyle(index);
                const hasKelas = subject.matchmaking_count > 0;

                return (
                  <div
                    key={subject.id}
                    className="min-w-0 flex-[0_0_100%] pl-5 sm:flex-[0_0_50%] lg:flex-[0_0_33.3333%] xl:flex-[0_0_25%]"
                  >
                    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl">
                      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-300">
                        <img
                          src={getSubjectImage(subject.name)}
                          alt={subject.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(39,38,157,0.18),transparent_55%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                        <div className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                          {hasKelas ? `${subject.matchmaking_count} Kelas Tersedia` : '0 Kelas Tersedia'}
                        </div>

                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <div className="mb-3">
                          <h3 className="text-xl font-semibold leading-tight text-foreground">{subject.name}</h3>
                          <span className="mt-2 inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                            {subject.code ?? 'Tanpa kode'}
                          </span>
                        </div>

                        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                          {subject.description?.trim() || 'Deskripsi mata kuliah belum tersedia di database.'}
                        </p>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
