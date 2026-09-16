import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function getBookingDetail(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      items: true,
      ticket: true,
      payments: { orderBy: { createdAt: "desc" } },
      showtime: { include: { movie: true, screen: { include: { cinema: true } } } },
      user: { select: { id: true, name: true, email: true } },
      hold: true,
    },
  });
  if (!booking) throw new AppError("NOT_FOUND", "Booking not found.");
  return booking;
}

export async function listBookingsForUser(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    include: {
      items: true,
      ticket: true,
      showtime: { include: { movie: true, screen: { include: { cinema: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}
