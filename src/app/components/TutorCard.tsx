import { BookOpen, CheckCircle2 } from 'lucide-react';

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
  const displayImageUrl = imageUrl || DEFAULT_TUTOR_IMAGE;

  return (
    <article className="rounded-xl border border-black/15 bg-[#d9d9d9] p-3">
      <h3 className="mb-2 line-clamp-2 text-[1.1rem] font-bold leading-none text-foreground sm:text-[1.3rem]">
        {name}
      </h3>

      <div className="mb-3 flex h-[150px] items-center justify-center bg-[#ececec]">
        <img src={displayImageUrl} alt={name} className="h-full w-full object-cover" />
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-xs font-semibold text-primary">
          <BookOpen className="h-3 w-3" />
          {subject}
        </span>
        {verified && <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" aria-label="Verified tutor" />}
      </div>

      <p className="mb-1 text-xs leading-relaxed text-foreground">
        Harga/jam: Rp {hourlyRate.toLocaleString('id-ID')}
      </p>
      <p className="mb-1 text-xs leading-relaxed text-foreground">
        Rating: {rating} ({reviews} reviews)
      </p>
    </article>
  );
}
