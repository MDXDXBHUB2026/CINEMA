import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function getNowShowingMovies() {
  return prisma.movie.findMany({
    where: { status: "NOW_SHOWING" },
    include: { genres: { include: { genre: true } } },
    orderBy: { releaseDate: "desc" },
  });
}

export async function getComingSoonMovies() {
  return prisma.movie.findMany({
    where: { status: "COMING_SOON" },
    include: { genres: { include: { genre: true } } },
    orderBy: { releaseDate: "asc" },
  });
}

export async function getAllMovies(search?: string) {
  return prisma.movie.findMany({
    where: {
      status: { in: ["NOW_SHOWING", "COMING_SOON"] },
      // `mode: "insensitive"` is required on PostgreSQL for case-insensitive
      // matching (Prisma's `contains` is case-sensitive there by default,
      // unlike SQLite's default LIKE behavior — a real behavioral
      // difference between the two providers this app has used).
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    },
    include: { genres: { include: { genre: true } } },
    orderBy: [{ status: "asc" }, { releaseDate: "desc" }],
  });
}

export async function getAllGenres() {
  return prisma.genre.findMany({ orderBy: { name: "asc" } });
}

export async function getMovieBySlug(slug: string) {
  const movie = await prisma.movie.findUnique({
    where: { slug },
    include: { genres: { include: { genre: true } } },
  });
  if (!movie) throw new AppError("NOT_FOUND", "Movie not found.");
  return movie;
}

export async function getUpcomingShowtimesForMovie(movieId: string) {
  return prisma.showtime.findMany({
    where: { movieId, status: "SCHEDULED", startsAt: { gt: new Date() } },
    include: { screen: { include: { cinema: true } } },
    orderBy: { startsAt: "asc" },
  });
}

export async function getCinemas() {
  return prisma.cinema.findMany({ orderBy: { name: "asc" }, include: { screens: true } });
}

export async function getCinemaBySlug(slug: string) {
  const cinema = await prisma.cinema.findUnique({ where: { slug }, include: { screens: true } });
  if (!cinema) throw new AppError("NOT_FOUND", "Cinema not found.");
  return cinema;
}

export async function getUpcomingShowtimesForCinema(cinemaId: string) {
  return prisma.showtime.findMany({
    where: { screen: { cinemaId }, status: "SCHEDULED", startsAt: { gt: new Date() } },
    include: { movie: true, screen: true },
    orderBy: { startsAt: "asc" },
  });
}

export async function getShowtimeWithContext(showtimeId: string) {
  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    include: { movie: true, screen: { include: { cinema: true } } },
  });
  if (!showtime) throw new AppError("NOT_FOUND", "Showtime not found.");
  return showtime;
}
