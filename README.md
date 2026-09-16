# CineBook

A full-stack cinema ticket-booking platform: browse movies, pick seats on
a live seat map, check out with a simulated payment, and get a digital
e-ticket with a QR code — built to run entirely on a local development
machine, with a UAE-flavored catalog (Dubai/Abu Dhabi cinemas, multi-
language films, AED pricing).

> Payments are **simulated**. No real card is ever collected or charged.

## Features

- Movie browse/search, cinema listings, multi-language "now showing" /
  "coming soon" catalog
- A flagship, accessible seat map: keyboard/screen-reader friendly, never
  color-only (icons distinguish available/selected/held/booked/accessible)
- Race-condition-safe seat holds with a live, server-driven countdown —
  see [docs/BOOKING_ENGINE.md](./docs/BOOKING_ENGINE.md)
- Server-authoritative pricing (subtotal/fee/tax/total), snapshotted onto
  each booking so later pricing changes never rewrite history
- Idempotent simulated payments (success/declined/timeout/cancelled),
  safe to retry without double-charging or double-booking
- Printable digital e-ticket with a locally-generated QR code
- Account/booking history with self-service cancellation
- Role-based admin console (dashboard metrics, movie/showtime creation,
  bookings, audit log) for `STAFF` / `CINEMA_MANAGER` / `ADMIN`
- Structured logging and an administrative audit trail

## Architecture

A Next.js 16 modular monolith — see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
for the full breakdown (with a diagram) and [docs/BOOKING_ENGINE.md](./docs/BOOKING_ENGINE.md)
for how double-booking is prevented under concurrency.

## Technology stack

- **Framework**: Next.js 16 (App Router, Server Components, Server Actions, Route Handlers), React 19, TypeScript (strict)
- **Styling**: Tailwind CSS v4, a small hand-rolled design system (`class-variance-authority`), `recharts` for the admin dashboard
- **Database**: SQLite locally via Prisma 6 (PostgreSQL-ready — see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md))
- **Auth**: bcrypt password hashing + signed JWT session cookies (`jose`)
- **Validation**: Zod at every mutation boundary
- **Testing**: Vitest (unit + integration, including a real concurrency test)
- **QR codes**: `qrcode` (generated locally, no network calls)

## Prerequisites

- Node.js 20+ and npm
- (Optional) Docker, only if you want to run PostgreSQL locally instead of the SQLite default

## Installation

```bash
npm install
cp .env.example .env
```

## Environment configuration

Every variable is documented inline in `.env.example` and validated at
startup (`src/lib/config.ts`). The defaults work out of the box for local
development — you only need to change `AUTH_SECRET` if you want a
non-default value (the example one is clearly marked insecure/dev-only).

## Database setup

```bash
npm run db:migrate   # applies migrations, creates prisma/dev.db (SQLite)
npm run db:seed      # realistic seed data (see below)
```

To use PostgreSQL instead, see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md#moving-from-sqlite-to-postgresql).

## Running in development

```bash
npm run dev
```

Open <http://localhost:3000>.

## Running tests

```bash
npm test          # unit + integration + concurrency tests (provisions a throwaway test DB first)
npm run test:watch
npm run lint
npm run typecheck
```

See [docs/TESTING.md](./docs/TESTING.md) for exactly what's covered
(including the two real bugs the test suite caught) and what isn't.

## Production build

```bash
npm run build
npm run start
```

## Default development accounts

All seeded with password `Password123`:

| Role | Email |
|---|---|
| ADMIN | admin@cinebook.dev |
| CINEMA_MANAGER | manager@cinebook.dev |
| STAFF | staff@cinebook.dev |
| CUSTOMER | alice@example.com / bob@example.com / carla@example.com |

These are fictional development-only accounts, not real credentials.

## Simulated payment behavior

The checkout page discloses that no real transaction occurs. A "Pay now"
button simulates a successful charge; a "Show test payment outcomes"
toggle lets you exercise declined/timeout/cancelled paths. See
`src/lib/payments/` — the booking domain talks only to a `PaymentProvider`
interface, so a real provider (e.g. Stripe) can be swapped in later
without touching booking logic.

## Project structure

```
prisma/           schema, migrations, seed script, generated art
src/app/          routes (pages, Server Actions, Route Handlers)
src/components/   ui/ (design system primitives), cinema/ (feature components), admin/
src/lib/          domain logic: booking/, payments/, auth/, catalog.ts, pricing.ts, config.ts, ...
tests/            unit/, integration/, fixtures, and a stub for testing "server-only"-guarded code
docs/             architecture, booking engine, security, testing, deployment
```

## Security notes

See [docs/SECURITY.md](./docs/SECURITY.md) for the full threat model,
mitigations, and — importantly — the honestly-documented remaining
limitations of a local development build.

## Known limitations

- RBAC for `STAFF`/`CINEMA_MANAGER` is not yet scoped per-cinema in the
  admin console (see docs/ARCHITECTURE.md).
- No automated browser (Playwright/Cypress) E2E suite; the full customer
  journey was verified manually in a real browser during development
  (see docs/TESTING.md).
- Mobile/tablet responsiveness is implemented via Tailwind breakpoints and
  a dedicated mobile nav, but wasn't re-verified with live narrow-viewport
  screenshots in this environment.
- Session logout only clears the cookie (no server-side revocation list).
- No Content-Security-Policy header yet (see docs/SECURITY.md).

## Future production deployment

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the full checklist
(managed Postgres, a real payment provider, shared-store rate limiting,
CSP, secrets management, CI, etc.).
