import path from "node:path";

process.env.DATABASE_URL = `file:${path.join(__dirname, "test.db")}?connection_limit=1`;
process.env.AUTH_SECRET = "test-only-secret-not-for-prod-0123456789abcdef";
process.env.SESSION_TTL_SECONDS = "604800";
process.env.SEAT_HOLD_TTL_SECONDS = "300";
process.env.BOOKING_FEE_CENTS = "150";
process.env.TAX_RATE = "0.08";
process.env.APP_BASE_URL = "http://localhost:3000";
