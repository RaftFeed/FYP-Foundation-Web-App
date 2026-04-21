import { useState } from 'react';
import { Menu, X, GraduationCap } from 'lucide-react';

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Beranda', href: '#beranda' },
    { label: 'Mata Kuliah', href: '#matkul' },
    { label: 'Katalog Tutor', href: '#katalog' },
    { label: 'Panduan', href: '#panduan' },
  ];

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#beranda" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-[1.1rem] text-primary" style={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
              FYP<span className="text-accent"> Foundation</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-[0.95rem] text-muted-foreground hover:text-primary rounded-lg hover:bg-secondary transition-all"
                style={{ fontWeight: 600 }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button className="px-5 py-2.5 text-primary border-2 border-primary rounded-lg hover:bg-secondary transition-all text-sm">
              Masuk
            </button>
            <button className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm shadow-sm">
              Daftar Gratis
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5 text-foreground" /> : <Menu className="w-5 h-5 text-foreground" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-border pt-4 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block px-4 py-2.5 text-muted-foreground hover:text-primary hover:bg-secondary rounded-lg transition-all"
                style={{ fontWeight: 600 }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex gap-3 pt-3">
              <button className="flex-1 py-2.5 text-primary border-2 border-primary rounded-lg text-sm">Masuk</button>
              <button className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm">Daftar Gratis</button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
