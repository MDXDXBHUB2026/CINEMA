import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { getNowShowingMovies, getComingSoonMovies, getCinemas } from "@/lib/catalog";
import { MovieCard } from "@/components/cinema/movie-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";

export default async function HomePage() {
  const [nowShowing, comingSoon, cinemas] = await Promise.all([getNowShowingMovies(), getComingSoonMovies(), getCinemas()]);
  const featured = nowShowing[0];

  return (
    <div>
      {featured && (
        <section className="relative overflow-hidden border-b border-border">
          <div className="aurora-bg">
            <div className="aurora-violet" />
          </div>
          <div className="absolute inset-0">
            <Image src={featured.backdropUrl} alt="" fill priority className="object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/30" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <p className="animate-fade-up text-sm font-medium uppercase tracking-widest text-primary">Now Showing</p>
            <h1 className="animate-fade-up mt-2 max-w-xl text-4xl font-bold text-foreground sm:text-5xl" style={{ animationDelay: "80ms" }}>
              {featured.title}
            </h1>
            <p className="animate-fade-up mt-4 max-w-lg text-muted" style={{ animationDelay: "160ms" }}>
              {featured.synopsis}
            </p>
            <div className="animate-fade-up mt-6 flex gap-3" style={{ animationDelay: "240ms" }}>
              <Link href={`/movies/${featured.slug}`} className="inline-flex">
                <Button size="lg">
                  Book tickets
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/movies" className="inline-flex">
                <Button size="lg" variant="secondary">
                  Browse all movies
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">Now Showing</h2>
          <Link href="/movies" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {nowShowing.map((movie) => (
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
      </section>

      {comingSoon.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="mb-5 text-xl font-bold text-foreground sm:text-2xl">Coming Soon</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {comingSoon.map((movie) => (
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
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="mb-5 text-xl font-bold text-foreground sm:text-2xl">Our Cinemas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {cinemas.map((cinema) => (
            <Link key={cinema.id} href={`/cinemas/${cinema.slug}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="pt-5">
                  <CardTitle>{cinema.name}</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {cinema.address}, {cinema.city}
                  </CardDescription>
                  <p className="mt-3 text-xs text-muted">{cinema.screens.length} screens</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
