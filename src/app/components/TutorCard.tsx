import { BookOpen, GraduationCap, Instagram } from 'lucide-react';

interface TutorCardProps {
  name: string;
  nickname: string;
  education: string;
  expertise: string;
  achievement: string;
  instagram: string;
  imageUrl: string;
}

export function TutorCard({ name, nickname, education, expertise, achievement, instagram, imageUrl }: TutorCardProps) {
  return (
    <article className="min-w-0 h-full overflow-hidden rounded-[22px] border border-primary/10 bg-white shadow-sm">
      <div className="flex h-full flex-col md:flex-row">
        <div className="relative min-h-[132px] md:w-[126px] md:shrink-0 lg:w-[136px]">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-primary to-[#16344a]" />
          <img
            src={imageUrl}
            alt={name}
            className="absolute inset-[10px] h-[calc(100%-20px)] w-[calc(100%-20px)] rounded-[16px] border-[3px] border-white/85 object-cover shadow-lg"
          />
          <div className="absolute inset-y-0 right-0 hidden w-10 bg-white [clip-path:polygon(100%_0,0_100%,100%_100%)] md:block" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3.5 md:px-4 md:py-3">
          <div className="mb-2">
            <h3 className="line-clamp-2 text-[0.92rem] font-bold leading-tight text-foreground lg:text-[0.98rem]">{name}</h3>
            <p className="mt-1 text-xs">Panggilan: {nickname}</p>
          </div>

          <div className="mb-2">
            <div className="mb-1.5 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-primary">
              <GraduationCap className="h-3.5 w-3.5" />
              Latar Belakang
            </div>
            <p className="line-clamp-2 break-words text-[0.72rem] leading-relaxed text-foreground">{education}</p>
          </div>

          <div className="mb-2">
            <div className="mb-1.5 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-primary">
              <BookOpen className="h-3.5 w-3.5" />
              Mata Ajar
            </div>
            <p className="line-clamp-2 break-words text-[0.72rem] leading-relaxed text-foreground">{expertise}</p>
          </div>

          <div className="mb-2 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-1.5">
            <p className="line-clamp-2 break-words text-[0.72rem] leading-relaxed text-foreground">{achievement}</p>
          </div>

          <div className="mt-auto flex items-center gap-2 text-[0.7rem] text-muted-foreground">
            <Instagram className="h-4 w-4 text-primary" />
            <span className="truncate">{instagram}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
