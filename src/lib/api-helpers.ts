import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Wraps a Route Handler so every thrown error becomes a stable
 * `{ code, message, details }` JSON response instead of a leaked stack
 * trace. `AppError` → its own code/status. Zod validation errors →
 * VALIDATION_ERROR/400. Anything else → INTERNAL_ERROR/500, logged with
 * full detail server-side only.
 */
export function apiHandler<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (err) {
      if (isAppError(err)) {
        return NextResponse.json(err.toJSON(), { status: err.httpStatus });
      }
      if (err instanceof ZodError) {
        const validationError = new AppError("VALIDATION_ERROR", "Invalid request data.", err.flatten());
        return NextResponse.json(validationError.toJSON(), { status: validationError.httpStatus });
      }
      logger.error("APPLICATION_ERROR", {
        path: request.nextUrl.pathname,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      const internal = new AppError("INTERNAL_ERROR", "Something went wrong. Please try again.");
      return NextResponse.json(internal.toJSON(), { status: internal.httpStatus });
    }
  };
}

/** Best-effort client identifier for local rate limiting (no trusted proxy chain in dev). */
export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
