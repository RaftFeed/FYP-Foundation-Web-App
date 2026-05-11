import { useState } from 'react';
import { Atom, Calculator, FlaskConical, Code2, Binary, Dna, X, AlertTriangle, Users, ArrowRight } from 'lucide-react';

interface MatkulItem {
  id: string;
  name: string;
  code: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  kelasAktif: number;
  description: string;
}

const matkulList: MatkulItem[] = [
  {
    id: 'fisika',
    name: 'Fisika Dasar',
    code: 'FIS101',
    icon: Atom,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    kelasAktif: 3,
    description: 'Mekanika, termodinamika, gelombang & optika',
  },
  {
    id: 'kalkulus',
    name: 'Kalkulus',
    code: 'MAT101',
    icon: Calculator,
    color: 'text-primary',
    bgColor: 'bg-secondary',
    kelasAktif: 5,
    description: 'Limit, turunan, integral, dan deret',
  },
  {
    id: 'kimia',
    name: 'Kimia Dasar',
    code: 'KIM101',
    icon: FlaskConical,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    kelasAktif: 2,
    description: 'Stoikiometri, ikatan kimia, larutan',
  },
  {
    id: 'pemrograman',
    name: 'Pemrograman',
    code: 'KOM101',
    icon: Code2,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    kelasAktif: 0,
    description: 'Dasar algoritma & pemrograman Python/C++',
  },
  {
    id: 'matdis',
    name: 'Matematika Diskrit',
    code: 'MAT201',
    icon: Binary,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    kelasAktif: 0,
    description: 'Logika, graf, kombinatorika, relasi',
  },
  {
    id: 'biologi',
    name: 'Biologi Umum',
    code: 'BIO101',
    icon: Dna,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    kelasAktif: 4,
    description: 'Sel, genetika, ekologi, evolusi',
  },
];

interface CreateGroupModalProps {
  matkul: MatkulItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

function CreateGroupModal({ matkul, onClose, onConfirm }: CreateGroupModalProps) {
  if (!matkul) return null;

  const Icon = matkul.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="create-group-title">
        <div className="h-1.5 bg-gradient-to-r from-primary to-accent w-full" aria-hidden="true" />

        <div className="p-8">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-border focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </button>

          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          </div>

          <div className="flex justify-center mb-4">
            <span
              className={`inline-flex items-center gap-2 ${matkul.bgColor} ${matkul.color} text-sm px-4 py-1.5 rounded-full border border-current/20`}
              style={{ fontWeight: 600 }}
            >
              <Icon className="w-4 h-4" />
              {matkul.name} - {matkul.code}
            </span>
          </div>

          <h3 className="text-center text-foreground mb-2" id="create-group-title">Belum Ada Kelas Aktif</h3>
          <p className="text-center text-muted-foreground mb-6 text-sm leading-relaxed">
            Belum ada kelas grup aktif untuk mata kuliah ini. Masuk sebagai student untuk memilih slot tutor yang tersedia dan membuat grup baru.
          </p>

          <div className="bg-secondary rounded-xl p-4 mb-6 flex gap-3 border border-primary/10">
            <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-primary/80">
              Grup public atau private dibuat dari jadwal tutor yang sudah tersedia di database.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-border text-muted-foreground rounded-xl hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-medium"
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all text-sm font-medium flex items-center justify-center gap-2 shadow-md"
            >
              <Users className="w-4 h-4" aria-hidden="true" />
              Masuk & Buat Grup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MatkulCatalog() {
  const [selectedMatkul, setSelectedMatkul] = useState<MatkulItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCardClick = (matkul: MatkulItem) => {
    if (matkul.kelasAktif === 0) {
      setSelectedMatkul(matkul);
      setShowCreateModal(true);
    }
  };

  const handleConfirmCreate = () => {
    setShowCreateModal(false);
    setSelectedMatkul(null);
    window.location.href = `${import.meta.env.BASE_URL}login`;
  };

  return (
    <>
      <section id="matkul" className="py-20 bg-secondary">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
            <div>
              <p className="text-primary text-sm mb-2" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Mata Kuliah PPKU
              </p>
              <h2 className="text-foreground">
                Pilih & Gabung
                <br />
                <span className="text-primary">Kelas Belajar</span>
              </h2>
            </div>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              Bergabung ke kelas grup aktif atau buat grup baru jika belum tersedia. Belajar jadi lebih efektif!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {matkulList.map((matkul) => {
              const Icon = matkul.icon;
              const hasKelas = matkul.kelasAktif > 0;

              return (
                <div
                  key={matkul.id}
                  onClick={() => handleCardClick(matkul)}
                  className={`bg-white rounded-2xl border p-6 transition-all duration-300 group relative overflow-hidden ${
                    hasKelas
                      ? 'border-border hover:border-primary hover:shadow-xl hover:-translate-y-1 cursor-pointer'
                      : 'border-dashed border-border hover:border-amber-400 hover:shadow-lg cursor-pointer'
                  }`}
                >
                  <div
                    className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl ${
                      hasKelas ? 'bg-gradient-to-br from-secondary/50 to-transparent' : 'bg-gradient-to-br from-amber-50/50 to-transparent'
                    }`}
                  />

                  <div className="relative">
                    <div className="flex items-start justify-between mb-5">
<div className={`w-[52px] h-[52px] ${matkul.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`} aria-hidden="true">
                        <Icon className={`w-6 h-6 ${matkul.color}`} />
                      </div>

                      {hasKelas ? (
                        <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-xs px-2.5 py-1 rounded-full" style={{ fontWeight: 600 }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {matkul.kelasAktif} Kelas Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-1 rounded-full" style={{ fontWeight: 600 }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          0 Kelas Tersedia
                        </span>
                      )}
                    </div>

                    <div className="mb-5">
                      <h3 className="text-foreground mb-1">{matkul.name}</h3>
                      <span className="inline-block text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md mb-2" style={{ fontWeight: 600 }}>
                        {matkul.code}
                      </span>
                      <p className="text-muted-foreground text-sm leading-relaxed">{matkul.description}</p>
                    </div>

                    <div className="pt-4 border-t border-border">
                      {hasKelas ? (
                        <button className="w-full py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all text-sm flex items-center justify-center gap-2 shadow-sm">
                          Lihat & Gabung Kelas
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button className="w-full py-2.5 border-2 border-amber-400 text-amber-700 rounded-xl hover:bg-amber-50 transition-all text-sm flex items-center justify-center gap-2">
                          <Users className="w-4 h-4" />
                          Buat Grup Baru
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span>Kelas aktif - langsung bergabung</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Belum ada kelas - klik untuk buat grup baru</span>
            </div>
          </div>
        </div>
      </section>

      {showCreateModal && (
        <CreateGroupModal
          matkul={selectedMatkul}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedMatkul(null);
          }}
          onConfirm={handleConfirmCreate}
        />
      )}

    </>
  );
}
