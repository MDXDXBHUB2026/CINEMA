/**
 * Development seed data. Destructive: wipes and recreates all rows so
 * reseeding is deterministic. Run with `npm run db:seed`.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeMovieArt } from "./seed-assets";

const prisma = new PrismaClient();

const DEV_PASSWORD = "Password123";

function addDays(base: Date, days: number, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

interface SeatSpec {
  row: string;
  column: number;
  label: string;
  categoryName: "STANDARD" | "PREMIUM" | "ACCESSIBLE";
  isAccessible: boolean;
}

function buildSeatLayout(opts: {
  rows: string[];
  columns: number;
  premiumRows?: string[];
  accessible?: Array<[string, number]>;
}): SeatSpec[] {
  const premiumRows = new Set(opts.premiumRows ?? []);
  const accessibleSet = new Set((opts.accessible ?? []).map(([r, c]) => `${r}${c}`));
  const seats: SeatSpec[] = [];
  for (const row of opts.rows) {
    for (let col = 1; col <= opts.columns; col++) {
      const isAccessible = accessibleSet.has(`${row}${col}`);
      seats.push({
        row,
        column: col,
        label: `${row}${col}`,
        categoryName: isAccessible ? "ACCESSIBLE" : premiumRows.has(row) ? "PREMIUM" : "STANDARD",
        isAccessible,
      });
    }
  }
  return seats;
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.$transaction([
    prisma.auditEvent.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.bookingItem.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.showtimeSeat.deleteMany(),
    prisma.seatHold.deleteMany(),
    prisma.showtime.deleteMany(),
    prisma.seat.deleteMany(),
    prisma.screen.deleteMany(),
    prisma.cinemaStaff.deleteMany(),
    prisma.cinema.deleteMany(),
    prisma.movieGenre.deleteMany(),
    prisma.movie.deleteMany(),
    prisma.genre.deleteMany(),
    prisma.seatCategory.deleteMany(),
    prisma.loginAttempt.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("Seeding seat categories...");
  const [standard, premium, accessible] = await Promise.all([
    prisma.seatCategory.create({ data: { name: "STANDARD", priceMultiplier: 1.0 } }),
    prisma.seatCategory.create({ data: { name: "PREMIUM", priceMultiplier: 1.5 } }),
    prisma.seatCategory.create({ data: { name: "ACCESSIBLE", priceMultiplier: 1.0 } }),
  ]);
  const categoryByName = { STANDARD: standard, PREMIUM: premium, ACCESSIBLE: accessible };

  console.log("Seeding genres...");
  const genreNames = ["Action", "Drama", "Comedy", "Sci-Fi", "Thriller", "Animation", "Horror", "Romance"];
  const genres = await Promise.all(genreNames.map((name) => prisma.genre.create({ data: { name } })));
  const genreByName = Object.fromEntries(genres.map((g) => [g.name, g]));

  console.log("Seeding users...");
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);
  const [, manager, , alice] = await Promise.all([
    prisma.user.create({ data: { name: "Ava Admin", email: "admin@cinebook.dev", passwordHash, role: "ADMIN" } }),
    prisma.user.create({ data: { name: "Max Manager", email: "manager@cinebook.dev", passwordHash, role: "CINEMA_MANAGER" } }),
    prisma.user.create({ data: { name: "Sam Staff", email: "staff@cinebook.dev", passwordHash, role: "STAFF" } }),
    prisma.user.create({ data: { name: "Alice Customer", email: "alice@example.com", passwordHash, role: "CUSTOMER" } }),
    prisma.user.create({ data: { name: "Bob Customer", email: "bob@example.com", passwordHash, role: "CUSTOMER" } }),
    prisma.user.create({ data: { name: "Carla Customer", email: "carla@example.com", passwordHash, role: "CUSTOMER" } }),
  ]);

  console.log("Seeding cinemas & screens...");
  const cinemaSpecs = [
    { slug: "downtown", name: "CineBook Downtown", city: "Metroville", address: "100 Main Street" },
    { slug: "riverside", name: "CineBook Riverside", city: "Metroville", address: "42 Riverside Ave" },
    { slug: "grand-mall", name: "CineBook Grand Mall", city: "Lakeport", address: "8 Mall Concourse" },
  ];

  const cinemas = [];
  for (const spec of cinemaSpecs) {
    const cinema = await prisma.cinema.create({ data: spec });
    cinemas.push(cinema);
  }
  await prisma.cinemaStaff.create({ data: { userId: manager.id, cinemaId: cinemas[0].id } });

  const screenLayouts: Array<{ name: string; screenType: string; seats: SeatSpec[] }> = [
    {
      name: "Screen 1",
      screenType: "STANDARD",
      seats: buildSeatLayout({ rows: ["A", "B", "C", "D", "E", "F"], columns: 10, premiumRows: ["E", "F"], accessible: [["A", 1], ["A", 10]] }),
    },
    {
      name: "Screen 2",
      screenType: "PREMIUM",
      seats: buildSeatLayout({ rows: ["A", "B", "C", "D"], columns: 8, premiumRows: ["C", "D"], accessible: [["A", 1]] }),
    },
    {
      name: "IMAX",
      screenType: "IMAX",
      seats: buildSeatLayout({ rows: ["A", "B", "C", "D", "E", "F", "G", "H"], columns: 14, premiumRows: ["F", "G", "H"], accessible: [["A", 1], ["A", 14]] }),
    },
  ];

  const screens = [];
  for (const cinema of cinemas) {
    for (const layout of screenLayouts) {
      const screen = await prisma.screen.create({
        data: { cinemaId: cinema.id, name: layout.name, screenType: layout.screenType },
      });
      await prisma.seat.createMany({
        data: layout.seats.map((s) => ({
          screenId: screen.id,
          row: s.row,
          column: s.column,
          label: s.label,
          categoryId: categoryByName[s.categoryName].id,
          isAccessible: s.isAccessible,
        })),
      });
      screens.push({ ...screen, cinema, seatCount: layout.seats.length });
    }
  }

  console.log("Seeding movies...");
  const movieSpecs = [
    {
      slug: "quantum-horizon",
      title: "Quantum Horizon",
      synopsis: "A physicist discovers a rift between parallel timelines and must choose which version of her life to save.",
      durationMinutes: 128,
      language: "English",
      classification: "PG-13",
      genres: ["Sci-Fi", "Thriller"],
      releaseDays: -14,
      status: "NOW_SHOWING" as const,
    },
    {
      slug: "the-last-orchard",
      title: "The Last Orchard",
      synopsis: "Three estranged siblings return home to save their family's orchard from foreclosure, and each other.",
      durationMinutes: 112,
      language: "English",
      classification: "PG",
      genres: ["Drama"],
      releaseDays: -30,
      status: "NOW_SHOWING" as const,
    },
    {
      slug: "midnight-static",
      title: "Midnight Static",
      synopsis: "A late-night radio host starts receiving calls from listeners who haven't been born yet.",
      durationMinutes: 101,
      language: "English",
      classification: "R",
      genres: ["Horror", "Thriller"],
      releaseDays: -7,
      status: "NOW_SHOWING" as const,
    },
    {
      slug: "paper-lanterns",
      title: "Paper Lanterns",
      synopsis: "A chance encounter at a night market blossoms into a love story spanning three festivals.",
      durationMinutes: 118,
      language: "English",
      classification: "PG-13",
      genres: ["Romance", "Drama"],
      releaseDays: -3,
      status: "NOW_SHOWING" as const,
    },
    {
      slug: "the-heist-of-hollow-street",
      title: "The Heist of Hollow Street",
      synopsis: "A retired safecracker is pulled back for one last job when her old crew resurfaces with a target too good to refuse.",
      durationMinutes: 124,
      language: "English",
      classification: "PG-13",
      genres: ["Action", "Comedy"],
      releaseDays: -1,
      status: "NOW_SHOWING" as const,
    },
    {
      slug: "sundown-carnival",
      title: "Sundown Carnival",
      synopsis: "An animated adventure following a young mechanic who discovers her town's traveling carnival runs on captured starlight.",
      durationMinutes: 96,
      language: "English",
      classification: "G",
      genres: ["Animation", "Comedy"],
      releaseDays: -21,
      status: "NOW_SHOWING" as const,
    },
    {
      slug: "iron-tide",
      title: "Iron Tide",
      synopsis: "A coastal defense crew races to stop a rogue salvage fleet from triggering an international incident.",
      durationMinutes: 132,
      language: "English",
      classification: "PG-13",
      genres: ["Action", "Thriller"],
      releaseDays: 21,
      status: "COMING_SOON" as const,
    },
    {
      slug: "the-cartographers-daughter",
      title: "The Cartographer's Daughter",
      synopsis: "A young mapmaker inherits her late father's unfinished atlas of places that technically shouldn't exist.",
      durationMinutes: 109,
      language: "English",
      classification: "PG",
      genres: ["Drama", "Sci-Fi"],
      releaseDays: 45,
      status: "COMING_SOON" as const,
    },
  ];

  const now = new Date();
  const movies = [];
  for (const spec of movieSpecs) {
    const art = writeMovieArt(spec.slug, spec.title, spec.classification);
    const movie = await prisma.movie.create({
      data: {
        slug: spec.slug,
        title: spec.title,
        synopsis: spec.synopsis,
        durationMinutes: spec.durationMinutes,
        language: spec.language,
        classification: spec.classification,
        releaseDate: addDays(now, spec.releaseDays, 0),
        posterUrl: art.posterUrl,
        backdropUrl: art.backdropUrl,
        status: spec.status,
        genres: { create: spec.genres.map((g) => ({ genreId: genreByName[g].id })) },
      },
    });
    movies.push({ ...movie, status: spec.status });
  }

  console.log("Seeding showtimes & inventory...");
  const nowShowingMovies = movies.filter((m) => m.status === "NOW_SHOWING");
  const showtimeHours = [13, 16, 19, 21, 30]; // 30 => 30 mins from "now", used once for the live countdown demo below
  let screenCursor = 0;

  for (const movie of nowShowingMovies) {
    // Each movie plays on 2 screens across the network, at a few times over the next 5 days.
    const assignedScreens = [screens[screenCursor % screens.length], screens[(screenCursor + 4) % screens.length]];
    screenCursor++;

    for (const screen of assignedScreens) {
      for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
        const hour = showtimeHours[(dayOffset + screenCursor) % 4];
        const startsAt = addDays(now, dayOffset, hour, 0);
        const endsAt = new Date(startsAt.getTime() + movie.durationMinutes * 60 * 1000);
        const basePriceCents = screen.screenType === "IMAX" ? 1800 : screen.screenType === "PREMIUM" ? 1500 : 1200;

        const showtime = await prisma.showtime.create({
          data: { movieId: movie.id, screenId: screen.id, startsAt, endsAt, basePriceCents, status: "SCHEDULED" },
        });

        const seats = await prisma.seat.findMany({ where: { screenId: screen.id } });
        await prisma.showtimeSeat.createMany({
          data: seats.map((seat) => ({ showtimeId: showtime.id, seatId: seat.id, status: "AVAILABLE" })),
        });
      }
    }
  }

  console.log("Seeding sample bookings...");
  // A confirmed booking on a near-future showtime for Alice, to populate her booking history/ticket views.
  const upcomingShowtime = await prisma.showtime.findFirst({
    where: { startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    include: { showtimeSeats: { include: { seat: { include: { category: true } } }, take: 2 } },
  });

  if (upcomingShowtime) {
    const seatsToBook = upcomingShowtime.showtimeSeats.slice(0, 2);
    const items = seatsToBook.map((ss) => ({
      showtimeSeatId: ss.id,
      seatLabel: ss.seat.label,
      categoryName: ss.seat.category.name,
      unitPriceCents: Math.round(upcomingShowtime.basePriceCents * ss.seat.category.priceMultiplier),
    }));
    const subtotalCents = items.reduce((s, i) => s + i.unitPriceCents, 0);
    const feesCents = 150;
    const taxCents = Math.round((subtotalCents + feesCents) * 0.08);
    const totalCents = subtotalCents + feesCents + taxCents;

    const booking = await prisma.booking.create({
      data: {
        bookingRef: "CB-SEEDDEMO1",
        userId: alice.id,
        showtimeId: upcomingShowtime.id,
        status: "CONFIRMED",
        subtotalCents,
        feesCents,
        taxCents,
        totalCents,
        items: { create: items },
      },
    });
    await prisma.showtimeSeat.updateMany({
      where: { id: { in: seatsToBook.map((s) => s.id) } },
      data: { status: "BOOKED" },
    });
    await prisma.payment.create({
      data: { bookingId: booking.id, status: "SUCCEEDED", amountCents: totalCents, idempotencyKey: "seed-demo-payment-1", simulatedOutcome: "SUCCESS" },
    });
    await prisma.ticket.create({ data: { bookingId: booking.id, ticketCode: "TK-SEEDDEMO1TICKET" } });
  }

  // A confirmed booking on a past showtime for Alice's booking history (past bookings aren't cancellable/reschedulable).
  const pastScreen = screens[0];
  const pastMovie = nowShowingMovies[0];
  const pastStartsAt = addDays(now, -10, 19, 0);
  const pastShowtime = await prisma.showtime.create({
    data: {
      movieId: pastMovie.id,
      screenId: pastScreen.id,
      startsAt: pastStartsAt,
      endsAt: new Date(pastStartsAt.getTime() + pastMovie.durationMinutes * 60 * 1000),
      basePriceCents: 1200,
      status: "SCHEDULED",
    },
  });
  const pastSeats = await prisma.seat.findMany({ where: { screenId: pastScreen.id }, take: 2 });
  const pastShowtimeSeats = await Promise.all(
    pastSeats.map((seat) =>
      prisma.showtimeSeat.create({ data: { showtimeId: pastShowtime.id, seatId: seat.id, status: "BOOKED" } }),
    ),
  );
  const pastCategory = await prisma.seatCategory.findUniqueOrThrow({ where: { id: pastSeats[0].categoryId } });
  const pastItems = pastShowtimeSeats.map((ss, i) => ({
    showtimeSeatId: ss.id,
    seatLabel: pastSeats[i].label,
    categoryName: pastCategory.name,
    unitPriceCents: 1200,
  }));
  const pastSubtotal = pastItems.reduce((s, i) => s + i.unitPriceCents, 0);
  const pastFees = 150;
  const pastTax = Math.round((pastSubtotal + pastFees) * 0.08);
  const pastBooking = await prisma.booking.create({
    data: {
      bookingRef: "CB-SEEDPAST01",
      userId: alice.id,
      showtimeId: pastShowtime.id,
      status: "CONFIRMED",
      subtotalCents: pastSubtotal,
      feesCents: pastFees,
      taxCents: pastTax,
      totalCents: pastSubtotal + pastFees + pastTax,
      items: { create: pastItems },
    },
  });
  await prisma.payment.create({
    data: { bookingId: pastBooking.id, status: "SUCCEEDED", amountCents: pastSubtotal + pastFees + pastTax, idempotencyKey: "seed-demo-payment-2", simulatedOutcome: "SUCCESS" },
  });
  await prisma.ticket.create({ data: { bookingId: pastBooking.id, ticketCode: "TK-SEEDPAST01TICKET" } });

  console.log("Seed complete.");
  console.log("");
  console.log("Development accounts (all use password: %s):", DEV_PASSWORD);
  console.log("  ADMIN            admin@cinebook.dev");
  console.log("  CINEMA_MANAGER   manager@cinebook.dev");
  console.log("  STAFF            staff@cinebook.dev");
  console.log("  CUSTOMER         alice@example.com / bob@example.com / carla@example.com");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
