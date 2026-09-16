import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Ticket } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/cookies";
import { listBookingsForUser } from "@/lib/booking/queries";
import { formatCents } from "@/lib/pricing";
import { formatDate, formatTime } from "@/lib/utils";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CancelBookingButton } from "@/components/cinema/cancel-booking-button";

export const metadata: Metadata = { title: "My Bookings" };

const STATUS_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  CONFIRMED: "success",
  DRAFT: "default",
  PAYMENT_PENDING: "warning",
  PAYMENT_FAILED: "danger",
  CANCELLED: "default",
  EXPIRED: "default",
};

export default async function BookingHistoryPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login?next=/account/bookings");

  const bookings = await listBookingsForUser(session.sub);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>

      {bookings.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No bookings yet"
          description="Once you book tickets, they'll show up here."
          className="mt-8"
          action={
            <Link href="/movies" className="text-sm font-medium text-primary hover:underline">
              Browse movies
            </Link>
          }
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {bookings.map((booking) => {
            const isCancellable = booking.status === "CONFIRMED" && booking.showtime.startsAt > new Date();
            return (
              <li key={booking.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{booking.showtime.movie.title}</p>
                    <p className="text-sm text-muted">
                      {booking.showtime.screen.cinema.name} · {formatDate(booking.showtime.startsAt, { year: "numeric" })} at {formatTime(booking.showtime.startsAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Seats: {booking.items.map((i) => i.seatLabel).join(", ") || "—"} · Ref {booking.bookingRef}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[booking.status] ?? "default"}>{booking.status.replace("_", " ")}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{formatCents(booking.totalCents)}</p>
                  <div className="flex items-center gap-3">
                    {booking.status === "CONFIRMED" && booking.ticket && (
                      <Link href={`/tickets/${booking.id}`} className="text-sm font-medium text-primary hover:underline">
                        View ticket
                      </Link>
                    )}
                    {(booking.status === "DRAFT" || booking.status === "PAYMENT_PENDING" || booking.status === "PAYMENT_FAILED") && (
                      <Link href={`/checkout/${booking.id}`} className="text-sm font-medium text-primary hover:underline">
                        Continue to payment
                      </Link>
                    )}
                    {isCancellable && <CancelBookingButton bookingId={booking.id} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
