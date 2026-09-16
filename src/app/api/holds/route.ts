import { NextRequest, NextResponse } from "next/server";
import { apiHandler, getClientIp } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth/cookies";
import { requireUser } from "@/lib/auth/rbac";
import { createHoldSchema } from "@/lib/validation";
import { createSeatHold } from "@/lib/booking/engine";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

export const POST = apiHandler(async (request: NextRequest) => {
  const user = requireUser(await getCurrentUser());

  const limited = rateLimit(`hold:${getClientIp(request)}:${user.sub}`, 20, 60 * 1000);
  if (!limited.allowed) {
    throw new AppError("RATE_LIMITED", "You're selecting seats too quickly. Please slow down.");
  }

  const body = createHoldSchema.parse(await request.json());
  const hold = await createSeatHold({ userId: user.sub, showtimeId: body.showtimeId, seatIds: body.seatIds });

  return NextResponse.json({ holdId: hold.holdId, expiresAt: hold.expiresAt.toISOString() }, { status: 201 });
});
