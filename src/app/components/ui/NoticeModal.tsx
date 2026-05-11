import { CircleAlert, CircleCheck, X } from 'lucide-react';

export type NoticeModalState = {
  tone: 'success' | 'error';
  message: string;
};

export function NoticeModal({
  notice,
  onClose,
}: {
  notice: NoticeModalState;
  onClose: () => void;
}) {
  const isSuccess = notice.tone === 'success';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-2xl border border-primary/10 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
              }`}
            >
              {isSuccess ? <CircleCheck className="h-6 w-6" /> : <CircleAlert className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-foreground">{isSuccess ? 'Berhasil' : 'Terjadi Kesalahan'}</h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">{notice.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Tutup notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              isSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
