import { customAlphabet } from "nanoid";

// Unambiguous alphabet (no 0/O/1/I) for human-read/typed codes.
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nano = customAlphabet(alphabet, 8);

/** Human-facing booking reference, e.g. "CB-7K2M9QRT". Not a DB primary key. */
export function generateBookingRef(): string {
  return `CB-${nano()}`;
}

/** Opaque ticket code used as the QR payload — carries no personal data. */
export function generateTicketCode(): string {
  return `TK-${nano()}${nano()}`;
}

/** Idempotency key for a payment confirmation attempt when the client omits one. */
export function generateIdempotencyKey(): string {
  return `pay_${nano()}${nano()}`;
}
