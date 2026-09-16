import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth/cookies";
import { assertOwnsResourceOrStaff } from "@/lib/auth/rbac";
import { getBookingDetail } from "@/lib/booking/queries";

export const GET = apiHandler(async (_request: NextRequest, ctx: { params: Promise<{ bookingId: string }> }) => {
  const { bookingId } = await ctx.params;
  const user = await getCurrentUser();
  const booking = await getBookingDetail(bookingId);
  assertOwnsResourceOrStaff(user, booking.userId);

  return NextResponse.json({ booking });
});
