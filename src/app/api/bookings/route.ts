import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth/cookies";
import { requireUser } from "@/lib/auth/rbac";
import { createBookingFromHold } from "@/lib/booking/engine";

const bodySchema = z.object({ holdId: z.string().min(1) });

export const POST = apiHandler(async (request: NextRequest) => {
  const user = requireUser(await getCurrentUser());
  const { holdId } = bodySchema.parse(await request.json());

  const booking = await createBookingFromHold({ userId: user.sub, holdId });

  return NextResponse.json(
    {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      totalCents: booking.totalCents,
    },
    { status: 201 },
  );
});
