"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/cookies";
import { requireStaff } from "@/lib/auth/rbac";
import { showtimeInputSchema } from "@/lib/validation";
import { recordAuditEvent } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import type { AdminFormState } from "@/app/actions/admin-movies";

export async function createShowtimeAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = requireStaff(await getCurrentUser());

  const parsed = showtimeInputSchema.safeParse({
    movieId: formData.get("movieId"),
    screenId: formData.get("screenId"),
    startsAt: formData.get("startsAt"),
    basePriceCents: formData.get("basePriceCents"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const [movie, screen] = await Promise.all([
    prisma.movie.findUnique({ where: { id: parsed.data.movieId } }),
    prisma.screen.findUnique({ where: { id: parsed.data.screenId }, include: { seats: { where: { isActive: true } } } }),
  ]);
  if (!movie) return { error: "Movie not found." };
  if (!screen) return { error: "Screen not found." };
  if (parsed.data.startsAt <= new Date()) return { fieldErrors: { startsAt: ["Showtime must be in the future."] } };

  const endsAt = new Date(parsed.data.startsAt.getTime() + movie.durationMinutes * 60 * 1000);

  const showtime = await prisma.$transaction(async (tx) => {
    const created = await tx.showtime.create({
      data: {
        movieId: movie.id,
        screenId: screen.id,
        startsAt: parsed.data.startsAt,
        endsAt,
        basePriceCents: parsed.data.basePriceCents,
        status: "SCHEDULED",
      },
    });
    if (screen.seats.length === 0) {
      throw new AppError("VALIDATION_ERROR", "This screen has no active seats configured.");
    }
    await tx.showtimeSeat.createMany({
      data: screen.seats.map((seat) => ({ showtimeId: created.id, seatId: seat.id, status: "AVAILABLE" })),
    });
    return created;
  });

  await recordAuditEvent({
    actorUserId: user.sub,
    action: "SHOWTIME_CREATED",
    entityType: "Showtime",
    entityId: showtime.id,
    metadata: { movieId: movie.id, screenId: screen.id, startsAt: showtime.startsAt.toISOString() },
  });

  revalidatePath("/admin/showtimes");
  revalidatePath(`/movies/${movie.slug}`);
  return { success: true };
}
