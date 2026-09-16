/**
 * Pure pricing math with NO config/env dependency, deliberately — this file
 * is imported from client components (e.g. the seat map) for `formatCents`,
 * so it must never pull in `@/lib/config` (server-only env parsing), or
 * Next bundles that env read into the browser and it throws there (there is
 * no DATABASE_URL/AUTH_SECRET in the browser). The fee/tax rate are passed
 * in by the caller — see `computePricingBreakdown`'s only caller in
 * src/lib/booking/engine.ts, which sources them from `pricingConfig`.
 */

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

export interface FeeAndTaxConfig {
  bookingFeeCents: number;
  taxRate: number;
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
  feeAndTax: FeeAndTaxConfig,
  discountCents = 0,
): PricingBreakdown {
  const subtotalCents = seats.reduce((sum, s) => sum + s.unitPriceCents, 0);
  const feesCents = seats.length > 0 ? feeAndTax.bookingFeeCents : 0;
  const taxableCents = Math.max(0, subtotalCents + feesCents - discountCents);
  const taxCents = Math.round(taxableCents * feeAndTax.taxRate);
  const totalCents = Math.max(0, subtotalCents + feesCents + taxCents - discountCents);

  return { seats, subtotalCents, feesCents, taxCents, discountCents, totalCents };
}

export function formatCents(cents: number, currency = "AED"): string {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency, currencyDisplay: "code" }).format(cents / 100);
}
