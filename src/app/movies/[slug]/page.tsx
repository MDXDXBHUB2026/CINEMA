import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock, Languages, Calendar } from "lucide-react";
import { getMovieBySlug, getUpcomingShowtimesForMovie } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDuration, formatTime } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/movies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const movie = await getMovieBySlug(slug);
    return { title: movie.title, description: movie.synopsis };
  } catch {
    return { title: "Movie" };
  }
}

export default async function MovieDetailPage({ params }: PageProps<"/movies/[slug]">) {
  const { slug } = await params;
  const movie = await getMovieBySlug(slug);
  const showtimes = movie.status === "NOW_SHOWING" ? await getUpcomingShowtimesForMovie(movie.id) : [];

  const byDate = new Map<string, typeof showtimes>();
  for (const st of showtimes) {
    const key = formatDate(st.startsAt);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(st);
  }

  return (
    <div>
      <div className="relative border-b border-border">
        <div className="absolute inset-0">
          <Image src={movie.backdropUrl} alt="" fill className="object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:px-6 sm:py-14">
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl border border-border shadow-xl sm:mx-0 sm:w-56">
            <Image src={movie.posterUrl} alt={`${movie.title} poster`} fill className="object-cover" />
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">{movie.classification}</Badge>
              {movie.status === "COMING_SOON" && <Badge>Coming Soon</Badge>}
              {movie.genres.map((g) => (
                <Badge key={g.genreId}>{g.genre.name}</Badge>
              ))}
            </div>
            <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">{movie.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden="true" /> {formatDuration(movie.durationMinutes)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-4 w-4" aria-hidden="true" /> {movie.language}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" aria-hidden="true" /> {formatDate(movie.releaseDate, { year: "numeric" })}
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-foreground/90">{movie.synopsis}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 className="mb-4 text-xl font-bold text-foreground">Showtimes</h2>
        {movie.status === "COMING_SOON" ? (
          <EmptyState icon={Calendar} title="Not yet bookable" description={`${movie.title} releases ${formatDate(movie.releaseDate, { year: "numeric" })}. Check back closer to release.`} />
        ) : showtimes.length === 0 ? (
          <EmptyState icon={Calendar} title="No upcoming showtimes" description="This movie doesn't have any scheduled showtimes right now." />
        ) : (
          <div className="space-y-6">
            {[...byDate.entries()].map(([date, items]) => (
              <div key={date}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{date}</h3>
                <div className="space-y-3">
                  {[...new Map(items.map((i) => [i.screen.cinema.id, i.screen.cinema])).values()].map((cinema) => (
                    <div key={cinema.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium text-foreground">
                        {cinema.name} <span className="text-muted">— {cinema.city}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {items
                          .filter((i) => i.screen.cinema.id === cinema.id)
                          .map((st) => (
                            <Link
                              key={st.id}
                              href={`/booking/${st.id}`}
                              className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
                            >
                              {formatTime(st.startsAt)}
                              <span className="ml-1.5 text-xs text-muted">{st.screen.name}</span>
                            </Link>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
