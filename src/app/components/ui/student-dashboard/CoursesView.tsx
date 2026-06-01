import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { SubjectMatchmakingSummary } from '../../../../lib/dashboardData';
import { TutorAvailabilitySlot } from '../../../../lib/matchmakingData';

export function CoursesView({
  isLoading,
  query,
  subjects,
  setQuery,
  availableTutorSlots,
}: {
  isLoading: boolean;
  query: string;
  subjects: SubjectMatchmakingSummary[];
  setQuery: (query: string) => void;
  availableTutorSlots: TutorAvailabilitySlot[];
}) {
  const filteredSubjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return subjects;
    }

    return subjects.filter((subject) =>
      [subject.name, subject.code ?? '', subject.description ?? ''].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [query, subjects]);

  return (
    <section>
      <div className="mb-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-normal text-foreground lg:text-3xl">Pilih Mata Kuliah</h1>
        </div>
      </div>

      <label className="relative mb-6 block">
        <span className="sr-only">Cari mata kuliah</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari mata kuliah atau kode"
          className="h-10 w-full rounded-lg border border-primary/20 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-normal text-foreground">Daftar Mata Kuliah</h2>
        <p className="text-sm font-medium text-muted-foreground">Menampilkan {filteredSubjects.length} matkul</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && (
          <div className="col-span-full rounded-xl border border-primary/10 bg-white p-6 text-sm font-medium text-muted-foreground shadow-md">
            Memuat mata kuliah...
          </div>
        )}
        {!isLoading && filteredSubjects.length === 0 && (
          <div className="col-span-full rounded-xl border border-primary/10 bg-white p-6 text-sm font-medium text-muted-foreground shadow-md">
            Tidak ada mata kuliah yang cocok.
          </div>
        )}
        {filteredSubjects.map((subject) => {
          const subjectSlotCount = availableTutorSlots.filter((slot) => slot.subject_id === subject.id).length;
          const lobbyCount = subject.matchmaking_count;

          return (
            <article key={subject.id} className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-foreground">{subject.name}</h3>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${subjectSlotCount > 0 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {subjectSlotCount} Slot Tutor
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${lobbyCount > 0 ? 'bg-green-100 text-green-700' : 'bg-secondary text-muted-foreground'}`}>
                    {lobbyCount} Lobby
                  </span>
                </div>
              </div>

              <div className="mb-1 flex items-center gap-2">
                <span className="py-1 text-xs font-semibold text-primary">
                  {subject.code ?? 'Tanpa kode'}
                </span>
              </div>

              <p className="min-h-[72px] text-sm font-medium leading-relaxed text-muted-foreground">
                {subject.description?.trim() || 'Deskripsi mata kuliah belum tersedia.'}
              </p>

              <div className="mt-5 rounded-lg border border-primary/10 bg-secondary/60 p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ketersediaan</p>
                <p className="text-sm font-semibold text-foreground">
                  {subjectSlotCount > 0
                    ? `${subjectSlotCount} slot tutor tersedia`
                    : 'Belum ada slot tutor'}
                  {lobbyCount > 0
                    ? ` · ${lobbyCount} lobby aktif`
                    : ' · belum ada lobby aktif'}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
