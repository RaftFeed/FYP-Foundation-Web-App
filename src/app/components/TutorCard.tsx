import { Star, BookOpen, Users } from 'lucide-react';

interface TutorCardProps {
  name: string;
  subject: string;
  rating: number;
  reviews: number;
  hourlyRate: number;
  imageUrl: string;
}

export function TutorCard({ name, subject, rating, reviews, hourlyRate, imageUrl }: TutorCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-border hover:border-primary hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
      <div className="h-1 bg-gradient-to-r from-primary to-accent w-0 group-hover:w-full transition-all duration-300" />

      <div className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative shrink-0">
            <img
              src={imageUrl}
              alt={name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-border group-hover:border-primary transition-colors"
            />
            <div
              className="absolute -bottom-2 -right-2 bg-primary text-white text-xs px-1.5 py-0.5 rounded-lg shadow-md"
              style={{ fontWeight: 700 }}
            >
              ★ {rating}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="text-foreground truncate">{name}</h3>
            <span
              className="inline-flex items-center gap-1 bg-secondary text-primary text-xs px-2.5 py-1 rounded-full mt-1"
              style={{ fontWeight: 600 }}
            >
              <BookOpen className="w-3 h-3" />
              {subject}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${i < Math.floor(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`}
              />
            ))}
          </div>
          <span className="text-muted-foreground text-xs">({reviews} ulasan)</span>
        </div>

        <div className="flex items-center justify-between mb-5 py-3 border-t border-b border-border">
          <span className="text-muted-foreground text-sm">Harga/jam</span>
          <span className="text-primary" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
            Rp {hourlyRate.toLocaleString('id-ID')}
          </span>
        </div>

        <div className="space-y-2.5">
          <button className="w-full py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all text-sm flex items-center justify-center gap-2 shadow-sm">
            Buat Kelas Privat
          </button>
          <button className="w-full py-2.5 border-2 border-primary text-primary rounded-xl hover:bg-secondary transition-all text-sm flex items-center justify-center gap-2">
            <Users className="w-4 h-4" />
            Buat Kelas Grup (Matchmaking)
          </button>
        </div>
      </div>
    </div>
  );
}
