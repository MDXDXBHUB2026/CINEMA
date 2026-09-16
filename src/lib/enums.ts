/**
 * Central source of truth for the string-typed "enum" columns in
 * prisma/schema.prisma (SQLite has no native enum type). Every value written
 * to one of these columns must come from one of these arrays/types so the
 * database and the type system never disagree.
 */

export const ROLES = ["CUSTOMER", "STAFF", "CINEMA_MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const MOVIE_STATUSES = ["NOW_SHOWING", "COMING_SOON", "ARCHIVED"] as const;
export type MovieStatus = (typeof MOVIE_STATUSES)[number];

export const SHOWTIME_STATUSES = ["SCHEDULED", "CANCELLED"] as const;
export type ShowtimeStatus = (typeof SHOWTIME_STATUSES)[number];

export const SHOWTIME_SEAT_STATUSES = ["AVAILABLE", "HELD", "BOOKED"] as const;
export type ShowtimeSeatStatus = (typeof SHOWTIME_SEAT_STATUSES)[number];

export const SEAT_HOLD_STATUSES = ["ACTIVE", "CONSUMED", "EXPIRED", "RELEASED"] as const;
export type SeatHoldStatus = (typeof SEAT_HOLD_STATUSES)[number];

export const BOOKING_STATUSES = [
  "DRAFT",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
  "PAYMENT_FAILED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Allowed booking state transitions. Enforced centrally in
 * `src/lib/booking/state-machine.ts` — never mutate `Booking.status` outside
 * that module.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  DRAFT: ["PAYMENT_PENDING", "CANCELLED", "EXPIRED"],
  PAYMENT_PENDING: ["CONFIRMED", "PAYMENT_FAILED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["CANCELLED"],
  CANCELLED: [],
  EXPIRED: [],
  PAYMENT_FAILED: ["PAYMENT_PENDING", "CANCELLED"],
};

export const PAYMENT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED", "TIMEOUT"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SEAT_CATEGORY_NAMES = ["STANDARD", "PREMIUM", "ACCESSIBLE"] as const;
export type SeatCategoryName = (typeof SEAT_CATEGORY_NAMES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
