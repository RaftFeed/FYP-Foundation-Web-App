import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock3, MapPin, NotebookTabs } from 'lucide-react';
import { TutorAvailabilitySlot } from '../../../../lib/matchmakingData';
import { formatTimeRange } from '../../../../lib/dashboardData';

function getDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayFirstOffset);
  const totalVisibleDays = mondayFirstOffset + lastDay.getDate();
  const cellCount = Math.ceil(totalVisibleDays / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      key: getDateKey(date),
      date,
      isCurrentMonth: date.getMonth() === month,
    };
  });
}

function formatCalendarHeading(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function TutorScheduleView({ slots }: { slots: TutorAvailabilitySlot[] }) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const seedDate = slots[0]?.starts_at ? new Date(slots[0].starts_at) : today;
    return new Date(seedDate.getFullYear(), seedDate.getMonth(), 1);
  });
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTutor, setSelectedTutor] = useState('all');
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);

  const subjectOptions = useMemo(
    () => ['all', ...Array.from(new Set(slots.map((slot) => slot.subject_name))).sort((a, b) => a.localeCompare(b, 'id-ID'))],
    [slots],
  );
  const tutorOptions = useMemo(
    () => ['all', ...Array.from(new Set(slots.map((slot) => slot.tutor_name))).sort((a, b) => a.localeCompare(b, 'id-ID'))],
    [slots],
  );

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (selectedSubject !== 'all' && slot.subject_name !== selectedSubject) {
        return false;
      }

      if (selectedTutor !== 'all' && slot.tutor_name !== selectedTutor) {
        return false;
      }

      return true;
    });
  }, [selectedSubject, selectedTutor, slots]);

  const monthSessions = useMemo(
    () =>
      filteredSlots.filter((slot) => {
        const startsAt = new Date(slot.starts_at);
        return startsAt.getFullYear() === currentMonth.getFullYear() && startsAt.getMonth() === currentMonth.getMonth();
      }),
    [currentMonth, filteredSlots],
  );

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, TutorAvailabilitySlot[]>();
    for (const slot of monthSessions) {
      const key = getDateKey(new Date(slot.starts_at));
      const existing = groups.get(key) ?? [];
      existing.push(slot);
      groups.set(key, existing);
    }

    for (const entries of groups.values()) {
      entries.sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime());
    }

    return groups;
  }, [monthSessions]);

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);

  return (
    <section>

      <div className="rounded-2xl border border-primary/10 bg-white p-4 shadow-md lg:p-5">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/15 text-primary transition hover:bg-secondary"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/15 text-primary transition hover:bg-secondary"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentMonth)}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mata Kuliah</span>
              <select
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                className="h-10 w-full rounded-lg border border-primary/15 bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="all">Semua Matkul</option>
                {subjectOptions.slice(1).map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tutor</span>
              <select
                value={selectedTutor}
                onChange={(event) => setSelectedTutor(event.target.value)}
                className="h-10 w-full rounded-lg border border-primary/15 bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="all">Semua Tutor</option>
                {tutorOptions.slice(1).map((tutor) => (
                  <option key={tutor} value={tutor}>
                    {tutor}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {slots.length === 0 && (
          <div className="mb-5 rounded-xl border border-primary/10 bg-secondary/30 px-4 py-3 text-sm font-medium text-muted-foreground">
            Belum ada jadwal tutor yang tersedia untuk ditampilkan.
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-primary/10">
          <div className="grid grid-cols-7 border-b border-primary/10 bg-secondary/60">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
              <div key={day} className="px-3 py-3 text-center text-sm font-bold text-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const daySessions = groupedByDay.get(day.key) ?? [];
              const isToday = day.key === getDateKey(today);
              const isHovered = hoveredDateKey === day.key;

              return (
                <div
                  key={day.key}
                  className={`relative min-h-[108px] border-b border-r border-primary/10 p-3 text-left align-top transition sm:min-h-[118px] ${day.isCurrentMonth ? 'bg-white hover:bg-secondary/40' : 'bg-secondary/30 text-muted-foreground/70'
                    } ${isHovered ? 'z-20 bg-primary/[0.05]' : ''}`}
                  onMouseEnter={() => setHoveredDateKey(daySessions.length > 0 ? day.key : null)}
                  onMouseLeave={() => setHoveredDateKey((current) => (current === day.key ? null : current))}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold ${isToday ? 'bg-primary text-white' : isHovered ? 'bg-primary/10 text-primary' : 'text-foreground'
                        }`}
                    >
                      {day.date.getDate()}
                    </span>
                    {daySessions.length > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{daySessions.length}</span>}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {daySessions.slice(0, 4).map((session) => (
                      <span key={session.id} className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                    ))}
                    {daySessions.length > 4 && <span className="text-[11px] font-bold text-primary">+{daySessions.length - 4}</span>}
                  </div>

                  {isHovered && daySessions.length > 0 && (
                    <div className="absolute left-1/2 top-[calc(100%-8px)] z-30 w-[280px] -translate-x-1/2 rounded-2xl border border-primary/15 bg-white p-4 text-left shadow-2xl">
                      <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-primary/15 bg-white" />
                      <div className="relative">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detail Jadwal</p>
                        <h2 className="mt-2 text-base font-extrabold text-foreground">{formatCalendarHeading(day.key)}</h2>
                        <div className="mt-4 space-y-3">
                          {daySessions.map((session) => (
                            <article key={session.id} className="rounded-xl border border-primary/10 bg-secondary/20 p-3">
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-extrabold text-foreground">{session.tutor_name}</p>
                                  <p className="mt-1 text-xs font-medium text-muted-foreground">{session.subject_name}</p>
                                </div>
                                <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                                  {session.status}
                                </span>
                              </div>

                              <div className="space-y-1.5 text-xs font-medium text-foreground">
                                <p className="flex items-center gap-2">
                                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                                  {formatTimeRange(session.starts_at, session.ends_at)}
                                </p>
                                <p className="flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-primary" />
                                  {session.location ?? 'Online'}
                                </p>
                                {session.notes && (
                                  <p className="flex items-center gap-2">
                                    <NotebookTabs className="h-3.5 w-3.5 text-primary" />
                                    {session.notes}
                                  </p>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
