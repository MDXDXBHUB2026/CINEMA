import { describe, it, expect } from "vitest";
import { assertBookingTransition } from "@/lib/booking/state-machine";
import { AppError } from "@/lib/errors";
import { BOOKING_STATUSES, BOOKING_TRANSITIONS, type BookingStatus } from "@/lib/enums";

describe("booking state machine", () => {
  it("allows every documented transition", () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_TRANSITIONS[from]) {
        expect(() => assertBookingTransition(from, to)).not.toThrow();
      }
    }
  });

  it("rejects transitions that skip states, e.g. DRAFT -> CONFIRMED", () => {
    expect(() => assertBookingTransition("DRAFT", "CONFIRMED")).toThrow(AppError);
  });

  it("rejects any transition out of a terminal state", () => {
    expect(() => assertBookingTransition("CONFIRMED", "DRAFT")).toThrow(AppError);
    expect(() => assertBookingTransition("CANCELLED", "CONFIRMED" as BookingStatus)).toThrow(AppError);
    expect(() => assertBookingTransition("EXPIRED", "PAYMENT_PENDING" as BookingStatus)).toThrow(AppError);
  });

  it("throws an INVALID_BOOKING AppError describing the illegal transition", () => {
    try {
      assertBookingTransition("DRAFT", "CONFIRMED");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("INVALID_BOOKING");
      expect((err as AppError).message).toContain("DRAFT");
      expect((err as AppError).message).toContain("CONFIRMED");
    }
  });
});
