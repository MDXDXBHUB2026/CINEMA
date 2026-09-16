import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { formatCents } from "@/lib/pricing";
import { formatDate, formatTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Bookings" };

const STATUS_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  CONFIRMED: "success",
  PAYMENT_PENDING: "warning",
  PAYMENT_FAILED: "danger",
  DRAFT: "default",
  CANCELLED: "default",
  EXPIRED: "default",
};

export default async function AdminBookingsPage() {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, showtime: { include: { movie: true, screen: { include: { cinema: true } } } }, items: true, payments: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
      <p className="mt-1 text-sm text-muted">Most recent 100 bookings across all customers.</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5">Ref</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Movie</th>
              <th className="px-4 py-2.5">Seats</th>
              <th className="px-4 py-2.5">Total</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Payments</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-xs text-foreground">{b.bookingRef}</td>
                <td className="px-4 py-2.5 text-muted">
                  {b.user.name}
                  <div className="text-xs">{b.user.email}</div>
                </td>
                <td className="px-4 py-2.5 text-foreground">
                  {b.showtime.movie.title}
                  <div className="text-xs text-muted">
                    {b.showtime.screen.cinema.name} · {formatDate(b.showtime.startsAt)} {formatTime(b.showtime.startsAt)}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted">{b.items.map((i) => i.seatLabel).join(", ") || "—"}</td>
                <td className="px-4 py-2.5 text-foreground">{formatCents(b.totalCents)}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={STATUS_VARIANT[b.status] ?? "default"}>{b.status.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted">
                  {b.payments.length === 0 ? "—" : b.payments.map((p) => p.status).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
