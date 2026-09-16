import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function ensureSeatCategory(name: "STANDARD" | "PREMIUM" | "ACCESSIBLE", priceMultiplier: number) {
  return prisma.seatCategory.upsert({
    where: { name },
    update: {},
    create: { name, priceMultiplier },
  });
}

export async function createTestUser(role: "CUSTOMER" | "STAFF" | "CINEMA_MANAGER" | "ADMIN" = "CUSTOMER") {
  const email = `${unique("user")}@test.local`;
  const passwordHash = await hashPassword("Password123");
  return prisma.user.create({ data: { name: "Test User", email, passwordHash, role } });
}

/**
 * Creates an isolated cinema/screen/showtime with `seatCount` AVAILABLE
 * seats, scoped with unique identifiers so tests never collide with each
 * other's fixture data even when run in the same shared SQLite file.
 */
export async function createTestShowtime(opts: { seatCount?: number; startsInMs?: number; basePriceCents?: number } = {}) {
  const seatCount = opts.seatCount ?? 6;
  const standard = await ensureSeatCategory("STANDARD", 1.0);
  const premium = await ensureSeatCategory("PREMIUM", 1.5);

  const cinema = await prisma.cinema.create({
    data: { slug: unique("cinema"), name: "Test Cinema", city: "Testville", address: "1 Test St" },
  });
  const screen = await prisma.screen.create({ data: { cinemaId: cinema.id, name: "Screen 1", screenType: "STANDARD" } });
  const movie = await prisma.movie.create({
    data: {
      slug: unique("movie"),
      title: "Test Movie",
      synopsis: "A test movie.",
      durationMinutes: 100,
      language: "English",
      classification: "PG",
      releaseDate: new Date(),
      posterUrl: "/posters/test.svg",
      backdropUrl: "/backdrops/test.svg",
      status: "NOW_SHOWING",
    },
  });

  const seats = [];
  for (let i = 0; i < seatCount; i++) {
    const seat = await prisma.seat.create({
      data: {
        screenId: screen.id,
        row: "A",
        column: i + 1,
        label: `A${i + 1}`,
        categoryId: i % 4 === 0 ? premium.id : standard.id,
      },
    });
    seats.push(seat);
  }

  const startsAt = new Date(Date.now() + (opts.startsInMs ?? 60 * 60 * 1000));
  const showtime = await prisma.showtime.create({
    data: {
      movieId: movie.id,
      screenId: screen.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + movie.durationMinutes * 60 * 1000),
      basePriceCents: opts.basePriceCents ?? 1200,
      status: "SCHEDULED",
    },
  });

  const showtimeSeats = await Promise.all(
    seats.map((seat) => prisma.showtimeSeat.create({ data: { showtimeId: showtime.id, seatId: seat.id, status: "AVAILABLE" } })),
  );

  return { cinema, screen, movie, showtime, seats, showtimeSeats };
}
