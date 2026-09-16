import { AppError } from "@/lib/errors";
import { BOOKING_TRANSITIONS, type BookingStatus } from "@/lib/enums";

/**
 * Throws INVALID_BOOKING if `next` is not a legal transition from `current`.
 * Every write to Booking.status must go through this guard — see
 * docs/BOOKING_ENGINE.md "Booking state machine".
 */
export function assertBookingTransition(current: BookingStatus, next: BookingStatus): void {
  const allowed = BOOKING_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new AppError(
      "INVALID_BOOKING",
      `Cannot transition booking from ${current} to ${next}`,
    );
  }
}
