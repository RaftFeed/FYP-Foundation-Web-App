import { useState, useEffect } from 'react';
import { CalendarDays, Clock3, MapPin, Trash2, UserRound, Users, X } from 'lucide-react';
import { formatCurrency, formatDate, formatTimeRange } from '../../../../lib/dashboardData';
import { TutorAvailabilitySlot, MatchmakingLobby, fetchSlotStudents, fetchLobbyForSlot, SlotStudent } from '../../../../lib/matchmakingData';

const slotStatusLabels: Record<TutorAvailabilitySlot['status'], string> = {
  available: 'Tersedia',
  held: 'Di-hold Lobby',
  booked: 'Terbooking',
  cancelled: 'Dibatalkan',
};

function slotStatusClasses(status: TutorAvailabilitySlot['status']) {
  switch (status) {
    case 'available':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'held':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'booked':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'cancelled':
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function SlotCard({
  slot,
  onViewStudents,
  onViewLobby,
  onCancel,
  onCreateLobby,
  showCancel = true,
}: {
  slot: TutorAvailabilitySlot;
  onViewStudents?: (slot: TutorAvailabilitySlot) => void;
  onViewLobby?: (slotId: string) => void | Promise<void>;
  onCancel?: (slot: TutorAvailabilitySlot) => void;
  onCreateLobby?: (slotId: string) => void;
  showCancel?: boolean;
}) {
  const canCancel = showCancel && slot.status === 'available';

  return (
    <article className="rounded-xl border border-primary/10 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${slotStatusClasses(slot.status)}`}>
              {slotStatusLabels[slot.status]}
            </span>
            {slot.recurrence_pattern === 'weekly' && (
              <span className="inline-flex rounded-md border border-primary/10 bg-white px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                Mingguan #{slot.recurrence_index + 1}
              </span>
            )}
          </div>
          <h3 className="text-lg font-extrabold text-foreground">{slot.subject_name}</h3>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{slot.location}</p>
        </div>
        <p className="shrink-0 text-right text-sm font-extrabold text-primary">{formatCurrency(slot.price_total)}</p>
      </div>

      <div className="mb-4 space-y-2 text-sm font-medium text-foreground">
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          {formatDate(slot.starts_at)}
        </p>
        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 shrink-0 text-primary" />
          {formatTimeRange(slot.starts_at, slot.ends_at)}
        </p>
        <p className="flex items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0 text-primary" />
          Maksimal {slot.max_participants} siswa
        </p>
      </div>

      {slot.notes && (
        <p className="mb-4 rounded-lg bg-secondary p-3 text-sm font-medium text-muted-foreground">{slot.notes}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(onViewStudents || onViewLobby) && (slot.status === 'available' || slot.status === 'held' || slot.status === 'booked') && (
          <button
            type="button"
            onClick={() => {
              if (onViewLobby) {
                void onViewLobby(slot.id);
              } else if (onViewStudents) {
                onViewStudents(slot);
              }
            }}
            className="flex h-10 items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 text-sm font-semibold text-primary hover:bg-secondary transition"
          >
            <Users className="h-4 w-4" />
            Lihat Siswa
          </button>
        )}
        {onCreateLobby && slot.status === 'available' && (
          <button
            type="button"
            onClick={() => onCreateLobby(slot.id)}
            className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 transition shadow-sm"
          >
            <Users className="h-4 w-4" />
            Buat Lobby
          </button>
        )}
        {onCancel && canCancel && (
          <button
            type="button"
            onClick={() => onCancel(slot)}
            className="flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 hover:border-red-300 transition"
          >
            <Trash2 className="h-4 w-4" />
            Batalkan Slot
          </button>
        )}
      </div>
    </article>
  );
}

export function LobbyDetailModal({
  lobby,
  onClose,
}: {
  lobby: MatchmakingLobby;
  onClose: () => void;
}) {
  const isMemberOrCreator = lobby.current_user_is_member || lobby.current_user_is_creator;
  const [students, setStudents] = useState<SlotStudent[] | null>(isMemberOrCreator ? null : []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isMemberOrCreator);

  useEffect(() => {
    if (!isMemberOrCreator) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSlotStudents(lobby.availability_slot_id)
      .then((data) => { if (!cancelled) setStudents(data); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isMemberOrCreator, lobby.availability_slot_id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-5 shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">{lobby.title}</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {lobby.subject_name} · {lobby.tutor_name}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
              <span>{formatDate(lobby.starts_at)}</span>
              <span>·</span>
              <span>{formatTimeRange(lobby.starts_at, lobby.ends_at)}</span>
              <span>·</span>
              <span>{lobby.member_count ?? 0}/{lobby.max_participants} siswa</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-lg border border-primary/10 bg-secondary/30 px-4 py-3 mb-4 text-sm">
          <p className="font-semibold text-foreground">Dibuat oleh</p>
          <p className="text-muted-foreground">{lobby.creator_name ?? 'Tidak diketahui'}</p>
        </div>

        {!isMemberOrCreator && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
            <p className="font-semibold mb-1">Kamu belum bergabung di lobby ini</p>
            <p className="text-amber-700">Gabung lobby untuk melihat daftar semua siswa yang mengikuti.</p>
          </div>
        )}

        {isMemberOrCreator && (
          <div className="flex-1 overflow-y-auto pr-1">
            <p className="mb-2 text-sm font-semibold text-foreground">Daftar Siswa</p>
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            )}
            {!loading && error && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                <p className="font-semibold mb-1">Tidak dapat memuat daftar siswa</p>
                <p className="text-amber-700">{error}</p>
              </div>
            )}
            {!loading && students && students.length === 0 && (
              <div className="py-8 text-center text-sm font-medium text-muted-foreground">
                Belum ada siswa yang bergabung.
              </div>
            )}
            {!loading && students && students.length > 0 && (
              <div className="space-y-2">
                {students.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-primary/10 bg-secondary/30 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{s.student_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.student_email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export function StudentListModal({
  slot,
  onClose,
}: {
  slot: TutorAvailabilitySlot;
  onClose: () => void;
}) {
  const [students, setStudents] = useState<SlotStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSlotStudents(slot.id)
      .then((data) => {
        if (!cancelled) setStudents(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slot.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-5 shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Daftar Siswa</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {slot.subject_name} · {formatDate(slot.starts_at)} · {formatTimeRange(slot.starts_at, slot.ends_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
              <p className="font-semibold mb-1">Tidak dapat memuat daftar siswa</p>
              <p className="text-amber-700">{error}</p>
              <p className="mt-2 text-xs text-amber-600">
                Data siswa hanya tersedia setelah fungsi DB <code className="font-mono">get_slot_students</code> diaktifkan oleh Admin.
              </p>
            </div>
          )}

          {!loading && students && students.length === 0 && (
            <div className="py-10 text-center text-sm font-medium text-muted-foreground">
              Belum ada siswa yang bergabung di slot ini.
            </div>
          )}

          {!loading && students && students.length > 0 && (
            <div className="space-y-2">
              {students.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-primary/10 bg-secondary/30 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{s.student_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.student_email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
