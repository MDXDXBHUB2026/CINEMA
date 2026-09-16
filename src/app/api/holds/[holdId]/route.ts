import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth/cookies";
import { requireUser } from "@/lib/auth/rbac";
import { releaseHold } from "@/lib/booking/engine";

export const DELETE = apiHandler(async (_request: NextRequest, ctx: { params: Promise<{ holdId: string }> }) => {
  const user = requireUser(await getCurrentUser());
  const { holdId } = await ctx.params;
  await releaseHold({ userId: user.sub, holdId });
  return NextResponse.json({ ok: true });
});
