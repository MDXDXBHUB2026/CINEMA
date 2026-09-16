import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Ticket as TicketIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/cookies";
import { assertOwnsResourceOrStaff } from "@/lib/auth/rbac";
import { getBookingDetail } from "@/lib/booking/queries";
import { isAppError } from "@/lib/errors";
import { formatCents } from "@/lib/pricing";
import { formatDate, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Booking Confirmed" };

export default async function ConfirmationPage({ params }: PageProps<"/booking/confirmation/[bookingId]">) {
  const { bookingId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/booking/confirmation/${bookingId}`);

  let booking;
  try {
    booking = await getBookingDetail(bookingId);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  assertOwnsResourceOrStaff(user, booking.userId);

  if (booking.status !== "CONFIRMED") redirect(`/checkout/${booking.id}`);

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center sm:px-6">
      <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-foreground">Booking confirmed!</h1>
      <p className="mt-2 text-muted">
        Reference <span className="font-mono font-medium text-foreground">{booking.bookingRef}</span>
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 text-left">
        <h2 className="font-semibold text-foreground">{booking.showtime.movie.title}</h2>
        <p className="text-sm text-muted">
          {booking.showtime.screen.cinema.name} · {booking.showtime.screen.name} · {formatDate(booking.showtime.startsAt, { year: "numeric" })} at{" "}
          {formatTime(booking.showtime.startsAt)}
        </p>
        <p className="mt-2 text-sm text-foreground">Seats: {booking.items.map((i) => i.seatLabel).join(", ")}</p>
        <p className="mt-1 text-sm font-medium text-foreground">Total paid: {formatCents(booking.totalCents)}</p>
      </div>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={`/tickets/${booking.id}`}>
          <Button size="lg">
            <TicketIcon className="h-4 w-4" aria-hidden="true" />
            View e-ticket
          </Button>
        </Link>
        <Link href="/account/bookings">
          <Button size="lg" variant="secondary">
            My bookings
          </Button>
        </Link>
      </div>
    </div>
  );
}
