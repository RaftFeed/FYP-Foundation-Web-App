import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { TutorAvailabilitySlot, MatchmakingLobby, fetchMatchmakingLobbies } from '../../../../lib/matchmakingData';
import { formatTimeRange } from '../../../../lib/dashboardData';
import { SlotCard, StudentListModal, LobbyDetailModal } from '../tutor-dashboard/SlotCard';

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
    return { key: getDateKey(date), date, isCurrentMonth: date.getMonth() === month };
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

export function TutorScheduleView({
  slots,
  isStudentView,
  onCreateLobby,
  onJoinLobby,
}: {
  slots: TutorAvailabilitySlot[];
  isStudentView?: boolean;
  onCreateLobby?: (slotId: string) => void;
  onJoinLobby?: (lobby: MatchmakingLobby) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTutor, setSelectedTutor] = useState('all');

  // Hover state — small pill tooltip with fixed positioning (escapes overflow)
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Click state — opens expanded panel below calendar
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Tutor modal: direct slot → fetchSlotStudents
  const [studentModalSlot, setStudentModalSlot] = useState<TutorAvailabilitySlot | null>(null);

  // Student view: map slotId → lobby (only if user is member/creator)
  const [slotLobbyMap, setSlotLobbyMap] = useState<Map<string, MatchmakingLobby>>(new Map());
  const [lobbyDetailTarget, setLobbyDetailTarget] = useState<MatchmakingLobby | null>(null);

  useEffect(() => {
    if (!isStudentView) return;
    let cancelled = false;
    fetchMatchmakingLobbies()
      .then((lobbies) => {
        if (cancelled) return;
        const map = new Map<string, MatchmakingLobby>();
        for (const lobby of lobbies) {
          if (
            lobby.availability_slot_id &&
            lobby.status !== 'expired' &&
            lobby.status !== 'cancelled'
          ) {
            // Prioritize lobbies where user is a member
            if (lobby.current_user_is_member) {
              map.set(lobby.availability_slot_id, lobby);
            } else if (!map.has(lobby.availability_slot_id) && lobby.visibility === 'public') {
              // Otherwise, map public lobbies so user can join
              map.set(lobby.availability_slot_id, lobby);
            }
          }
        }
        setSlotLobbyMap(map);
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [isStudentView]);

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
      if (selectedSubject !== 'all' && slot.subject_name !== selectedSubject) return false;
      if (selectedTutor !== 'all' && slot.tutor_name !== selectedTutor) return false;
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

  const handleDayClick = useCallback((dayKey: string) => {
    setSelectedDateKey((prev) => (prev === dayKey ? null : dayKey));
  }, []);

  useEffect(() => {
    if (selectedDateKey && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedDateKey]);

  const selectedDateSessions = selectedDateKey ? groupedByDay.get(selectedDateKey) ?? [] : [];
  const firstSessionDay = Array.from(groupedByDay.entries()).find(([, s]) => s.length > 0);

  return (
    <section className="flex flex-col">
      <div className="flex flex-col rounded-2xl border border-primary/10 bg-white p-3 shadow-md lg:p-4">
        {/* Filters */}
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 text-primary transition hover:bg-secondary"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 text-primary transition hover:bg-secondary"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-lg border border-primary/15 px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(currentMonth)}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:w-[380px]">
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mata Kuliah</span>
              <select
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                className="h-8 w-full rounded-lg border border-primary/15 bg-white px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="all">Semua Matkul</option>
                {subjectOptions.slice(1).map((subject) => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tutor</span>
              <select
                value={selectedTutor}
                onChange={(event) => setSelectedTutor(event.target.value)}
                className="h-8 w-full rounded-lg border border-primary/15 bg-white px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="all">Semua Tutor</option>
                {tutorOptions.slice(1).map((tutor) => (
                  <option key={tutor} value={tutor}>{tutor}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {slots.length === 0 && (
          <div className="mb-3 rounded-xl border border-primary/10 bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground">
            Belum ada jadwal tutor yang tersedia untuk ditampilkan.
          </div>
        )}

        {/* Calendar grid */}
        <div className="relative flex flex-col rounded-2xl border border-primary/10">
          <div className="grid grid-cols-7 border-b border-primary/10 bg-secondary/60 rounded-t-2xl">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
              <div key={day} className="px-2 py-1.5 text-center text-xs font-bold text-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 flex-1">
            {calendarDays.map((day) => {
              const daySessions = groupedByDay.get(day.key) ?? [];
              const isToday = day.key === getDateKey(today);
              const isSelected = selectedDateKey === day.key;
              const hasSessions = daySessions.length > 0;

              return (
                <div
                  key={day.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => hasSessions && handleDayClick(day.key)}
                  onKeyDown={(e) => { if (hasSessions && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleDayClick(day.key); } }}
                  onMouseEnter={(e) => {
                    if (!hasSessions) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoverPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                    setHoveredDateKey(day.key);
                  }}
                  onMouseLeave={() => {
                    setHoverPos(null);
                    setHoveredDateKey(null);
                  }}
                  className={`relative border-b border-r border-primary/10 p-2 text-left align-top transition ${day.isCurrentMonth
                      ? isSelected
                        ? 'bg-primary/[0.08] ring-1 ring-inset ring-primary/30'
                        : 'bg-white hover:bg-secondary/40'
                      : 'bg-secondary/30 text-muted-foreground/70'
                    } ${hasSessions ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${isToday ? 'bg-primary text-white' : isSelected ? 'bg-primary/15 text-primary' : 'text-foreground'
                        }`}
                    >
                      {day.date.getDate()}
                    </span>
                    {hasSessions && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {daySessions.length}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hover pill tooltip */}
        {hoveredDateKey && hoverPos && (
          <div
            className="pointer-events-none fixed z-[100] -translate-x-1/2 rounded-lg border border-primary/15 bg-white px-3 py-1.5 text-xs font-semibold text-foreground shadow-xl"
            style={{ left: hoverPos.x, top: hoverPos.y }}
          >
            {groupedByDay.get(hoveredDateKey)?.length ?? 0}{' '}
            {(groupedByDay.get(hoveredDateKey)?.length ?? 0) === 1 ? 'jadwal' : 'jadwal'} — klik untuk lihat
          </div>
        )}

        {/* Expanded detail panel */}
        {selectedDateKey && (
          <div ref={panelRef} className="mt-4 rounded-2xl border border-primary/15 bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{selectedDateSessions.length} Sesi</p>
                <h2 className="mt-1 text-xl font-extrabold text-foreground">{formatCalendarHeading(selectedDateKey)}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateKey(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/15 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Tutup panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedDateSessions.length === 0 ? (
              <p className="py-6 text-center text-sm font-medium text-muted-foreground">Tidak ada sesi pada tanggal ini.</p>
            ) : (
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {selectedDateSessions.map((session) => {
                  const lobby = isStudentView ? slotLobbyMap.get(session.id) : undefined;
                  const isLocked = lobby ? (new Date(lobby.starts_at).getTime() - Date.now() < 24 * 60 * 60 * 1000) : false;
                  const isFull = lobby ? (lobby.member_count >= lobby.max_participants) : false;
                  const canJoin = lobby && !lobby.current_user_is_member && !isFull && !isLocked && ['open', 'pending_payment', 'paid'].includes(lobby.status);

                  return (
                    <SlotCard
                      key={session.id}
                      slot={session}
                      onViewStudents={isStudentView ? undefined : setStudentModalSlot}
                      onViewLobby={lobby && lobby.current_user_is_member ? () => setLobbyDetailTarget(lobby) : undefined}
                      onCreateLobby={isStudentView && !lobby ? onCreateLobby : undefined}
                      onJoinLobby={isStudentView && canJoin && onJoinLobby ? () => onJoinLobby(lobby) : undefined}
                      showCancel={false}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {slots.length > 0 && monthSessions.length === 0 && (
          <div className="mt-4 rounded-xl border border-primary/10 bg-secondary/30 px-4 py-3 text-sm font-medium text-muted-foreground">
            Tidak ada jadwal pada bulan ini.
            {firstSessionDay && (
              <button
                type="button"
                onClick={() => {
                  const [year, month] = firstSessionDay[0].split('-').map(Number);
                  setCurrentMonth(new Date(year, month - 1, 1));
                }}
                className="ml-2 font-semibold text-primary underline hover:text-primary/80"
              >
                Lonkat ke tanggal {formatCalendarHeading(firstSessionDay[0])}
              </button>
            )}
          </div>
        )}
      </div>

      {studentModalSlot && (
        <StudentListModal slot={studentModalSlot} onClose={() => setStudentModalSlot(null)} />
      )}

      {lobbyDetailTarget && (
        <LobbyDetailModal lobby={lobbyDetailTarget} onClose={() => setLobbyDetailTarget(null)} />
      )}
    </section>
  );
}
