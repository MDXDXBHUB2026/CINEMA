# Booking Engine

This is the most safety-critical subsystem in CineBook: it is responsible
for the single invariant that matters most — **no seat can ever be
confirmed-booked twice for the same showtime** — under real concurrent
load, without external locking infrastructure (no Redis, no distributed
lock manager).

All code referenced here lives in `src/lib/booking/engine.ts` unless noted.

## The inventory model

`ShowtimeSeat` (one row per `(showtimeId, seatId)`, unique-constrained) is
the single source of truth for a seat's bookability at a given showtime.
It carries:

- `status`: `AVAILABLE` | `HELD` | `BOOKED`
- `holdId` / `holdExpiresAt`: which `SeatHold` currently owns it, and when
  that claim expires

Everything else (holds, bookings, tickets) is a client of this row, never
a second, independent source of truth. This matters: a naive design might
track "is this seat taken" via `COUNT(*) FROM BookingItem WHERE
showtimeSeatId = X`, but that pushes the concurrency problem onto
composing two separate writes (insert a `BookingItem` + check inventory)
instead of one atomic conditional update.

## The core mechanism: conditional UPDATE inside a transaction

`createSeatHold` claims N seats atomically like this (simplified):

```ts
await prisma.$transaction(async (tx) => {
  const hold = await tx.seatHold.create({ data: { ... } });

  for (const seat of requestedSeats) {
    const result = await tx.showtimeSeat.updateMany({
      where: { id: seat.id, status: "AVAILABLE" },   // <-- the whole mechanism
      data: { status: "HELD", holdId: hold.id, holdExpiresAt },
    });
    if (result.count !== 1) throw new AppError("SEAT_UNAVAILABLE", ...);
    //                       ^ rolls back the ENTIRE transaction, including
    //                         the SeatHold row created above
  }
});
```

Why this is safe under concurrency, without `SELECT ... FOR UPDATE` or an
external lock:

- An `UPDATE ... WHERE status = 'AVAILABLE'` only affects the row if that
  condition is still true **at the moment the database engine executes the
  write**, and acquiring a write intent on a row is itself how the engine
  serializes concurrent writers to that row — there is no window where two
  transactions can both read "AVAILABLE" and both proceed to write. One of
  two concurrent conflicting `UPDATE`s always waits for the other's
  transaction to finish, then re-evaluates the `WHERE` clause against
  committed data, and finds `status` already `'HELD'`.
- On **PostgreSQL** (this project's database, both locally via
  docker-compose and in Render production) under its default `READ
  COMMITTED` isolation, an `UPDATE` takes a row-level lock; a second
  concurrent `UPDATE` targeting the same row blocks until the first
  transaction commits or rolls back, then re-runs its `WHERE` predicate
  against the now-current row. This is standard, well-understood Postgres
  behavior — no `SERIALIZABLE` isolation or advisory locks needed for this
  specific pattern.
- This project ran on SQLite for local development early on, before
  migrating fully to PostgreSQL (see [DEPLOYMENT.md](./DEPLOYMENT.md)).
  SQLite's single-writer-per-file model happened to serialize transactions
  even more strictly than Postgres does — which, as the note below and the
  "Payment idempotency" section describe, once *hid* a real concurrency
  bug rather than catching it. This is retained as a cautionary note, not
  current configuration.
- The whole multi-seat claim happens inside **one** interactive
  `$transaction`: if any single seat in the request fails, throwing rolls
  back every write made so far in that callback, including the `SeatHold`
  row itself. Callers never see a partially-held booking.

This is the standard "optimistic conditional update" pattern used by most
production seat-inventory/ticketing systems, and it composes correctly with
Prisma's `$transaction` semantics.

### Historical note (no longer applicable): SQLite's `connection_limit=1`

This project used SQLite for local development before migrating fully to
PostgreSQL (see [DEPLOYMENT.md](./DEPLOYMENT.md)) — kept here because it's
directly relevant to why the "Payment idempotency" section below required
three iterations to get right. During that earlier SQLite phase, a bug
surfaced under the automated concurrency
test (12 simultaneous `createSeatHold` calls for one seat): some requests
failed with a raw `SQLITE_BUSY` / "database is locked" `PrismaClientKnownRequestError`
instead of the intended `SEAT_UNAVAILABLE`. Root cause: Prisma's default
SQLite connector opens multiple connections that each try to open their
own write transaction against the same file, and SQLite's single-writer
model rejects the loser outright rather than queuing it the way Postgres's
row locks do.

Fix: `DATABASE_URL="file:./dev.db?connection_limit=1"` forces Prisma to
serialize all queries through one connection, so "concurrent" requests are
correctly queued and each one gets a clean, current view of the database
instead of colliding on the file lock. **PostgreSQL does not need this** —
its connection pooling and row-level locking handle real concurrency
natively; this is purely a SQLite-as-local-dev-fallback quirk. See
`.env.example` for where this is configured.

## Seat hold expiry — self-healing, no background worker

There is no cron job or worker process expiring holds. Instead,
`sweepExpiredHoldsForShowtime` runs at the top of every transaction that is
about to claim seats for a given showtime (`createSeatHold`,
`getShowtimeSeatMap`): it flips any `ShowtimeSeat` whose `holdExpiresAt` has
passed back to `AVAILABLE` and marks the corresponding `SeatHold` `EXPIRED`,
*before* attempting to claim new seats. Because this runs inside the same
transaction as the claim, there's no race between "sweep" and "claim" — a
seat that was HELD-but-expired becomes eligible for the new hold atomically.

A best-effort global sweep (`sweepAllExpiredHolds`) also exists for
maintenance/admin use, but correctness never depends on it running — it's
a convenience for keeping the seat map visually current even when nobody
is actively trying to book those specific seats.

**Production note**: this lazy-sweep approach is appropriate for one
process. If CineBook ever runs multiple instances, move to a scheduled
worker (or Redis key TTL + pub/sub) so expiry doesn't depend on someone
hitting that showtime — see docs/ARCHITECTURE.md's migration table.

## Booking state machine

```
DRAFT ──────────► PAYMENT_PENDING ──────────► CONFIRMED ──► CANCELLED
  │                     │      ▲
  ├──► CANCELLED         ├──► PAYMENT_FAILED ──┘ (retry -> PAYMENT_PENDING)
  └──► EXPIRED           └──► CANCELLED
                          └──► EXPIRED
```

Enforced centrally by `assertBookingTransition` (`src/lib/booking/state-machine.ts`)
against the table in `src/lib/enums.ts` (`BOOKING_TRANSITIONS`). No code
path writes `Booking.status` without going through this guard, so an
illegal jump (e.g. `DRAFT` straight to `CONFIRMED`) throws `INVALID_BOOKING`
instead of silently corrupting state.

- `createBookingFromHold` creates a `Booking` in `DRAFT` from an `ACTIVE`,
  non-expired `SeatHold`, with a server-computed pricing snapshot.
  **Idempotent**: `Booking.holdId` is `@unique`, so calling it twice for
  the same hold (double-click, browser back button, retried request)
  returns the existing booking instead of creating a second one.
- `payForBooking` transitions `DRAFT`/`PAYMENT_FAILED` → `PAYMENT_PENDING`,
  charges via the `PaymentProvider`, then finalizes to `CONFIRMED` or
  `PAYMENT_FAILED`. See below for its idempotency guarantee.
- `cancelBooking` only allows `CONFIRMED` → `CANCELLED` (or other
  currently-open states), releasing the booking's seats back to
  `AVAILABLE` in the same transaction.

## Payment idempotency

`payForBooking` accepts an `idempotencyKey`. `Payment.idempotencyKey` is a
unique DB column. Finalizing a payment uses the same conditional-update
pattern as seat holds:

```ts
const claimed = await tx.payment.updateMany({
  where: { id: paymentId, status: "PENDING" },
  data: { status: chargeStatus, ... },
});
if (claimed.count === 0) {
  // another concurrent call already finalized this exact payment attempt —
  // return its recorded outcome instead of re-processing.
}
```

Getting the *creation* half of this right (claiming an `idempotencyKey`
for the first time) took three iterations, each one caught by the
automated test suite — worth documenting in full because each fix looked
correct in isolation and only failed under a specific, real condition:

**Attempt 1 — check-then-create.** The idempotency lookup ran *before* the
transaction that creates the `Payment` row. Two concurrent calls with the
same key could both observe "no Payment yet" (the race window), both
proceed, and the second would read a `Booking` the first had, by then,
already moved to `CONFIRMED` — throwing `INVALID_BOOKING` instead of
returning the shared successful outcome.

**Attempt 2 — move the check inside the transaction.** Moving the
`Payment` lookup *inside* the same transaction that creates the row fixed
the test suite — because at the time, local tests ran against SQLite with
`connection_limit=1`, which forces every transaction to run to full
completion, one at a time, on a single connection. That serialization
made the two "concurrent" calls effectively sequential, which hid the
fact that the fix was still a plain `findUnique` + `create` pair, not an
atomic operation.

**Attempt 3 — the actual fix, found migrating to PostgreSQL.** Running
the identical test suite against real Postgres concurrency (the intended
production database, with proper multi-connection concurrent
transactions) immediately reproduced a raw unique-constraint violation on
`idempotencyKey` — proof that attempt 2 was never actually race-free, only
accidentally protected by a SQLite quirk. The fix has two parts:

1. **Claim the idempotency key as its own standalone statement**, not
   nested inside a larger transaction:
   ```ts
   let payment;
   try {
     payment = await prisma.payment.create({ data: { ... } });
   } catch (err) {
     if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
       payment = await prisma.payment.findUniqueOrThrow({ where: { idempotencyKey } });
     } else {
       throw err;
     }
   }
   ```
   A `tx.payment.upsert(...)` was tried in between attempts 2 and 3,
   expecting Prisma to compile it to a single atomic `INSERT ... ON
   CONFLICT` — but it still surfaced the same unique-constraint error
   under real concurrent load, disproving that assumption for this query
   shape/Prisma version. This matters structurally too: had the `upsert`
   (or a caught `create`) been nested inside a larger `$transaction`,
   catching the error and continuing on the same transaction handle
   *would not have worked* — Postgres aborts an entire transaction after
   any statement error (no partial rollback without an explicit
   `SAVEPOINT`), so every subsequent query on that transaction would also
   fail. Running the claim as an independent, non-transactional statement
   sidesteps this entirely: a `P2002` there is a normal, isolated,
   catchable JavaScript error.
2. **Everything after the claim (validating the hold, transitioning the
   booking to `PAYMENT_PENDING`) runs in its own separate transaction**,
   keyed off a fresh read of the booking and using the same
   conditional-`updateMany` pattern used everywhere else in this file —
   so a concurrent duplicate call that already performed the transition
   sees a harmless no-op (0 rows matched) instead of re-validating stale
   state.

The lesson generalizes beyond this one function: **a local SQLite dev
database configured to avoid lock errors can accidentally prove a
concurrency fix "correct" by serializing away the exact race it's
supposed to handle.** The automated test suite for this booking engine is
only a real guarantee when it's run against the same database engine and
concurrency model as production — which is why this fix was verified by
running the full suite (36 tests, including the seat-hold concurrency
test) against real PostgreSQL, three times in a row, specifically to rule
out the kind of intermittent race a single green run can't. See
`tests/integration/booking-engine.test.ts`'s "is idempotent under a
duplicated request" test.

Net effect: a retried payment confirmation (network retry, double-click,
crash-and-resume) can **never** create a second `Payment`, a second
`Booking`, or a second `Ticket` for the same attempt.

## What the automated tests actually prove

`tests/integration/booking-engine.test.ts`, "the concurrency guarantee
(Gate 6)":

> 12 simultaneous `createSeatHold` calls for the same single seat → exactly
> 1 succeeds, the other 11 receive `SEAT_UNAVAILABLE`.

Plus: hold expiry/reclaim, idempotent booking creation, retry-after-decline,
concurrent duplicate payment confirmation, ownership checks (IDOR), and
`cancelBooking` seat release. `tests/integration/api-holds-contract.test.ts`
additionally drives the real HTTP Route Handlers (not just the engine
functions directly) — this is the test that caught a separate real bug
where the seat map UI sent `ShowtimeSeat.id` values where the engine
expected `Seat.id` values; see that file's header comment.

**What is not covered**: true multi-process concurrency (SQLite is
single-process here) and a real browser-driven E2E run of two simultaneous
tabs racing for a seat (verified manually once during development, not as
an automated Playwright suite — see [TESTING.md](./TESTING.md) for the
honest scope of the automated suite).
