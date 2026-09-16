/**
 * Structured application errors. API routes/server actions catch these and
 * translate them into a stable `{ code, message }` JSON shape — never a raw
 * stack trace — per docs/SECURITY.md's error-leakage rule.
 */

export const ERROR_CODES = [
  "SEAT_UNAVAILABLE",
  "SEAT_HOLD_EXPIRED",
  "SHOWTIME_NOT_AVAILABLE",
  "INVALID_BOOKING",
  "PAYMENT_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "RATE_LIMITED",
  "CONFLICT",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  SEAT_UNAVAILABLE: 409,
  SEAT_HOLD_EXPIRED: 410,
  SHOWTIME_NOT_AVAILABLE: 409,
  INVALID_BOOKING: 400,
  PAYMENT_FAILED: 402,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = STATUS_BY_CODE[code];
    this.details = details;
  }

  toJSON() {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
