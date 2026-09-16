/**
 * Structured JSON logging for development observability.
 *
 * Rules (see docs/SECURITY.md):
 *  - never log passwords, tokens, session secrets, or full payment details
 *  - always include an event name from `LogEvent` so logs are greppable
 *  - a `requestId` should be threaded through request-scoped calls when
 *    available (see `withRequestId` in src/lib/request-context.ts)
 */

export const LOG_EVENTS = [
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_FAILURE",
  "AUTH_REGISTER",
  "AUTH_LOGOUT",
  "SEAT_HOLD_CREATED",
  "SEAT_HOLD_EXPIRED",
  "SEAT_HOLD_RELEASED",
  "BOOKING_CREATED",
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
  "PAYMENT_ATTEMPTED",
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "ADMIN_ACTION",
  "RATE_LIMITED",
  "APPLICATION_ERROR",
] as const;
export type LogEvent = (typeof LOG_EVENTS)[number];

type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, event: LogEvent, fields: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: LogEvent, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: LogEvent, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: LogEvent, fields?: Record<string, unknown>) => write("error", event, fields),
};
