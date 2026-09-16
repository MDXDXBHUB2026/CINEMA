import type { Metadata } from "next";
import { getAllMovies } from "@/lib/catalog";
import { MovieCard } from "@/components/cinema/movie-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Film } from "lucide-react";

export const metadata: Metadata = { title: "Movies" };

export default async function MoviesPage({ searchParams }: PageProps<"/movies">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : undefined;
  const movies = await getAllMovies(search);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Movies</h1>

      <form className="mt-4 max-w-sm" role="search">
        <label htmlFor="movie-search" className="sr-only">
          Search movies
        </label>
        <input
          id="movie-search"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Search by title..."
          className="h-10 w-full rounded-lg border border-border bg-surface-raised px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </form>

      {movies.length === 0 ? (
        <EmptyState icon={Film} title="No movies found" description="Try a different search term." className="mt-8" />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={{
                slug: movie.slug,
                title: movie.title,
                posterUrl: movie.posterUrl,
                classification: movie.classification,
                durationMinutes: movie.durationMinutes,
                genres: movie.genres.map((g) => g.genre.name),
                status: movie.status,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
