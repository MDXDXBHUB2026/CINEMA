import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getShowtimeSeatMap } from "@/lib/booking/engine";

export const GET = apiHandler(async (_request: NextRequest, ctx: { params: Promise<{ showtimeId: string }> }) => {
  const { showtimeId } = await ctx.params;
  const user = await getCurrentUser();
  const seats = await getShowtimeSeatMap(showtimeId, user?.sub);
  return NextResponse.json({ seats });
});
