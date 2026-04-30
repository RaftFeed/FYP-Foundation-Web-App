import { BarChart3, BookOpen, CalendarDays, GraduationCap, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const stats = [
  { label: 'Total Students', value: '128', icon: Users },
  { label: 'Active Tutors', value: '24', icon: GraduationCap },
  { label: 'Courses Listed', value: '18', icon: BookOpen },
  { label: 'Sessions This Week', value: '76', icon: CalendarDays },
];

const pendingTutors = [
  { name: 'Nadia Putri', subject: 'Kalkulus', status: 'Review documents' },
  { name: 'Reza Mahendra', subject: 'Fisika Dasar', status: 'Interview needed' },
  { name: 'Mira Anggraini', subject: 'Pemrograman', status: 'Ready to approve' },
];

export function AdminDashboard() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#admin" className="flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">Admin</p>
              <p className="text-lg font-extrabold text-foreground">FYP Foundation</p>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
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
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">Dashboard</p>
            <h1 className="mt-2 text-foreground">Admin Control Center</h1>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90">
            <BarChart3 className="h-4 w-4" />
            View Reports
          </button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <article key={stat.label} className="rounded-lg border border-border bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-extrabold text-foreground">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{stat.label}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl text-foreground">Tutor Verification</h2>
                <p className="mt-1 text-sm text-muted-foreground">Review tutor applications before they appear in catalog.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingTutors.map((tutor) => (
                    <tr key={tutor.name}>
                      <td className="px-4 py-4 font-semibold text-foreground">{tutor.name}</td>
                      <td className="px-4 py-4 text-muted-foreground">{tutor.subject}</td>
                      <td className="px-4 py-4 text-muted-foreground">{tutor.status}</td>
                      <td className="px-4 py-4">
                        <button className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-secondary">
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-lg border border-border bg-white p-6 shadow-sm">
            <h2 className="text-2xl text-foreground">Admin Tasks</h2>
            <div className="mt-5 space-y-4">
              {['Approve pending tutors', 'Check reported sessions', 'Update course availability'].map((task) => (
                <label key={task} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-border text-primary" />
                  <span className="font-semibold text-foreground">{task}</span>
                </label>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
