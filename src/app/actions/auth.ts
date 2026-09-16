"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/cookies";
import { registerSchema, loginSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isRole } from "@/lib/enums";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const ip = await clientIp();
  const limited = rateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.allowed) {
    return { error: "Too many registration attempts. Please try again later." };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { fieldErrors: { email: ["An account with this email already exists."] } };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: "CUSTOMER" },
  });

  logger.info("AUTH_REGISTER", { userId: user.id });
  await setSessionCookie({ sub: user.id, email: user.email, role: "CUSTOMER", name: user.name });

  const next = formData.get("next");
  const isSafeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
  redirect(isSafeNext ? next : "/account");
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const ip = await clientIp();
  const emailRaw = String(formData.get("email") ?? "").toLowerCase().trim();

  // Coarse brute-force guard, keyed by IP+email so one bad actor can't lock
  // out a legitimate user's account, only slow down repeated attempts from
  // the same origin. Local-process-only — see docs/SECURITY.md.
  const limited = rateLimit(`login:${ip}:${emailRaw}`, 8, 15 * 60 * 1000);
  if (!limited.allowed) {
    return { error: "Too many login attempts. Please wait a few minutes and try again." };
  }

  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

  await prisma.loginAttempt.create({
    data: { userId: user?.id, email: parsed.data.email, succeeded: valid, ip },
  });

  if (!user || !valid || !isRole(user.role)) {
    logger.warn("AUTH_LOGIN_FAILURE", { email: parsed.data.email, ip });
    return { error: "Invalid email or password." };
  }

  logger.info("AUTH_LOGIN_SUCCESS", { userId: user.id, ip });
  await setSessionCookie({ sub: user.id, email: user.email, role: user.role, name: user.name });

  const next = formData.get("next");
  const isSafeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
  const defaultDestination = user.role === "ADMIN" || user.role === "STAFF" || user.role === "CINEMA_MANAGER" ? "/admin" : "/account";
  redirect(isSafeNext ? next : defaultDestination);
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  logger.info("AUTH_LOGOUT", {});
  redirect("/");
}
