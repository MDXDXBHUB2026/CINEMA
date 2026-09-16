import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/cookies";
import { assertOwnsResourceOrStaff } from "@/lib/auth/rbac";
import { getBookingDetail } from "@/lib/booking/queries";
import { isAppError } from "@/lib/errors";
import { renderTicketQrCode } from "@/lib/qrcode";
import { formatCents } from "@/lib/pricing";
import { formatDate, formatTime } from "@/lib/utils";
import { PrintButton } from "@/components/cinema/print-button";

export const metadata: Metadata = { title: "Your E-Ticket" };

export default async function TicketPage({ params }: PageProps<"/tickets/[bookingId]">) {
  const { bookingId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/tickets/${bookingId}`);

  let booking;
  try {
    booking = await getBookingDetail(bookingId);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  assertOwnsResourceOrStaff(user, booking.userId);

  if (!booking.ticket) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-xl font-semibold text-foreground">No ticket yet</h1>
        <p className="mt-2 text-muted">This booking hasn&apos;t been confirmed, so no ticket has been issued.</p>
      </div>
    );
  }

  const qrCode = await renderTicketQrCode(booking.ticket.ticketCode);

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 print:py-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface print:border-black">
        <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-5 py-3">
          <Clapperboard className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-bold text-foreground">CineBook</span>
        </div>
        <div className="p-5">
          <h1 className="text-lg font-bold text-foreground">{booking.showtime.movie.title}</h1>
          <p className="text-sm text-muted">{booking.showtime.movie.classification}</p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Cinema</dt>
              <dd className="font-medium text-foreground">{booking.showtime.screen.cinema.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Screen</dt>
              <dd className="font-medium text-foreground">{booking.showtime.screen.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Date</dt>
              <dd className="font-medium text-foreground">{formatDate(booking.showtime.startsAt, { year: "numeric" })}</dd>
            </div>
            <div>
              <dt className="text-muted">Time</dt>
              <dd className="font-medium text-foreground">{formatTime(booking.showtime.startsAt)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Seats</dt>
              <dd className="font-medium text-foreground">{booking.items.map((i) => i.seatLabel).join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted">Total paid</dt>
              <dd className="font-medium text-foreground">{formatCents(booking.totalCents)}</dd>
            </div>
            <div>
              <dt className="text-muted">Booking ref</dt>
              <dd className="font-mono font-medium text-foreground">{booking.bookingRef}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col items-center border-t border-dashed border-border pt-6">
            <Image src={qrCode} alt="Scannable ticket QR code" width={160} height={160} unoptimized />
            <p className="mt-2 font-mono text-xs text-muted">{booking.ticket.ticketCode}</p>
            <p className="mt-1 text-center text-xs text-muted">Present this code at the cinema entrance.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
