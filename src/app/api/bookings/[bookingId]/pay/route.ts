import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, getClientIp } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth/cookies";
import { requireUser } from "@/lib/auth/rbac";
import { payForBooking } from "@/lib/booking/engine";
import { generateIdempotencyKey } from "@/lib/ids";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { SIMULATED_OUTCOMES } from "@/lib/payments/provider";

const bodySchema = z.object({
  idempotencyKey: z.string().min(1).optional(),
  simulateOutcome: z.enum(SIMULATED_OUTCOMES).default("SUCCESS"),
});

export const POST = apiHandler(async (request: NextRequest, ctx: { params: Promise<{ bookingId: string }> }) => {
  const user = requireUser(await getCurrentUser());
  const { bookingId } = await ctx.params;

  const limited = rateLimit(`pay:${getClientIp(request)}:${user.sub}`, 10, 60 * 1000);
  if (!limited.allowed) {
    throw new AppError("RATE_LIMITED", "Too many payment attempts. Please wait a moment.");
  }

  const body = bodySchema.parse(await request.json().catch(() => ({})));
  const idempotencyKey = body.idempotencyKey ?? generateIdempotencyKey();

  const result = await payForBooking({
    userId: user.sub,
    bookingId,
    idempotencyKey,
    simulateOutcome: body.simulateOutcome,
  });

  return NextResponse.json(result);
});
