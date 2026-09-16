// Must match tests/prepare-test-db.ts's default (or TEST_DATABASE_URL, if
// set) — that script provisions this exact database before tests run.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://cinebook:cinebook@localhost:5433/cinebook_test";
process.env.AUTH_SECRET = "test-only-secret-not-for-prod-0123456789abcdef";
process.env.SESSION_TTL_SECONDS = "604800";
process.env.SEAT_HOLD_TTL_SECONDS = "300";
process.env.BOOKING_FEE_CENTS = "150";
process.env.TAX_RATE = "0.08";
process.env.APP_BASE_URL = "http://localhost:3000";
