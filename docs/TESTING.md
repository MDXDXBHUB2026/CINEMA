# Testing

An honest account of what is and isn't covered — see the final completion
report for the exact numbers from the last run.

## What's automated (Vitest)

- **Unit** (`tests/unit/`): pricing math (fee/tax/rounding/discount
  clamping), the booking state machine (every legal transition allowed,
  illegal ones rejected with the right error code), id generator
  uniqueness/format, and RBAC helpers (including an explicit IDOR-guard
  test).
- **Integration** (`tests/integration/booking-engine.test.ts`): the
  booking engine against a real PostgreSQL database (`cinebook_test`,
  provisioned fresh — schema pushed and every table truncated — before
  each `npm test` run; see `tests/prepare-test-db.ts`) — seat holds,
  expiry/reclaim, idempotent booking creation, payment success/decline/
  retry, payment idempotency under a genuinely concurrent duplicate
  request, ownership checks, and `cancelBooking` seat release. This suite
  used to run against SQLite; migrating it to real Postgres surfaced a
  genuine concurrency bug in the payment idempotency logic that SQLite's
  forced single-connection serialization had been silently masking — see
  [BOOKING_ENGINE.md](./BOOKING_ENGINE.md#payment-idempotency) for the
  full story. The suite was re-run multiple times in a row against
  Postgres after the fix specifically to rule out flakiness, not just
  once.
- **Concurrency (Gate 6)**: 12 simultaneous `createSeatHold` calls for one
  seat → exactly 1 succeeds, 11 get `SEAT_UNAVAILABLE`; a follow-up test
  confirms a `CONFIRMED` seat can't later be claimed by anyone.
- **HTTP contract** (`tests/integration/api-holds-contract.test.ts`):
  drives the actual Next.js Route Handlers (real Zod validation, real
  engine, only auth mocked) with the exact payload shape the browser
  sends. This is the class of test that caught a real bug (see below) that
  the engine-level tests couldn't, because they called the engine function
  directly and skipped the HTTP boundary entirely.

Run: `npm test` (runs `pretest` first, which provisions a fresh
`tests/test.db` via `prisma db push`).

## What's verified manually, not automated

A full customer journey (login → browse → movie detail → showtime → seat
selection → reserve → checkout → simulated payment → confirmation →
e-ticket with QR code) was driven end-to-end in a real Chrome browser
against the actual dev server during development. This is how two real
bugs were found:

1. A client/server config leak (`src/lib/pricing.ts` transitively pulled
   server-only env parsing into the browser bundle via a client
   component import) that no unit or integration test caught, because
   none of them render actual React components in a browser.
2. A `Seat.id` vs `ShowtimeSeat.id` contract mismatch between the seat map
   UI and the booking engine, invisible to engine-level tests because they
   call `createSeatHold` directly with the "correct" id type by
   construction. Closed by adding the HTTP-contract test above.

Also manually verified: RBAC redirect (unauthenticated → `/login`,
customer blocked from `/admin`), admin dashboard metrics/charts, booking
history and self-service cancellation, and the print-friendly ticket view.

**Not covered by any automated test**: a real multi-browser-tab race (the
concurrency test simulates this via `Promise.allSettled` against the
engine/HTTP layer in one process — a legitimate and standard way to prove
the database-level guarantee, but it is not literally two browser windows),
and there is no Playwright/Cypress browser-automation suite in this
repository. Given the time budget for this build, effort went into (a) the
concurrency/idempotency guarantees, which are the correctness-critical
path, and (b) one thorough manual pass of the real UI, rather than into
building and maintaining a separate E2E browser test harness. If this
project continues, `@playwright/test` covering the golden path plus the
error paths listed in the master spec (expired hold, payment decline,
double-booking attempt, mobile viewport) would be the natural next
investment.

## Quality gates run for this build

| Gate | Result |
|---|---|
| Fresh `npm install` | ✅ |
| `npm run db:migrate` + `npm run db:seed` | ✅ |
| `npm run lint` | ✅ clean |
| TypeScript (`next build`'s type-check pass) | ✅ clean |
| `npm test` (unit + integration + concurrency) | ✅ all passing |
| `npm run build` (production build, all routes) | ✅ |
| Manual browser walkthrough (desktop viewport) | ✅ full booking journey completed |
| Mobile/tablet viewport screenshots | ⚠️ not obtained — the browser automation tool's window-resize did not take effect in this environment; responsiveness is implemented via Tailwind breakpoints and a dedicated mobile nav component, but not visually re-verified at narrow widths. Recommend a manual check in DevTools device mode before considering this gate closed. |
