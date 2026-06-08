import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock3, MapPin, Timer, Trash2, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrency, formatDate, formatTimeRange } from '../../../../lib/dashboardData';
import { TutorAvailabilitySlot, MatchmakingLobby, fetchSlotStudents, fetchLobbyForSlot, fetchLobbyStudents, fetchLobbyMemberCount, fetchProfileDisplayName, kickMatchmakingLobbyMember, SlotStudent } from '../../../../lib/matchmakingData';

function DetailCountdown({ expiresAt }: { expiresAt: string }) {
  const computeRemaining = useCallback(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  }, [expiresAt]);

  const [remaining, setRemaining] = useState(computeRemaining);

  useEffect(() => {
    setRemaining(computeRemaining());
    const interval = window.setInterval(() => {
      setRemaining(computeRemaining());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [computeRemaining]);

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
        <Timer className="h-3 w-3" />
        Waktu habis
      </span>
    );
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining < 3600;
  const label = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
        isUrgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700'
      }`}
    >
      <Timer className="h-3 w-3" />
      {label}
    </span>
  );
}

const slotStatusLabels: Record<TutorAvailabilitySlot['status'] | 'expired', string> = {
  available: 'Tersedia',
  held: 'Lobby Terbuat',
  booked: 'Terbooking',
  cancelled: 'Dibatalkan',
  expired: 'Kadaluarsa',
};

function slotStatusClasses(status: TutorAvailabilitySlot['status'] | 'expired') {
  switch (status) {
    case 'available':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'held':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'booked':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'expired':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'cancelled':
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function getEffectiveStatus(slot: TutorAvailabilitySlot): TutorAvailabilitySlot['status'] | 'expired' {
  if (new Date(slot.ends_at).getTime() < Date.now()) {
    return 'expired';
  }
  return slot.status;
}

export function SlotCard({
  slot,
  onViewStudents,
  onViewLobby,
  onCancel,
  onDelete,
  onCreateLobby,
  showCancel = true,
}: {
  slot: TutorAvailabilitySlot;
  onViewStudents?: (slot: TutorAvailabilitySlot) => void;
  onViewLobby?: (slotId: string) => void | Promise<void>;
  onCancel?: (slot: TutorAvailabilitySlot) => void;
  onDelete?: (slot: TutorAvailabilitySlot) => void;
  onCreateLobby?: (slotId: string) => void;
  showCancel?: boolean;
}) {
  const effectiveStatus = getEffectiveStatus(slot);
  const isExpired = effectiveStatus === 'expired';
  const canCancel = showCancel && slot.status === 'available' && !isExpired;
  const canDelete = onDelete && (slot.status === 'available' || slot.status === 'cancelled' || isExpired);

  return (
    <article className={`rounded-xl border bg-white p-5 shadow-md ${isExpired ? 'border-red-200 opacity-75' : 'border-primary/10'}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${slotStatusClasses(effectiveStatus)}`}>
              {slotStatusLabels[effectiveStatus]}
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
        {onDelete && canDelete && (
          <button
            type="button"
            onClick={() => onDelete(slot)}
            className="flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 transition"
          >
            <Trash2 className="h-4 w-4" />
            Hapus Slot
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
  const { user } = useAuth();
  const [students, setStudents] = useState<SlotStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(lobby.creator_name);
  const [liveMemberCount, setLiveMemberCount] = useState<number>(lobby.member_count ?? 0);
  const [kickError, setKickError] = useState<string | null>(null);
  const [kickingStudentId, setKickingStudentId] = useState<string | null>(null);
  const [pendingKickStudent, setPendingKickStudent] = useState<SlotStudent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setKickError(null);
    setCreatorDisplayName(lobby.creator_name);
    void fetchProfileDisplayName(lobby.creator_id).then((name) => {
      if (!cancelled && name) {
        setCreatorDisplayName(name);
      }
    });
    void fetchLobbyMemberCount(lobby.id).then((count) => {
      if (!cancelled) {
        setLiveMemberCount(count);
      }
    });
    fetchLobbyStudents(lobby.id, lobby.tutor_user_id)
      .then((data) => {
        if (!cancelled) setStudents(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lobby.id, lobby.tutor_user_id, lobby.creator_id, lobby.creator_name, refreshKey]);

  const handleKickStudent = async (studentId: string) => {
    setKickingStudentId(studentId);
    setKickError(null);
    try {
      await kickMatchmakingLobbyMember(lobby.id, studentId);
      setRefreshKey((value) => value + 1);
    } catch (kickErr) {
      setKickError(kickErr instanceof Error ? kickErr.message : 'Gagal mengeluarkan anggota dari lobby.');
    } finally {
      setKickingStudentId(null);
      setPendingKickStudent(null);
    }
  };

  const memberCount = liveMemberCount || students?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-primary/10 bg-white p-5 shadow-xl"
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
              <span>{memberCount}/{lobby.max_participants} siswa</span>
              {(lobby.status === 'open' || lobby.status === 'pending_payment') && (
                <>
                  <span>·</span>
                  <DetailCountdown expiresAt={lobby.expires_at} />
                </>
              )}
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

        {lobby.description && (
          <div className="mb-4 rounded-lg border border-primary/10 bg-secondary/40 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Catatan Pembuat</p>
            <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{lobby.description}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-primary/10 bg-primary/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pembuat Lobby</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{creatorDisplayName ?? `User ${lobby.creator_id.slice(0, 8)}`}</p>
            </div>
            <div className="rounded-lg border border-primary/10 bg-secondary/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Siswa Bergabung</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{memberCount} / {lobby.max_participants}</p>
            </div>
          </div>

          <p className="mb-2 text-sm font-semibold text-foreground">Tutor</p>
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/5 px-4 py-3">
            {lobby.tutor_image_url ? (
              <img
                src={lobby.tutor_image_url}
                alt={lobby.tutor_name}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {lobby.tutor_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{lobby.tutor_name}</p>
              <p className="text-xs font-medium text-primary">Tutor</p>
            </div>
          </div>

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
              {kickError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {kickError}
                </div>
              )}
              {students.map((s) => (
                <div key={s.student_id} className="flex items-center gap-3 rounded-lg border border-primary/10 bg-secondary/30 px-4 py-3">
                  {s.student_image_url ? (
                    <img src={s.student_image_url} alt={s.student_name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {s.student_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{s.student_name}</p>
                      {(lobby.status === 'pending_payment' || lobby.status === 'paid' || lobby.status === 'completed') && (
                        <span className={`inline-flex min-w-[4.75rem] items-center justify-center rounded-full px-2.5 py-0.5 text-center text-[9px] font-bold leading-tight ${
                          s.payment_status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {s.payment_status === 'paid' ? 'Lunas' : 'Belum Lunas'}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{s.student_email}</p>
                  </div>
                  {lobby.current_user_is_creator && s.student_id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => setPendingKickStudent(s)}
                      disabled={kickingStudentId === s.student_id}
                      className="shrink-0 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Kick
                    </button>
                  )}
                  <div className="shrink-0 text-right">
                    <p className="mt-1 text-[8px] font-medium text-muted-foreground">Gabung {new Date(s.joined_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
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
      {pendingKickStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/35 p-4" onClick={() => setPendingKickStudent(null)}>
          <div className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-foreground">Keluarkan anggota?</h3>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {pendingKickStudent.student_name} akan dikeluarkan dari lobby. Aksi ini akan menandai status ke <span className="font-semibold text-foreground">left</span> dan menghapusnya dari roster aktif.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingKickStudent(null)}
                className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary transition"
                disabled={kickingStudentId !== null}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleKickStudent(pendingKickStudent.student_id)}
                disabled={kickingStudentId === pendingKickStudent.student_id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {kickingStudentId === pendingKickStudent.student_id ? 'Memproses...' : 'Ya, keluarkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderStudentAvatar(student: SlotStudent) {
  if (student.student_image_url) {
    return <img src={student.student_image_url} alt={student.student_name} className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {student.student_name.charAt(0).toUpperCase()}
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
              {students.map((s) => (
                <div key={s.student_id} className="flex items-center gap-3 rounded-lg border border-primary/10 bg-secondary/30 px-4 py-3">
                  {renderStudentAvatar(s)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{s.student_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.student_email}</p>
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
