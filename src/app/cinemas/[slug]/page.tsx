import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";
import { getCinemaBySlug, getUpcomingShowtimesForCinema } from "@/lib/catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatTime } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/cinemas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const cinema = await getCinemaBySlug(slug);
    return { title: cinema.name };
  } catch {
    return { title: "Cinema" };
  }
}

export default async function CinemaDetailPage({ params }: PageProps<"/cinemas/[slug]">) {
  const { slug } = await params;
  const cinema = await getCinemaBySlug(slug);
  const showtimes = await getUpcomingShowtimesForCinema(cinema.id);

  const byDate = new Map<string, typeof showtimes>();
  for (const st of showtimes) {
    const key = formatDate(st.startsAt);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(st);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">{cinema.name}</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        {cinema.address}, {cinema.city}
      </p>

      <h2 className="mt-8 mb-4 text-lg font-semibold text-foreground">Upcoming Showtimes</h2>
      {showtimes.length === 0 ? (
        <EmptyState icon={Calendar} title="No upcoming showtimes" />
      ) : (
        <div className="space-y-6">
          {[...byDate.entries()].map(([date, items]) => (
            <div key={date}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{date}</h3>
              <div className="space-y-2">
                {[...new Map(items.map((i) => [i.movie.id, i.movie])).values()].map((movie) => (
                  <div key={movie.id} className="rounded-lg border border-border p-3">
                    <Link href={`/movies/${movie.slug}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {movie.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {items
                        .filter((i) => i.movie.id === movie.id)
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
  );
}
