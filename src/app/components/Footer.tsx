import { GraduationCap, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-foreground text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
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

          <div>
            <h4 className="text-white mb-4">Untuk Mahasiswa</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              {['Katalog Mata Kuliah', 'Cari Tutor', 'Bergabung Kelas Grup', 'Buat Kelas Privat', 'Ulasan Mahasiswa'].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-white hover:translate-x-0.5 transition-all inline-block">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white mb-4">Untuk Tutor</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              {['Daftar Jadi Tutor', 'Panduan Tutor', 'Dashboard Tutor', 'Kebijakan Tutor', 'Kisah Sukses'].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-white hover:translate-x-0.5 transition-all inline-block">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white mb-4">Perusahaan</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              {['Tentang Kami', 'Blog & Artikel', 'Karir', 'Kebijakan Privasi', 'Syarat & Ketentuan'].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-white hover:translate-x-0.5 transition-all inline-block">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
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
