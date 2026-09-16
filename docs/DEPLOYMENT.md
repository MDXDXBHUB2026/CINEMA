# Deployment

CineBook's current target is **local development only**. This document
covers running it locally and what would need to change to deploy it for
real users.

## Running locally

See the README for full setup. Summary:

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

## Moving from SQLite to PostgreSQL

The schema deliberately avoids Postgres-only features (no native `enum`,
no `Decimal`) so this is a configuration change, not a schema rewrite:

1. Install PostgreSQL locally, or `docker compose up -d` (see
   `docker-compose.yml` at the repo root — starts a `postgres:16-alpine`
   container with a `cinebook`/`cinebook` user/db).
2. In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "sqlite"     // change to "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. In `.env`: `DATABASE_URL="postgresql://cinebook:cinebook@localhost:5432/cinebook"`
4. `npm run db:migrate` (re-creates migrations against the new provider —
   Prisma migration SQL is provider-specific, so this generates a fresh
   migration history rather than replaying the SQLite one).
5. `npm run db:seed`.

## What's needed before a real production deployment

This app was explicitly scoped as local-first; treat this as a checklist,
not a claim that it's ready today:

1. **Database**: managed PostgreSQL (RDS, Neon, Supabase, etc.) instead of
   local SQLite/Docker Postgres.
2. **Payments**: implement a real `PaymentProvider` (e.g. Stripe) — the
   booking domain (`src/lib/booking/engine.ts`) already only depends on
   the `PaymentProvider` interface (`src/lib/payments/provider.ts`), so
   this is additive, not a rewrite. Never let card data touch this
   server directly — use the provider's hosted/tokenized flow.
3. **Sessions**: add server-side session revocation (see
   docs/SECURITY.md).
4. **Rate limiting**: move `src/lib/rate-limit.ts` to a shared store
   (Redis) so limits hold across multiple app instances.
5. **Seat-hold expiry**: the current lazy-sweep-on-read approach
   (docs/BOOKING_ENGINE.md) is correct for one process; add a scheduled
   worker or Redis TTL mechanism if running more than one instance, so
   expiry isn't dependent on someone hitting that showtime.
6. **Static assets**: move `public/posters` and `public/backdrops` (or
   real licensed movie art, once available) to object storage (S3/R2) + a
   CDN/image pipeline.
7. **Observability**: ship the structured JSON logs
   (`src/lib/logger.ts`) to a real sink (Datadog/CloudWatch/etc.) and add
   request correlation ids.
8. **Security hardening**: see docs/SECURITY.md's "Before production"
   list (CSP, secrets manager, dependency audit, RBAC scoping).
9. **Hosting**: the app is a standard Next.js 16 app (`next build` /
   `next start`) — deployable to Vercel, a container platform, or a Node
   host with no code changes beyond the above. `next.config.ts` sets
   baseline security headers already.
10. **CI**: wire `npm run lint`, the TypeScript check (part of
    `next build`), and `npm test` into a CI pipeline (GitHub Actions,
    etc.) so these gates run on every PR, not just manually.

## Environment variables

See `.env.example` for the full list with inline documentation. All are
validated at startup by `src/lib/config.ts` (Zod) — a missing/invalid
value fails fast with a clear error rather than an obscure runtime bug.
