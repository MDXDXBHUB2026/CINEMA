import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[a-z]/, "Password needs a lowercase letter")
    .regex(/[A-Z]/, "Password needs an uppercase letter")
    .regex(/[0-9]/, "Password needs a number"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createHoldSchema = z.object({
  showtimeId: z.string().min(1),
  seatIds: z.array(z.string().min(1)).min(1, "Select at least one seat").max(10, "Maximum 10 seats per booking"),
});
export type CreateHoldInput = z.infer<typeof createHoldSchema>;

export const confirmPaymentSchema = z.object({
  bookingId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  simulateOutcome: z.enum(["SUCCESS", "DECLINED", "TIMEOUT", "CANCELLED"]).default("SUCCESS"),
});
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

export const movieInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  synopsis: z.string().trim().min(1).max(4000),
  durationMinutes: z.coerce.number().int().min(1).max(600),
  language: z.string().trim().min(1).max(50),
  classification: z.string().trim().min(1).max(20),
  releaseDate: z.coerce.date(),
  posterUrl: z.string().trim().min(1),
  backdropUrl: z.string().trim().min(1),
  status: z.enum(["NOW_SHOWING", "COMING_SOON", "ARCHIVED"]),
  genreIds: z.array(z.string().min(1)).default([]),
});
export type MovieInput = z.infer<typeof movieInputSchema>;

export const showtimeInputSchema = z.object({
  movieId: z.string().min(1),
  screenId: z.string().min(1),
  startsAt: z.coerce.date(),
  basePriceCents: z.coerce.number().int().min(0).max(1_000_000),
});
export type ShowtimeInput = z.infer<typeof showtimeInputSchema>;
