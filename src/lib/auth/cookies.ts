import { cookies } from "next/headers";
import { authConfig } from "@/lib/config";
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/auth/session";

/** Sets the signed session cookie. Call from a Server Action or Route Handler only. */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: authConfig.sessionTtlSeconds,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/** Reads and verifies the session cookie. Returns null if absent/invalid/expired. */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
