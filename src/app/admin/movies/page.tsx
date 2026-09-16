import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getAllGenres } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import { CreateMovieForm } from "@/components/admin/create-movie-form";
import { formatDate, formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Movies" };

export default async function AdminMoviesPage() {
  const [movies, genres] = await Promise.all([
    prisma.movie.findMany({ orderBy: { createdAt: "desc" }, include: { genres: { include: { genre: true } } } }),
    getAllGenres(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Movies</h1>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Duration</th>
              <th className="px-4 py-2.5">Release</th>
            </tr>
          </thead>
          <tbody>
            {movies.map((movie) => (
              <tr key={movie.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium text-foreground">{movie.title}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={movie.status === "NOW_SHOWING" ? "success" : "default"}>{movie.status.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-2.5 text-muted">{formatDuration(movie.durationMinutes)}</td>
                <td className="px-4 py-2.5 text-muted">{formatDate(movie.releaseDate, { year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-foreground">Add a movie</h2>
      <div className="max-w-2xl rounded-xl border border-border bg-surface p-5">
        <CreateMovieForm genres={genres} />
      </div>
    </div>
  );
}
