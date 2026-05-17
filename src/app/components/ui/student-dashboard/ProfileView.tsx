import { UserRound } from 'lucide-react';
import { Booking } from '../../../../lib/dashboardData';

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-primary/10 bg-secondary p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-primary">{value}</p>
    </div>
  );
}

export function ProfileView({
  bookings,
  displayName,
  email,
  isSavingName,
  nameInput,
  onNameChange,
  onNameSave,
}: {
  bookings: Booking[];
  displayName: string;
  email: string;
  isSavingName: boolean;
  nameInput: string;
  onNameChange: (value: string) => void;
  onNameSave: () => void;
}) {
  return (
    <section>
      <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <UserRound className="h-9 w-9 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground lg:text-3xl">{displayName}</h1>
            <p className="text-sm font-medium text-muted-foreground">{email}</p>
          </div>
        </div>
        <form
          className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onNameSave();
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-foreground">Nama lengkap</span>
            <input
              type="text"
              value={nameInput}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Masukkan nama lengkap"
              className="mt-2 h-11 w-full rounded-lg border border-primary/20 bg-white px-4 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <button
            type="submit"
            disabled={isSavingName}
            className="h-11 rounded-lg bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {isSavingName ? 'Menyimpan...' : 'Simpan nama'}
          </button>
        </form>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <ProfileStat label="Total Booking" value={String(bookings.length)} />
          <ProfileStat label="Aktif" value={String(bookings.filter((booking) => booking.status === 'upcoming' || booking.status === 'pending_payment').length)} />
          <ProfileStat label="Selesai" value={String(bookings.filter((booking) => booking.status === 'completed').length)} />
        </div>
      </div>
    </section>
  );
}
