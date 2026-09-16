/**
 * Centralized, validated environment configuration. Import this instead of
 * reading `process.env` directly so every consumer gets the same parsed,
 * defaulted values and startup fails fast on misconfiguration.
 *
 * `import "server-only"` makes an accidental client-component import of this
 * module (or anything that transitively imports it) a build-time error
 * instead of a runtime crash in the browser, where none of these env vars
 * exist. This exact mistake happened once already — see the git history of
 * src/lib/pricing.ts, which used to import this file.
 */
import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  SEAT_HOLD_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  BOOKING_FEE_CENTS: z.coerce.number().int().nonnegative().default(150),
  TAX_RATE: z.coerce.number().nonnegative().default(0.08),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

export const config = parsed.data;

export const pricingConfig = {
  bookingFeeCents: config.BOOKING_FEE_CENTS,
  taxRate: config.TAX_RATE,
};

export const bookingEngineConfig = {
  seatHoldTtlSeconds: config.SEAT_HOLD_TTL_SECONDS,
};

export const authConfig = {
  secret: config.AUTH_SECRET,
  sessionTtlSeconds: config.SESSION_TTL_SECONDS,
};
