import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";

export interface MovieCardData {
  slug: string;
  title: string;
  posterUrl: string;
  classification: string;
  durationMinutes: number;
  genres: string[];
  status: string;
}

export function MovieCard({ movie }: { movie: MovieCardData }) {
  return (
    <Link
      href={`/movies/${movie.slug}`}
      className="group block overflow-hidden rounded-xl border border-border bg-surface transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-raised">
        <Image
          src={movie.posterUrl}
          alt={`${movie.title} poster`}
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {movie.status === "COMING_SOON" && (
          <Badge variant="primary" className="absolute left-2 top-2">
            Coming Soon
          </Badge>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 font-semibold text-foreground">{movie.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <Badge className="px-1.5 py-0 text-[10px]">{movie.classification}</Badge>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatDuration(movie.durationMinutes)}
          </span>
          <span className="line-clamp-1">{movie.genres.join(", ")}</span>
        </div>
      </div>
    </Link>
  );
}
