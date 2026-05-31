import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import logoImage from '../../img/FYP_Logo.png';

function openAuthPage(mode: 'login' | 'signup') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  window.history.pushState({}, '', `${base}/login${mode === 'signup' ? '?mode=signup' : ''}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Beranda', href: '#beranda' },
    { label: 'Mata Kuliah', href: '#matkul' },
    { label: 'Panduan', href: '#panduan' },
        { label: 'Katalog Tutor', href: '#katalog' },
  ];

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-8xl mx-auto px-4 md:px-50 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a 
            href="#beranda" 
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg px-1 py-1 shrink-0"
            aria-label="FYP Foundation - Home"
          >
            <img
              src={logoImage}
              alt="FYP Foundation"
              className="block h-14 w-auto max-w-[320px] md:h-16 object-contain"
            />
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-[0.95rem] text-muted-foreground hover:text-primary rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                style={{ fontWeight: 600 }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button 
              type="button"
              onClick={() => openAuthPage('login')}
              className="px-5 py-2.5 text-primary border-2 border-primary rounded-lg hover:bg-secondary active:scale-95 focus:outline-none transition-all text-sm font-medium"
              aria-label="Login"
            >
              Masuk
            </button>
            <button 
              type="button"
              onClick={() => openAuthPage('signup')}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 active:scale-95 focus:outline-none transition-all text-sm font-medium shadow-sm"
              aria-label="Sign up for free"
            >
              Daftar
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-foreground" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div 
            id="mobile-menu"
            className="md:hidden mt-4 pb-4 border-t border-border pt-4 space-y-1 animate-in fade-in slide-in-from-top-2"
          >
            <nav className="space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block px-4 py-2.5 text-muted-foreground hover:text-primary hover:bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="flex gap-3 pt-3">
              <button 
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  openAuthPage('login');
                }}
                className="flex-1 py-2.5 text-primary border-2 border-primary rounded-lg text-sm font-medium hover:bg-secondary focus:outline-none transition-all"
                aria-label="Login"
              >
                Masuk
              </button>
              <button 
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  openAuthPage('signup');
                }}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 focus:outline-none transition-all"
                aria-label="Sign up for free"
              >
                Daftar Gratis
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
