import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateBookingRef } from "@/lib/ids";
import { priceSeat, computePricingBreakdown } from "@/lib/pricing";
import { assertBookingTransition } from "@/lib/booking/state-machine";
import { bookingEngineConfig, pricingConfig } from "@/lib/config";
import { paymentProvider } from "@/lib/payments/simulated-provider";
import type { SimulatedOutcome } from "@/lib/payments/provider";
import { BOOKING_TRANSITIONS, type BookingStatus } from "@/lib/enums";

const TX_OPTIONS = { timeout: 15_000, maxWait: 10_000 };

/**
 * Flips seats whose hold has expired back to AVAILABLE and marks the hold
 * EXPIRED, scoped to one showtime. MUST be called at the top of any
 * transaction that is about to claim seats for that showtime, so a stale
 * hold can never block a new one — this is what makes the 5-minute seat
 * hold self-healing without a background worker. See docs/BOOKING_ENGINE.md.
 */
async function sweepExpiredHoldsForShowtime(tx: Prisma.TransactionClient, showtimeId: string, now: Date) {
  const expiredSeats = await tx.showtimeSeat.findMany({
    where: { showtimeId, status: "HELD", holdExpiresAt: { lt: now } },
    select: { holdId: true },
  });
  if (expiredSeats.length === 0) return;

  await tx.showtimeSeat.updateMany({
    where: { showtimeId, status: "HELD", holdExpiresAt: { lt: now } },
    data: { status: "AVAILABLE", holdId: null, holdExpiresAt: null },
  });

  const holdIds = [...new Set(expiredSeats.map((s) => s.holdId).filter((id): id is string => !!id))];
  if (holdIds.length > 0) {
    await tx.seatHold.updateMany({
      where: { id: { in: holdIds }, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    for (const holdId of holdIds) logger.info("SEAT_HOLD_EXPIRED", { holdId, showtimeId });
  }
}

/** Global maintenance sweep across all showtimes — safe to call from a cron-like interval or an admin action. */
export async function sweepAllExpiredHolds(): Promise<number> {
  const now = new Date();
  const expired = await prisma.seatHold.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    select: { showtimeId: true },
    distinct: ["showtimeId"],
  });
  for (const { showtimeId } of expired) {
    await prisma.$transaction((tx) => sweepExpiredHoldsForShowtime(tx, showtimeId, now), TX_OPTIONS);
  }
  return expired.length;
}

export interface SeatMapEntry {
  showtimeSeatId: string;
  seatId: string;
  row: string;
  column: number;
  label: string;
  category: { id: string; name: string; priceMultiplier: number };
  isAccessible: boolean;
  status: "AVAILABLE" | "HELD" | "BOOKED";
  priceCents: number;
  heldByMe: boolean;
}

/** Authoritative seat map for a showtime, with expired holds already swept. */
export async function getShowtimeSeatMap(showtimeId: string, viewerUserId?: string): Promise<SeatMapEntry[]> {
  const now = new Date();
  await prisma.$transaction((tx) => sweepExpiredHoldsForShowtime(tx, showtimeId, now), TX_OPTIONS);

  const showtime = await prisma.showtime.findUnique({ where: { id: showtimeId } });
  if (!showtime) throw new AppError("NOT_FOUND", "Showtime not found.");

  const rows = await prisma.showtimeSeat.findMany({
    where: { showtimeId },
    include: { seat: { include: { category: true } }, hold: true },
    orderBy: [{ seat: { row: "asc" } }, { seat: { column: "asc" } }],
  });

  return rows.map((r) => ({
    showtimeSeatId: r.id,
    seatId: r.seatId,
    row: r.seat.row,
    column: r.seat.column,
    label: r.seat.label,
    category: {
      id: r.seat.category.id,
      name: r.seat.category.name,
      priceMultiplier: r.seat.category.priceMultiplier,
    },
    isAccessible: r.seat.isAccessible,
    status: r.status as SeatMapEntry["status"],
    priceCents: priceSeat(showtime.basePriceCents, r.seat.category.priceMultiplier),
    heldByMe: r.status === "HELD" && !!viewerUserId && r.hold?.userId === viewerUserId,
  }));
}

export interface CreateHoldParams {
  userId: string;
  showtimeId: string;
  seatIds: string[];
}

export interface HoldResult {
  holdId: string;
  expiresAt: Date;
}

/**
 * Atomically claims a set of seats for `userId`. Either every requested seat
 * becomes HELD under one new SeatHold, or none do — see
 * docs/BOOKING_ENGINE.md for the conditional-update pattern that makes this
 * safe under concurrent requests without an external lock.
 */
export async function createSeatHold({ userId, showtimeId, seatIds }: CreateHoldParams): Promise<HoldResult> {
  const uniqueSeatIds = [...new Set(seatIds)];
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const showtime = await tx.showtime.findUnique({ where: { id: showtimeId } });
    if (!showtime || showtime.status !== "SCHEDULED") {
      throw new AppError("SHOWTIME_NOT_AVAILABLE", "This showtime is not available for booking.");
    }
    if (showtime.startsAt <= now) {
      throw new AppError("SHOWTIME_NOT_AVAILABLE", "This showtime has already started.");
    }

    await sweepExpiredHoldsForShowtime(tx, showtimeId, now);

    const seatRows = await tx.showtimeSeat.findMany({
      where: { showtimeId, seatId: { in: uniqueSeatIds } },
      select: { id: true, seatId: true },
    });
    if (seatRows.length !== uniqueSeatIds.length) {
      throw new AppError("SEAT_UNAVAILABLE", "One or more selected seats do not exist for this showtime.");
    }

    const expiresAt = new Date(now.getTime() + bookingEngineConfig.seatHoldTtlSeconds * 1000);
    const hold = await tx.seatHold.create({
      data: { showtimeId, userId, status: "ACTIVE", expiresAt },
    });

    const unavailable: string[] = [];
    for (const row of seatRows) {
      // The WHERE status:'AVAILABLE' is the whole mechanism: this UPDATE only
      // affects the row if it is still available at the instant it executes,
      // and the surrounding DB transaction guarantees no other transaction
      // can interleave a conflicting write on the same row. Exactly one
      // concurrent caller wins per seat; everyone else gets count === 0.
      const result = await tx.showtimeSeat.updateMany({
        where: { id: row.id, status: "AVAILABLE" },
        data: { status: "HELD", holdId: hold.id, holdExpiresAt: expiresAt },
      });
      if (result.count !== 1) unavailable.push(row.seatId);
    }

    if (unavailable.length > 0) {
      // Throwing inside an interactive $transaction rolls back every write
      // made so far in this callback, including the SeatHold row itself.
      throw new AppError(
        "SEAT_UNAVAILABLE",
        "One or more selected seats were just taken by another customer.",
        { seatIds: unavailable },
      );
    }

    logger.info("SEAT_HOLD_CREATED", { holdId: hold.id, showtimeId, userId, seatCount: uniqueSeatIds.length });
    return { holdId: hold.id, expiresAt };
  }, TX_OPTIONS);
}

export async function releaseHold({ userId, holdId }: { userId: string; holdId: string }): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const hold = await tx.seatHold.findUnique({ where: { id: holdId } });
    if (!hold || hold.userId !== userId) throw new AppError("NOT_FOUND", "Seat hold not found.");
    if (hold.status !== "ACTIVE") return;

    await tx.showtimeSeat.updateMany({
      where: { holdId: hold.id, status: "HELD" },
      data: { status: "AVAILABLE", holdId: null, holdExpiresAt: null },
    });
    await tx.seatHold.update({ where: { id: hold.id }, data: { status: "RELEASED" } });
    logger.info("SEAT_HOLD_RELEASED", { holdId: hold.id, userId });
  }, TX_OPTIONS);
}

async function createBookingRow(
  tx: Prisma.TransactionClient,
  params: { userId: string; showtimeId: string; holdId: string; items: Prisma.BookingItemUncheckedCreateWithoutBookingInput[]; breakdown: ReturnType<typeof computePricingBreakdown> },
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await tx.booking.create({
        data: {
          bookingRef: generateBookingRef(),
          userId: params.userId,
          showtimeId: params.showtimeId,
          holdId: params.holdId,
          status: "DRAFT",
          subtotalCents: params.breakdown.subtotalCents,
          feesCents: params.breakdown.feesCents,
          taxCents: params.breakdown.taxCents,
          discountCents: params.breakdown.discountCents,
          totalCents: params.breakdown.totalCents,
          items: { create: params.items },
        },
        include: { items: true },
      });
    } catch (err) {
      // P2002 on bookingRef is a ~1-in-a-trillion nanoid collision; retry
      // with a freshly generated ref rather than failing the checkout.
      const isRefCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("bookingRef");
      if (!isRefCollision || attempt === 2) throw err;
    }
  }
  throw new AppError("INTERNAL_ERROR", "Could not allocate a booking reference.");
}

/**
 * Converts an ACTIVE hold into a DRAFT booking with a server-computed
 * pricing snapshot. Idempotent: `Booking.holdId` is unique, so calling this
 * twice for the same hold (double-click, back button) returns the existing
 * booking instead of creating a second one.
 */
export async function createBookingFromHold({ userId, holdId }: { userId: string; holdId: string }) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const hold = await tx.seatHold.findUnique({
      where: { id: holdId },
      include: {
        showtime: true,
        seats: { include: { seat: { include: { category: true } } } },
        booking: true,
      },
    });
    if (!hold || hold.userId !== userId) throw new AppError("NOT_FOUND", "Seat hold not found.");
    if (hold.booking) return tx.booking.findUniqueOrThrow({ where: { id: hold.booking.id }, include: { items: true } });

    if (hold.status !== "ACTIVE" || hold.expiresAt <= now) {
      await sweepExpiredHoldsForShowtime(tx, hold.showtimeId, now);
      throw new AppError("SEAT_HOLD_EXPIRED", "Your seat reservation expired. Please select your seats again.");
    }

    const items = hold.seats.map((showtimeSeat) => ({
      showtimeSeatId: showtimeSeat.id,
      seatLabel: showtimeSeat.seat.label,
      categoryName: showtimeSeat.seat.category.name,
      unitPriceCents: priceSeat(hold.showtime.basePriceCents, showtimeSeat.seat.category.priceMultiplier),
    }));
    const breakdown = computePricingBreakdown(items, pricingConfig);

    const booking = await createBookingRow(tx, { userId, showtimeId: hold.showtimeId, holdId: hold.id, items, breakdown });
    logger.info("BOOKING_CREATED", { bookingId: booking.id, bookingRef: booking.bookingRef, userId, totalCents: booking.totalCents });
    return booking;
  }, TX_OPTIONS);
}

export interface PayForBookingParams {
  userId: string;
  bookingId: string;
  idempotencyKey: string;
  simulateOutcome?: SimulatedOutcome;
}

export interface PayForBookingResult {
  bookingStatus: BookingStatus;
  paymentStatus: string;
  ticketCode?: string;
}

// States a booking may legally be in immediately before PAYMENT_PENDING,
// derived from the state machine table itself (not hand-duplicated) so
// this can never silently drift from src/lib/enums.ts.
const PAYABLE_SOURCE_STATUSES = (Object.keys(BOOKING_TRANSITIONS) as BookingStatus[]).filter((status) =>
  BOOKING_TRANSITIONS[status].includes("PAYMENT_PENDING"),
);

/**
 * Charges (simulated) and finalizes a booking. Safe to retry with the same
 * `idempotencyKey`: a repeat call short-circuits to the already-recorded
 * outcome instead of charging or booking twice. See docs/BOOKING_ENGINE.md
 * "Payment idempotency".
 */
export async function payForBooking(params: PayForBookingParams): Promise<PayForBookingResult> {
  // Fast path: a fully-finalized payment for this key already exists (a
  // sequential retry after full completion).
  const precheck = await prisma.payment.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (precheck && precheck.status !== "PENDING") {
    return resultFromFinalizedPayment(precheck.id);
  }

  const booking0 = await prisma.booking.findUnique({ where: { id: params.bookingId } });
  if (!booking0 || booking0.userId !== params.userId) throw new AppError("NOT_FOUND", "Booking not found.");

  // Claim the idempotency key with a plain create + catch-on-conflict —
  // deliberately NOT `upsert`, and deliberately NOT nested inside the
  // larger transaction below. Two real bugs were found getting this right:
  // 1. A naive "findUnique, then create if missing" pair races under
  //    Postgres's default READ COMMITTED isolation: two concurrent calls
  //    can both observe "no row yet" and both attempt to create one,
  //    and the loser gets a raw unique-constraint error instead of the
  //    intended idempotent behavior. (SQLite's local dev
  //    connection_limit=1 fully serializes transactions and hid this race
  //    during earlier development.)
  // 2. `tx.payment.upsert()` was tried next, expecting Prisma to compile it
  //    to a single atomic `INSERT ... ON CONFLICT` — but under real
  //    concurrent load it still surfaced the same unique-constraint error,
  //    disproving that assumption for this query shape/version. Trying to
  //    catch that error and continue on the SAME `tx` would not have
  //    worked anyway: Postgres aborts an entire transaction after any
  //    statement error (no partial rollback without a SAVEPOINT), so every
  //    later query on that `tx` would fail too.
  // The fix: run the claim as its own standalone statement (no enclosing
  // transaction to abort), so a P2002 here is a normal, isolated,
  // catchable error — the loser simply re-reads the winner's row.
  let payment: Awaited<ReturnType<typeof prisma.payment.create>>;
  try {
    payment = await prisma.payment.create({
      data: { bookingId: booking0.id, idempotencyKey: params.idempotencyKey, amountCents: booking0.totalCents, status: "PENDING" },
    });
  } catch (err) {
    const isDuplicateKey = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    if (!isDuplicateKey) throw err;
    payment = await prisma.payment.findUniqueOrThrow({ where: { idempotencyKey: params.idempotencyKey } });
  }

  if (payment.status !== "PENDING") {
    return resultFromFinalizedPayment(payment.id);
  }

  const booking = await prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUniqueOrThrow({ where: { id: params.bookingId }, include: { hold: true } });

    if (!current.hold || current.hold.status !== "ACTIVE" || current.hold.expiresAt <= new Date()) {
      throw new AppError("SEAT_HOLD_EXPIRED", "Your seat reservation expired before payment could complete. Please select your seats again.");
    }

    // Conditional update (the same pattern used throughout this file):
    // only actually transitions the booking if it's currently in an
    // allowed source state. A concurrent duplicate call for the same
    // idempotencyKey that already performed this transition makes this a
    // harmless no-op (0 rows matched) instead of a stale re-validation.
    await tx.booking.updateMany({
      where: { id: current.id, status: { in: PAYABLE_SOURCE_STATUSES } },
      data: { status: "PAYMENT_PENDING" },
    });

    const updated = await tx.booking.findUniqueOrThrow({ where: { id: current.id } });
    if (updated.status !== "PAYMENT_PENDING") {
      throw new AppError("INVALID_BOOKING", `Booking is ${updated.status} and cannot be paid for.`);
    }
    return updated;
  }, TX_OPTIONS);

  logger.info("PAYMENT_ATTEMPTED", { bookingId: booking.id, paymentId: payment.id, amountCents: payment.amountCents });

  const chargeResult = await paymentProvider.charge({
    amountCents: payment.amountCents,
    currency: booking.currency,
    idempotencyKey: payment.idempotencyKey,
    simulateOutcome: params.simulateOutcome,
  });

  return finalizePayment({ bookingId: booking.id, paymentId: payment.id, holdId: booking.holdId, chargeStatus: chargeResult.status });
}

async function finalizePayment(args: {
  bookingId: string;
  paymentId: string;
  holdId: string | null;
  chargeStatus: "SUCCEEDED" | "FAILED" | "CANCELLED" | "TIMEOUT";
}): Promise<PayForBookingResult> {
  const result = await prisma.$transaction(async (tx) => {
    // Conditional update: only the first finalize call for this payment wins;
    // a concurrent duplicate (double-click, retried request) sees count===0
    // and falls through to re-read the already-finalized state below.
    const claimed = await tx.payment.updateMany({
      where: { id: args.paymentId, status: "PENDING" },
      data: { status: args.chargeStatus === "SUCCEEDED" ? "SUCCEEDED" : args.chargeStatus, simulatedOutcome: args.chargeStatus },
    });

    if (claimed.count === 0) {
      return null; // someone else already finalized this payment
    }

    if (args.chargeStatus === "SUCCEEDED") {
      await tx.booking.update({ where: { id: args.bookingId }, data: { status: "CONFIRMED" } });
      if (args.holdId) {
        await tx.showtimeSeat.updateMany({
          where: { holdId: args.holdId, status: "HELD" },
          data: { status: "BOOKED", holdExpiresAt: null },
        });
        await tx.seatHold.update({ where: { id: args.holdId }, data: { status: "CONSUMED" } });
      }
      const ticketCode = `TK-${args.bookingId.slice(-10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const ticket = await tx.ticket.create({ data: { bookingId: args.bookingId, ticketCode } });
      logger.info("PAYMENT_SUCCEEDED", { bookingId: args.bookingId, paymentId: args.paymentId });
      logger.info("BOOKING_CONFIRMED", { bookingId: args.bookingId });
      return { bookingStatus: "CONFIRMED" as BookingStatus, paymentStatus: "SUCCEEDED", ticketCode: ticket.ticketCode };
    }

    await tx.booking.update({ where: { id: args.bookingId }, data: { status: "PAYMENT_FAILED" } });
    logger.warn("PAYMENT_FAILED", { bookingId: args.bookingId, paymentId: args.paymentId, reason: args.chargeStatus });
    return { bookingStatus: "PAYMENT_FAILED" as BookingStatus, paymentStatus: args.chargeStatus };
  }, TX_OPTIONS);

  if (result) return result;
  return resultFromFinalizedPayment(args.paymentId);
}

async function resultFromFinalizedPayment(paymentId: string): Promise<PayForBookingResult> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: { include: { ticket: true } } } });
  if (!payment) throw new AppError("NOT_FOUND", "Payment not found.");
  return {
    bookingStatus: payment.booking.status as BookingStatus,
    paymentStatus: payment.status,
    ticketCode: payment.booking.ticket?.ticketCode,
  };
}

/** Cancels a CONFIRMED booking and releases its seats back to AVAILABLE. */
export async function cancelBooking({ userId, bookingId, isStaff }: { userId: string; bookingId: string; isStaff: boolean }) {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) throw new AppError("NOT_FOUND", "Booking not found.");
    if (booking.userId !== userId && !isStaff) throw new AppError("FORBIDDEN", "You do not have permission to cancel this booking.");

    assertBookingTransition(booking.status as BookingStatus, "CANCELLED");

    const showtimeSeatIds = booking.items.map((i) => i.showtimeSeatId);
    if (showtimeSeatIds.length > 0) {
      await tx.showtimeSeat.updateMany({
        where: { id: { in: showtimeSeatIds } },
        data: { status: "AVAILABLE", holdId: null, holdExpiresAt: null },
      });
    }
    await tx.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
    logger.info("BOOKING_CANCELLED", { bookingId, userId });
  }, TX_OPTIONS);
}
