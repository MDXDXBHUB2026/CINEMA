# Deployment

CineBook runs on PostgreSQL in both environments — local development
(via `docker-compose.yml`) and Render production (a managed Postgres
instance). This document covers both, and is explicit about which
instructions are local-only vs Render-only.

## Local development

```bash
docker compose up -d          # starts Postgres on localhost:5433
npm install
cp .env.example .env          # DATABASE_URL already points at the container above
npm run db:migrate            # applies the migration baseline (creates tables)
npm run db:seed               # realistic seed data — destructive, local only
npm run dev
```

`docker-compose.yml` uses host port **5433**, not Postgres's default 5432,
specifically so it doesn't collide with any other local Postgres instance
you might already be running. See `.env.example` for every variable,
documented inline.

## Render production deployment

### 1. Prerequisites (you've already done this)

- A Render PostgreSQL database created.
- A Render Web Service created for this repo, with `DATABASE_URL` and
  `AUTH_SECRET` set from the Render dashboard (pointing at that database
  and a real generated secret, respectively — never the `.env.example`
  placeholder values).

### 2. Render service commands

Set these exactly in the Render dashboard (Settings → Build & Deploy):

| Setting | Value |
|---|---|
| **Build Command** | `npm ci && npm run build` |
| **Pre-Deploy Command** | `npm run db:deploy` |
| **Start Command** | `npm run start` |

What each does:

- **Build Command** — `npm ci` installs exact locked dependencies;
  `npm run build` runs `prisma generate && next build` (the Prisma Client
  must be (re)generated against the current schema before `next build`,
  since Server Components import it at build time).
- **Pre-Deploy Command** — Render runs this *after* the build succeeds but
  *before* traffic is switched to the new deploy. `npm run db:deploy` runs
  `prisma migrate deploy`: applies any pending migrations from
  `prisma/migrations/` non-interactively, and does **not** create new
  migrations or reset anything. This is how database migrations happen
  before the application starts serving the new version — satisfying the
  "migrate before start" requirement without risking a race between an
  old app instance and a mid-migration schema.
- **Start Command** — `npm run start` runs `next start`, which binds to
  whatever port Render provides via the `PORT` environment variable
  automatically (Next.js's CLI reads `process.env.PORT` natively — nothing
  in this codebase hardcodes port 3000 for production; see
  `package.json` and `next.config.ts`).

### ⚠️ Never add `npm run db:seed` to any Render command

`prisma/seed.ts` **deletes all existing data** before reseeding (see its
own top-of-file comment) — it exists for populating a fresh local/demo
database, not as part of a deploy pipeline. Only run it manually, once,
against Render via the Render Shell (`render shell` or the dashboard's
Shell tab) if you specifically want the fictional demo catalog
(movies/cinemas/showtimes) seeded there, and never on a database that
already holds real customer bookings.

### 3. Required Render environment variables

Already configured per your setup, listed here for completeness — see
`.env.example` for full descriptions of each:

| Variable | Source |
|---|---|
| `DATABASE_URL` | Render PostgreSQL connection string (from the Render database, or auto-linked) |
| `AUTH_SECRET` | Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` — a real random value, set directly in Render, never committed |
| `NODE_ENV` | `production` |
| `APP_BASE_URL` | Your Render service's public URL (e.g. `https://cinebook.onrender.com`, or reference Render's own `RENDER_EXTERNAL_URL`) |
| `SESSION_TTL_SECONDS` | `604800` (or your preferred value — same meaning as local) |
| `SEAT_HOLD_TTL_SECONDS` | `300` (or your preferred value) |
| `BOOKING_FEE_CENTS` | `150` (or your preferred value) |
| `TAX_RATE` | `0.08` (or your preferred value) |

`PORT` is provided by Render automatically — do not set it yourself.

All of these are validated at startup by `src/lib/config.ts` (Zod) exactly
as in local development — a missing or malformed value fails the boot
with a clear error rather than an obscure runtime bug. This validation is
unchanged and was not weakened for this migration.

### 4. Why the old SQLite migrations couldn't just be pointed at Postgres

The original `prisma/migrations/` history was generated against SQLite,
whose migration SQL uses SQLite-specific DDL that isn't valid PostgreSQL.
Rather than risk applying incompatible SQL against the Render database,
that history was replaced with a single clean baseline migration
generated directly against the `provider = "postgresql"` schema (`prisma
migrate dev --name init_postgresql`, applied and verified against a local
Postgres instance before being committed). It contains every table,
foreign key, and — critically — the three unique constraints that enforce
booking integrity: `ShowtimeSeat(showtimeId, seatId)`, `Booking.holdId`,
and `Payment.idempotencyKey`. `prisma migrate deploy` (the Pre-Deploy
Command above) applies this baseline to a fresh Render database on first
deploy, and any future migration on top of it normally from then on.

### 5. What changed for PostgreSQL compatibility beyond the provider line

- `src/lib/catalog.ts`'s movie search now passes `mode: "insensitive"` to
  Prisma's `contains` filter. SQLite's `LIKE` is case-insensitive by
  default; PostgreSQL's is case-sensitive unless told otherwise — this
  preserves the original case-insensitive search behavior.
- The booking/payment engine's idempotency logic
  (`src/lib/booking/engine.ts`) needed a real fix, not just a provider
  swap: SQLite's local dev connection was forced through
  `connection_limit=1`, which fully serialized transactions and
  incidentally masked a race in the original "check, then create" payment
  idempotency logic. Running the real test suite against genuine Postgres
  concurrency surfaced it immediately (a unique-constraint violation
  instead of the intended idempotent behavior) — see
  [BOOKING_ENGINE.md](./BOOKING_ENGINE.md)'s "Payment idempotency" section
  for the full story and the fix. This was found and fixed as part of
  this migration, with the full test suite (36 tests, including the
  concurrency test) re-verified passing against real Postgres, run
  multiple times to confirm no flakiness.
- SQLite's `?connection_limit=1` query-string workaround is gone —
  PostgreSQL's native connection pooling and row-level locking handle
  concurrent seat holds correctly without it (this was always documented
  as a SQLite-only quirk; see `docs/BOOKING_ENGINE.md`).

## What's still needed before a real production launch

This checklist is about production-*readiness* beyond "it deploys and
runs" — it was true before this migration and remains true after it:

1. **Payments**: implement a real `PaymentProvider` (e.g. Stripe) — the
   booking domain (`src/lib/booking/engine.ts`) already only depends on
   the `PaymentProvider` interface (`src/lib/payments/provider.ts`), so
   this is additive, not a rewrite.
2. **Sessions**: add server-side session revocation (see
   docs/SECURITY.md) — logout currently only clears the cookie.
3. **Rate limiting**: move `src/lib/rate-limit.ts` to a shared store
   (Redis) — the current in-memory limiter doesn't coordinate across
   multiple Render instances if you scale beyond one.
4. **Seat-hold expiry**: the lazy-sweep-on-read approach
   (docs/BOOKING_ENGINE.md) is correct for any number of instances talking
   to the same Postgres database (it's a DB-level guarantee, not
   process-local) — no change needed here even at scale, unlike the
   rate limiter above.
5. **Static assets**: move `public/posters`/`public/backdrops` to object
   storage + a CDN once real licensed art replaces the generated
   placeholders.
6. **Observability**: ship the structured JSON logs
   (`src/lib/logger.ts`) to a real sink and add request correlation ids.
7. **Security hardening**: see docs/SECURITY.md's "Before production"
   list (CSP, dependency audit, RBAC scoping).
8. **CI**: wire `npm run lint`, `npm run typecheck`, and `npm test`
   (against a Postgres service container) into a CI pipeline so these
   gates run on every PR, not just manually before a deploy.
