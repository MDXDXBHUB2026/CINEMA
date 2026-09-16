"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/cookies";
import { requireUser } from "@/lib/auth/rbac";
import { cancelBooking } from "@/lib/booking/engine";

export async function cancelBookingAction(bookingId: string): Promise<{ error?: string }> {
  try {
    const user = requireUser(await getCurrentUser());
    await cancelBooking({ userId: user.sub, bookingId, isStaff: false });
    revalidatePath("/account/bookings");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not cancel this booking." };
  }
}
