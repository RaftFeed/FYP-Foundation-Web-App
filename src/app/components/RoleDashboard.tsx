import { LogOut } from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  student: 'Student',
  tutor: 'Tutor',
};

export function RoleDashboard({ role }: { role: Exclude<UserRole, 'admin'> }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">{roleLabels[role]}</p>
            <h1 className="text-2xl text-foreground">{roleLabels[role]} Dashboard</h1>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-primary transition hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
        <p className="mt-4 max-w-xl text-foreground">
          The {roleLabels[role].toLowerCase()} dashboard route is ready. Its full dashboard can be built next while admin is available now.
        </p>
      </main>
    </div>
  );
}
