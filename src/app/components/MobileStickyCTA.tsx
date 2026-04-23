import { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';

export function MobileStickyCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (isDismissed) return;
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDismissed]);

  if (isDismissed || !isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-white border-t border-border shadow-2xl p-4 animate-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground mb-1">Siap untuk mulai belajar?</p>
          <p className="text-xs text-muted-foreground">Bergabunglah dengan 500+ mahasiswa kami</p>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1.5 hover:bg-secondary rounded-lg transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <button className="w-full mt-3 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm font-medium flex items-center justify-center gap-2">
        Daftar Sekarang
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
