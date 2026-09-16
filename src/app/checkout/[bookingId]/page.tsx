import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/cookies";
import { assertOwnsResourceOrStaff } from "@/lib/auth/rbac";
import { getBookingDetail } from "@/lib/booking/queries";
import { formatCents } from "@/lib/pricing";
import { formatDate, formatTime } from "@/lib/utils";
import { PaymentPanel } from "@/components/cinema/payment-panel";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: PageProps<"/checkout/[bookingId]">) {
  const { bookingId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/checkout/${bookingId}`);

  let booking;
  try {
    booking = await getBookingDetail(bookingId);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  assertOwnsResourceOrStaff(user, booking.userId);

  if (booking.status === "CONFIRMED") redirect(`/booking/confirmation/${booking.id}`);
  if (booking.status !== "DRAFT" && booking.status !== "PAYMENT_PENDING" && booking.status !== "PAYMENT_FAILED") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-xl font-semibold text-foreground">This booking can no longer be paid for</h1>
        <p className="mt-2 text-muted">Status: {booking.status}. Please start a new booking.</p>
      </div>
    );
  }

  const holdExpiresAt = booking.hold?.status === "ACTIVE" ? booking.hold.expiresAt.toISOString() : null;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Checkout</h1>
        <p className="mt-1 text-sm text-muted">Booking reference {booking.bookingRef}</p>

        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">{booking.showtime.movie.title}</h2>
          <p className="text-sm text-muted">
            {booking.showtime.screen.cinema.name} · {booking.showtime.screen.name} · {formatDate(booking.showtime.startsAt, { year: "numeric" })} at{" "}
            {formatTime(booking.showtime.startsAt)}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {booking.items.map((item) => (
              <li key={item.id} className="flex justify-between text-foreground">
                <span>
                  {item.seatLabel} <span className="text-muted">({item.categoryName.toLowerCase()})</span>
                </span>
                <span>{formatCents(item.unitPriceCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-muted">
              <dt>Subtotal</dt>
              <dd>{formatCents(booking.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between text-muted">
              <dt>Booking fee</dt>
              <dd>{formatCents(booking.feesCents)}</dd>
            </div>
            <div className="flex justify-between text-muted">
              <dt>Tax</dt>
              <dd>{formatCents(booking.taxCents)}</dd>
            </div>
            {booking.discountCents > 0 && (
              <div className="flex justify-between text-success">
                <dt>Discount</dt>
                <dd>-{formatCents(booking.discountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
              <dt>Total</dt>
              <dd>{formatCents(booking.totalCents)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div>
        <PaymentPanel bookingId={booking.id} holdExpiresAt={holdExpiresAt} />
      </div>
    </div>
  );
}
