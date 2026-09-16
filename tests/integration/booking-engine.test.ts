import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestShowtime, createTestUser } from "../fixtures";
import { createSeatHold, createBookingFromHold, payForBooking, releaseHold, getShowtimeSeatMap, cancelBooking } from "@/lib/booking/engine";
import { AppError } from "@/lib/errors";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createSeatHold", () => {
  it("holds the requested seats and returns an expiry", async () => {
    const { showtime, seats } = await createTestShowtime();
    const user = await createTestUser();

    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id, seats[1].id] });

    expect(hold.holdId).toBeTruthy();
    expect(hold.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const map = await getShowtimeSeatMap(showtime.id, user.id);
    const held = map.filter((s) => s.status === "HELD");
    expect(held).toHaveLength(2);
    expect(held.every((s) => s.heldByMe)).toBe(true);
  });

  it("rejects a hold on an already-held seat with SEAT_UNAVAILABLE, and rolls back the whole request", async () => {
    const { showtime, seats } = await createTestShowtime({ seatCount: 4 });
    const userA = await createTestUser();
    const userB = await createTestUser();

    await createSeatHold({ userId: userA.id, showtimeId: showtime.id, seatIds: [seats[0].id] });

    await expect(
      createSeatHold({ userId: userB.id, showtimeId: showtime.id, seatIds: [seats[0].id, seats[1].id] }),
    ).rejects.toMatchObject({ code: "SEAT_UNAVAILABLE" });

    // seats[1] must NOT have been left HELD by user B's failed all-or-nothing request.
    const map = await getShowtimeSeatMap(showtime.id);
    const seat2 = map.find((s) => s.seatId === seats[1].id);
    expect(seat2?.status).toBe("AVAILABLE");
  });

  it("rejects seat ids that don't belong to the showtime", async () => {
    const { showtime } = await createTestShowtime();
    const other = await createTestShowtime();
    const user = await createTestUser();

    await expect(
      createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [other.seats[0].id] }),
    ).rejects.toMatchObject({ code: "SEAT_UNAVAILABLE" });
  });

  it("automatically reclaims a seat whose hold has expired", async () => {
    const { showtime, seats } = await createTestShowtime({ startsInMs: 60 * 60 * 1000 });
    const userA = await createTestUser();
    const userB = await createTestUser();

    const hold = await createSeatHold({ userId: userA.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    // Force-expire it directly in the DB (simulating the 5-minute TTL elapsing).
    await prisma.seatHold.update({ where: { id: hold.holdId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await prisma.showtimeSeat.updateMany({ where: { holdId: hold.holdId }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });

    const secondHold = await createSeatHold({ userId: userB.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    expect(secondHold.holdId).not.toBe(hold.holdId);

    const map = await getShowtimeSeatMap(showtime.id, userB.id);
    const seat = map.find((s) => s.seatId === seats[0].id);
    expect(seat?.status).toBe("HELD");
    expect(seat?.heldByMe).toBe(true);
  });
});

describe("the concurrency guarantee (Gate 6)", () => {
  it("under many simultaneous requests for the same seat, exactly one hold succeeds and everyone else gets SEAT_UNAVAILABLE", async () => {
    const { showtime, seats } = await createTestShowtime({ seatCount: 1 });
    const contenders = await Promise.all(Array.from({ length: 12 }, () => createTestUser()));

    const results = await Promise.allSettled(
      contenders.map((user) => createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id] })),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(11);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(AppError);
      expect((r.reason as AppError).code).toBe("SEAT_UNAVAILABLE");
    }

    const map = await getShowtimeSeatMap(showtime.id);
    expect(map[0].status).toBe("HELD");
  });

  it("once a seat is CONFIRMED-booked, no later concurrent hold attempt can claim it", async () => {
    const { showtime, seats } = await createTestShowtime({ seatCount: 1 });
    const buyer = await createTestUser();

    const hold = await createSeatHold({ userId: buyer.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    const booking = await createBookingFromHold({ userId: buyer.id, holdId: hold.holdId });
    const paid = await payForBooking({ userId: buyer.id, bookingId: booking.id, idempotencyKey: `pay-${booking.id}`, simulateOutcome: "SUCCESS" });
    expect(paid.bookingStatus).toBe("CONFIRMED");

    const latecomers = await Promise.all(Array.from({ length: 5 }, () => createTestUser()));
    const results = await Promise.allSettled(
      latecomers.map((u) => createSeatHold({ userId: u.id, showtimeId: showtime.id, seatIds: [seats[0].id] })),
    );
    expect(results.every((r) => r.status === "rejected")).toBe(true);

    // Exactly one confirmed booking item exists for this seat, ever.
    const bookingItemsForSeat = await prisma.bookingItem.findMany({
      where: { showtimeSeat: { seatId: seats[0].id, showtimeId: showtime.id } },
    });
    expect(bookingItemsForSeat).toHaveLength(1);
  });
});

describe("createBookingFromHold", () => {
  it("snapshots server-computed pricing onto the booking, ignoring any client-supplied price", async () => {
    const { showtime, seats } = await createTestShowtime({ basePriceCents: 1000, seatCount: 4 });
    const user = await createTestUser();
    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id, seats[1].id] });

    const booking = await createBookingFromHold({ userId: user.id, holdId: hold.holdId });

    expect(booking.status).toBe("DRAFT");
    expect(booking.subtotalCents).toBeGreaterThan(0);
    expect(booking.items).toHaveLength(2);
    expect(booking.totalCents).toBe(booking.subtotalCents + booking.feesCents + booking.taxCents - booking.discountCents);
  });

  it("is idempotent: calling it twice for the same hold returns the same booking", async () => {
    const { showtime, seats } = await createTestShowtime();
    const user = await createTestUser();
    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id] });

    const first = await createBookingFromHold({ userId: user.id, holdId: hold.holdId });
    const second = await createBookingFromHold({ userId: user.id, holdId: hold.holdId });
    expect(second.id).toBe(first.id);

    const count = await prisma.booking.count({ where: { holdId: hold.holdId } });
    expect(count).toBe(1);
  });

  it("refuses to create a booking from another user's hold", async () => {
    const { showtime, seats } = await createTestShowtime();
    const owner = await createTestUser();
    const attacker = await createTestUser();
    const hold = await createSeatHold({ userId: owner.id, showtimeId: showtime.id, seatIds: [seats[0].id] });

    await expect(createBookingFromHold({ userId: attacker.id, holdId: hold.holdId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to create a booking from an expired hold", async () => {
    const { showtime, seats } = await createTestShowtime();
    const user = await createTestUser();
    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    await prisma.seatHold.update({ where: { id: hold.holdId }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(createBookingFromHold({ userId: user.id, holdId: hold.holdId })).rejects.toMatchObject({ code: "SEAT_HOLD_EXPIRED" });
  });
});

describe("payForBooking", () => {
  it("confirms the booking, books the seats, and issues a ticket on SUCCESS", async () => {
    const { showtime, seats } = await createTestShowtime();
    const user = await createTestUser();
    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    const booking = await createBookingFromHold({ userId: user.id, holdId: hold.holdId });

    const result = await payForBooking({ userId: user.id, bookingId: booking.id, idempotencyKey: "key-1", simulateOutcome: "SUCCESS" });

    expect(result.bookingStatus).toBe("CONFIRMED");
    expect(result.paymentStatus).toBe("SUCCEEDED");
    expect(result.ticketCode).toBeTruthy();

    const confirmedSeat = await prisma.showtimeSeat.findFirst({ where: { seatId: seats[0].id, showtimeId: showtime.id } });
    expect(confirmedSeat?.status).toBe("BOOKED");
  });

  it("marks the booking PAYMENT_FAILED on DECLINED and keeps the seat held (not released, not booked)", async () => {
    const { showtime, seats } = await createTestShowtime();
    const user = await createTestUser();
    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    const booking = await createBookingFromHold({ userId: user.id, holdId: hold.holdId });

    const result = await payForBooking({ userId: user.id, bookingId: booking.id, idempotencyKey: "key-declined", simulateOutcome: "DECLINED" });

    expect(result.bookingStatus).toBe("PAYMENT_FAILED");
    expect(result.paymentStatus).toBe("FAILED");

    const seat = await prisma.showtimeSeat.findFirst({ where: { seatId: seats[0].id, showtimeId: showtime.id } });
    expect(seat?.status).toBe("HELD");
  });

  it("allows retrying payment after a decline, and succeeds without creating a duplicate booking", async () => {
    const { showtime, seats } = await createTestShowtime();
    const user = await createTestUser();
    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    const booking = await createBookingFromHold({ userId: user.id, holdId: hold.holdId });

    await payForBooking({ userId: user.id, bookingId: booking.id, idempotencyKey: "attempt-1", simulateOutcome: "DECLINED" });
    const retry = await payForBooking({ userId: user.id, bookingId: booking.id, idempotencyKey: "attempt-2", simulateOutcome: "SUCCESS" });

    expect(retry.bookingStatus).toBe("CONFIRMED");
    const bookingCount = await prisma.booking.count({ where: { holdId: hold.holdId } });
    expect(bookingCount).toBe(1);
  });

  it("is idempotent under a duplicated request with the same idempotency key (no double charge, no double ticket)", async () => {
    const { showtime, seats } = await createTestShowtime();
    const user = await createTestUser();
    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    const booking = await createBookingFromHold({ userId: user.id, holdId: hold.holdId });

    const [a, b] = await Promise.all([
      payForBooking({ userId: user.id, bookingId: booking.id, idempotencyKey: "same-key", simulateOutcome: "SUCCESS" }),
      payForBooking({ userId: user.id, bookingId: booking.id, idempotencyKey: "same-key", simulateOutcome: "SUCCESS" }),
    ]);

    expect(a.bookingStatus).toBe("CONFIRMED");
    expect(b.bookingStatus).toBe("CONFIRMED");
    expect(a.ticketCode).toBe(b.ticketCode);

    const tickets = await prisma.ticket.count({ where: { bookingId: booking.id } });
    expect(tickets).toBe(1);
    const payments = await prisma.payment.count({ where: { bookingId: booking.id } });
    expect(payments).toBe(1);
  });

  it("refuses payment once the hold has expired, even if the booking was already created", async () => {
    const { showtime, seats } = await createTestShowtime();
    const user = await createTestUser();
    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    const booking = await createBookingFromHold({ userId: user.id, holdId: hold.holdId });

    await prisma.seatHold.update({ where: { id: hold.holdId }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(
      payForBooking({ userId: user.id, bookingId: booking.id, idempotencyKey: "too-late", simulateOutcome: "SUCCESS" }),
    ).rejects.toMatchObject({ code: "SEAT_HOLD_EXPIRED" });
  });
});

describe("releaseHold and cancelBooking", () => {
  it("releaseHold frees the seat immediately for others", async () => {
    const { showtime, seats } = await createTestShowtime();
    const userA = await createTestUser();
    const userB = await createTestUser();

    const hold = await createSeatHold({ userId: userA.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    await releaseHold({ userId: userA.id, holdId: hold.holdId });

    const secondHold = await createSeatHold({ userId: userB.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    expect(secondHold.holdId).toBeTruthy();
  });

  it("cancelBooking on a CONFIRMED booking releases the seat back to AVAILABLE", async () => {
    const { showtime, seats } = await createTestShowtime();
    const user = await createTestUser();
    const hold = await createSeatHold({ userId: user.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    const booking = await createBookingFromHold({ userId: user.id, holdId: hold.holdId });
    await payForBooking({ userId: user.id, bookingId: booking.id, idempotencyKey: "cancel-flow", simulateOutcome: "SUCCESS" });

    await cancelBooking({ userId: user.id, bookingId: booking.id, isStaff: false });

    const seat = await prisma.showtimeSeat.findFirst({ where: { seatId: seats[0].id, showtimeId: showtime.id } });
    expect(seat?.status).toBe("AVAILABLE");
  });

  it("refuses to cancel someone else's booking", async () => {
    const { showtime, seats } = await createTestShowtime();
    const owner = await createTestUser();
    const attacker = await createTestUser();
    const hold = await createSeatHold({ userId: owner.id, showtimeId: showtime.id, seatIds: [seats[0].id] });
    const booking = await createBookingFromHold({ userId: owner.id, holdId: hold.holdId });
    await payForBooking({ userId: owner.id, bookingId: booking.id, idempotencyKey: "owner-pay", simulateOutcome: "SUCCESS" });

    await expect(cancelBooking({ userId: attacker.id, bookingId: booking.id, isStaff: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
