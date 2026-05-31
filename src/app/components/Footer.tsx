import { Mail, Phone, MapPin } from 'lucide-react';
import logoImage from '../../img/FYP_no_bg.png';

export function Footer() {
  return (
    <footer className="bg-foreground text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] mb-12">
          <div>
            <div className="flex items-center gap-1 mb-4">
              <div className="w-12 h-12 overflow-hidden items-center justify-center">
                <img src={logoImage} alt="FYP Foundation" className="h-full w-full object-contain" />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                FYP<span className="text-accent"> Foundation</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-5">
              Platform bimbingan belajar terpercaya untuk mahasiswa PPKU. Belajar lebih efektif, raih nilai terbaik.
            </p>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span>fypfoundation2023@gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <span>+62 858 8823 8018</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span>Kampus IPB, Bogor</span>
              </div>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 w-full max-w-2xl justify-self-center">
            <div className="text-center sm:text-left">
              <h4 className="text-white mb-4">Untuk Mahasiswa</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                {[
                  { label: 'Katalog Mata Kuliah', href: '#matkul' },
                  { label: 'List Tutor', href: '#katalog' },
                  { label: 'Bergabung Kelas Grup', href: '#panduan' },
                  { label: 'Testimoni', href: '#testimoni' },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="hover:text-white hover:translate-x-0.5 transition-all inline-block">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-center sm:text-left">
              <h4 className="text-white mb-4">Untuk Tutor</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                {[
                  { label: 'Daftar Jadi Tutor', href: '#beranda' },
                  { label: 'Panduan Tutor', href: '#panduan' },
                  { label: 'Dashboard Tutor', href: '#katalog' },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="hover:text-white hover:translate-x-0.5 transition-all inline-block">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <div>
            <p>&copy; 2026 FYP Foundation. Hak cipta dilindungi undang-undang.</p>
          </div>
          <div className="flex gap-4">
            <p>
              Aksi nyata alumni IPB untuk Tri Dharma Perguruan Tinggi melalui Bimbingan belajar
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
