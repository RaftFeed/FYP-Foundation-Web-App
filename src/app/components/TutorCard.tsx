import { Star, BookOpen, Users, CheckCircle2 } from 'lucide-react';

const DEFAULT_TUTOR_IMAGE =
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=200&h=200&fit=crop&crop=faces';

interface TutorCardProps {
  name: string;
  subject: string;
  rating: number;
  reviews: number;
  hourlyRate: number;
  imageUrl?: string | null;
  verified?: boolean;
}

export function TutorCard({ name, subject, rating, reviews, hourlyRate, imageUrl, verified = true }: TutorCardProps) {
  const isTopRated = rating >= 4.8;
  const displayImageUrl = imageUrl || DEFAULT_TUTOR_IMAGE;

  return (
    <div className="bg-white rounded-2xl border border-border hover:border-primary hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
      <div className="h-1 bg-gradient-to-r from-primary to-accent w-0 group-hover:w-full transition-all duration-300" />

      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative shrink-0">
            <img
              src={displayImageUrl}
              alt={name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-border group-hover:border-primary transition-colors"
            />
            <div
              className="absolute -bottom-2 -right-2 bg-primary text-white text-xs px-1.5 py-0.5 rounded-lg shadow-md flex items-center gap-1"
              style={{ fontWeight: 700 }}
            >
              <Star className="w-3 h-3 fill-current" />
              {rating}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1">
              <h3 className="text-foreground font-semibold truncate">{name}</h3>
              {verified && (
                <div title="Tutor terverifikasi">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-1" aria-label="Verified tutor" />
                </div>
              )}
            </div>
            <span
              className="inline-flex items-center gap-1 bg-secondary text-primary text-xs px-2.5 py-1 rounded-full mt-1"
              style={{ fontWeight: 600 }}
            >
              <BookOpen className="w-3 h-3" />
              {subject}
            </span>
            {isTopRated && (
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" aria-hidden="true" />
                <span className="text-amber-700 text-xs font-semibold">Top Rated</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${i < Math.floor(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="text-muted-foreground text-xs">({reviews} reviews)</span>
        </div>

        <div className="flex items-center justify-between mb-5 py-3 border-t border-b border-border">
          <span className="text-muted-foreground text-sm font-medium">Harga/jam</span>
          <span className="text-primary" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
            Rp {hourlyRate.toLocaleString('id-ID')}
          </span>
        </div>

        <div className="space-y-2.5">
          <button 
            className="w-full py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 active:scale-95 transition-all text-sm font-medium shadow-sm"
            aria-label={`Buat kelas privat dengan ${name}`}
          >
            Buat Kelas Privat
          </button>
          <button 
            className="w-full py-2.5 border-2 border-primary text-primary rounded-xl hover:bg-secondary active:scale-95 transition-all text-sm font-medium flex items-center justify-center gap-2"
            aria-label={`Buat kelas grup dengan ${name}`}
          >
            <Users className="w-4 h-4" />
            Buat Kelas Grup
          </button>
        </div>
      </div>
    </div>
  );
}
