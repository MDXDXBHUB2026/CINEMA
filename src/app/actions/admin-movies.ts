"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/cookies";
import { requireStaff } from "@/lib/auth/rbac";
import { movieInputSchema } from "@/lib/validation";
import { recordAuditEvent } from "@/lib/audit";

export interface AdminFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

export async function createMovieAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = requireStaff(await getCurrentUser());

  const parsed = movieInputSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    synopsis: formData.get("synopsis"),
    durationMinutes: formData.get("durationMinutes"),
    language: formData.get("language"),
    classification: formData.get("classification"),
    releaseDate: formData.get("releaseDate"),
    posterUrl: formData.get("posterUrl") || "/posters/placeholder.svg",
    backdropUrl: formData.get("backdropUrl") || "/backdrops/placeholder.svg",
    status: formData.get("status"),
    genreIds: formData.getAll("genreIds"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.movie.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { fieldErrors: { slug: ["A movie with this slug already exists."] } };
  }

  const movie = await prisma.movie.create({
    data: {
      ...parsed.data,
      genres: { create: parsed.data.genreIds.map((genreId) => ({ genreId })) },
    },
  });

  await recordAuditEvent({ actorUserId: user.sub, action: "MOVIE_CREATED", entityType: "Movie", entityId: movie.id, metadata: { title: movie.title } });
  revalidatePath("/admin/movies");
  revalidatePath("/movies");
  return { success: true };
}
