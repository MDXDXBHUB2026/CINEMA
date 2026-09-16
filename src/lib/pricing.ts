import { pricingConfig } from "@/lib/config";

export interface PricedSeat {
  showtimeSeatId: string;
  seatLabel: string;
  categoryName: string;
  unitPriceCents: number;
}

export interface PricingBreakdown {
  seats: PricedSeat[];
  subtotalCents: number;
  feesCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
}

/**
 * Server-authoritative price for a single seat: showtime base price scaled
 * by its category's multiplier, rounded to the nearest cent. Never trust a
 * price submitted by the client — this is the only place a seat price is
 * computed.
 */
export function priceSeat(basePriceCents: number, categoryMultiplier: number): number {
  return Math.round(basePriceCents * categoryMultiplier);
}

/**
 * Computes the full order breakdown for a set of already-priced seats.
 * The result is what gets snapshotted onto `Booking` so historical totals
 * never change if pricing config changes later.
 */
export function computePricingBreakdown(
  seats: PricedSeat[],
  discountCents = 0,
): PricingBreakdown {
  const subtotalCents = seats.reduce((sum, s) => sum + s.unitPriceCents, 0);
  const feesCents = seats.length > 0 ? pricingConfig.bookingFeeCents : 0;
  const taxableCents = Math.max(0, subtotalCents + feesCents - discountCents);
  const taxCents = Math.round(taxableCents * pricingConfig.taxRate);
  const totalCents = Math.max(0, subtotalCents + feesCents + taxCents - discountCents);

  return { seats, subtotalCents, feesCents, taxCents, discountCents, totalCents };
}

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
