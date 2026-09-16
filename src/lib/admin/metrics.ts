import { prisma } from "@/lib/prisma";

export async function getDashboardMetrics() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [todaysBookings, ticketsSold, revenueAgg, upcomingShowtimes, statusBreakdown, allTimeSeats, bookedSeats, confirmedItems] =
    await Promise.all([
      prisma.booking.count({ where: { createdAt: { gte: startOfToday, lt: endOfToday }, status: "CONFIRMED" } }),
      prisma.bookingItem.count({ where: { booking: { status: "CONFIRMED" } } }),
      prisma.booking.aggregate({ where: { status: "CONFIRMED" }, _sum: { totalCents: true } }),
      prisma.showtime.count({ where: { status: "SCHEDULED", startsAt: { gt: new Date() } } }),
      prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.showtimeSeat.count(),
      prisma.showtimeSeat.count({ where: { status: "BOOKED" } }),
      prisma.bookingItem.findMany({
        where: { booking: { status: "CONFIRMED" } },
        select: { booking: { select: { showtime: { select: { movie: { select: { id: true, title: true } } } } } } },
      }),
    ]);

  // Popular movies by confirmed booking-item count. The local dataset is
  // small enough that an in-memory tally is clearer than a raw SQL query.
  const countsByMovie = new Map<string, { title: string; count: number }>();
  for (const item of confirmedItems) {
    const movie = item.booking.showtime.movie;
    const existing = countsByMovie.get(movie.id) ?? { title: movie.title, count: 0 };
    existing.count += 1;
    countsByMovie.set(movie.id, existing);
  }
  const popularMovies = [...countsByMovie.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  return {
    todaysBookings,
    ticketsSold,
    revenueCents: revenueAgg._sum.totalCents ?? 0,
    upcomingShowtimes,
    statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count._all })),
    occupancyRate: allTimeSeats > 0 ? bookedSeats / allTimeSeats : 0,
    popularMovies,
  };
}
