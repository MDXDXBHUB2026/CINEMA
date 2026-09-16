# Security

Threat model, mitigations, and honest local-dev limitations for CineBook.
This is a local development build; read the "Remaining limitations" and
"Before production" sections before treating this as production-ready.

## Trust boundaries

```
Browser (untrusted) → Route Handlers / Server Actions (validation + authz) → Domain layer → Prisma → DB
```

Nothing from the browser is trusted past the Route Handler/Server Action
boundary: every mutation re-validates with Zod and re-checks the session,
regardless of what the UI already prevented client-side.

## Mitigations by OWASP-style category

- **Authentication**: bcrypt (12 rounds) password hashing; JWT (HS256)
  session cookie, `httpOnly` + `sameSite=lax` + `secure` in production.
  Coarse rate limiting on login/register (`src/lib/rate-limit.ts`), keyed
  by IP+email so an attacker can't lock out a real user's account, only
  slow repeated attempts from one origin. `LoginAttempt` rows are recorded
  for audit.
- **Authorization / IDOR / BOLA**: `src/lib/auth/rbac.ts`'s
  `assertOwnsResourceOrStaff` is called before returning any booking or
  ticket by id — a customer can never fetch another customer's booking by
  guessing/incrementing an id. Covered by a unit test and exercised in the
  booking/ticket/checkout pages and the `GET /api/bookings/:id` route.
- **SQL injection**: not applicable in the direct sense — all queries go
  through Prisma's parameterized query builder; no raw SQL string
  concatenation exists in this codebase.
- **XSS**: React escapes all rendered content by default; no
  `dangerouslySetInnerHTML` is used anywhere in the app. Locally-generated
  SVG art (`prisma/seed-assets.ts`) escapes movie titles before embedding
  them in `<text>` elements.
- **CSRF**: Server Actions and same-origin `fetch` calls from the app's own
  client components are the only ways to reach mutating endpoints;
  `sameSite=lax` on the session cookie blocks it being sent on
  cross-site top-level navigations that would otherwise trigger a
  state-changing GET. No separate CSRF token is issued — acceptable for
  this cookie configuration, but see "Before production."
- **Mass assignment**: every write path uses an explicit Zod schema
  (`src/lib/validation.ts`) that whitelists fields — there is no
  `data: req.body` passthrough anywhere.
- **Sensitive data exposure**: no raw card data is ever collected, stored,
  or logged (`SimulatedPaymentProvider` never sees or persists card
  details — there's no card input field in the UI at all). QR ticket
  payloads carry only an opaque `ticketCode`, never the customer's name,
  email, or booking total.
- **Secrets**: `.env` is git-ignored; `.env.example` documents every
  variable without real values. `AUTH_SECRET` in `.env.example` is
  clearly labeled dev-only/insecure.
- **Logging**: structured JSON logs (`src/lib/logger.ts`) for a fixed
  event vocabulary; passwords, tokens, and full payment details are never
  logged (only `simulatedOutcome`/status strings for payments).
- **Error leakage**: `src/lib/api-helpers.ts`'s `apiHandler` translates any
  unexpected error to a generic `INTERNAL_ERROR` before it reaches the
  client, logging the real detail server-side only. `src/app/error.tsx`
  does the equivalent for render errors — confirmed manually: a real
  bug during development surfaced as "Something went wrong" in the
  browser with zero stack trace, while the actual message was in the
  server log.
- **Secure headers**: `next.config.ts` sets `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, and a restrictive
  `Permissions-Policy`. No Content-Security-Policy is set — see below.
- **Rate limiting**: applied to login, register, seat-hold creation, and
  payment confirmation. In-memory, single-process (see limitations).
- **Unsafe redirects**: the post-login `?next=` redirect target is
  validated to start with `/` and not `//` before use (open-redirect
  guard) in `src/app/actions/auth.ts`.
- **Audit trail**: administrative actions (movie/showtime creation) are
  recorded to `AuditEvent` with actor, action, entity, and metadata,
  viewable at `/admin/audit` (ADMIN only).

## Remaining local-development limitations

Documented deliberately, not silently shipped:

- **No CSP**: Next's dev/build pipeline uses inline scripts/styles that a
  strict CSP would break without a nonce wired through every response;
  not implemented here. Before production, add a nonce-based CSP via
  middleware/`proxy.ts`.
- **Rate limiting is per-process, in-memory**: resets on restart, doesn't
  coordinate across multiple instances. Fine for one local dev server;
  would need a shared store (Redis) behind a load balancer.
- **No session revocation list**: logout only clears the cookie; a copied
  JWT remains valid until it expires (7 days by default). No "log out all
  devices" capability.
- **RBAC scoping is coarse**: `CINEMA_MANAGER`/`STAFF` can currently see
  all cinemas' bookings/showtimes in the admin console, not just their
  assigned cinema (the `CinemaStaff` table exists for this but isn't yet
  enforced in every admin query) — see docs/ARCHITECTURE.md.
- **Dependency risk**: `npm audit` reports high-severity advisories in
  Prisma's own tooling dependencies (`@prisma/config` → `deepmerge-ts`
  stack-exhaustion; also present via `mysql2`, which this project doesn't
  even use — a transitive dep of Prisma's multi-driver CLI). These are
  build/CLI-time only, not shipped to the running app's runtime bundle,
  and are the same on the latest stable Prisma release as of this build.
  Re-run `npm audit` before shipping and re-evaluate.
- **No CAPTCHA/bot detection** on registration — combined with the rate
  limiter, acceptable for a local demo, not for a public deployment.
- **SVG assets are user-controllable in the sense that** movie titles are
  escaped before embedding, but this generation only ever runs from the
  trusted seed/admin-create path, never from unauthenticated input.

## Before production

1. Add a real CSP (nonce-based) and re-verify the app still renders.
2. Move rate limiting to a shared store (Redis).
3. Add session revocation (server-side session table or short-lived
   access token + refresh token pair).
4. Enforce `CinemaStaff` scoping in every admin query, not just the
   `CinemaStaff` table's existence.
5. Rotate `AUTH_SECRET` to a real random value (never reuse the
   `.env.example` value) and inject via a secrets manager, not a plain
   `.env` file, in any shared environment.
6. Re-run `npm audit` / `npm audit fix` against whatever Prisma version is
   current at deploy time.
7. Add a real payment provider (Stripe) behind the existing
   `PaymentProvider` interface — see docs/ARCHITECTURE.md.
