import { SignJWT, jwtVerify } from "jose";
import { authConfig } from "@/lib/config";
import type { Role } from "@/lib/enums";

export const SESSION_COOKIE_NAME = "cinebook_session";

export interface SessionPayload {
  sub: string; // user id
  email: string;
  role: Role;
  name: string;
}

const secretKey = new TextEncoder().encode(authConfig.secret);

/** Signs a session JWT. Pure function — no cookie I/O (see src/lib/auth/cookies.ts). */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${authConfig.sessionTtlSeconds}s`)
    .sign(secretKey);
}

/** Verifies and decodes a session JWT. Returns null on any invalid/expired token. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role as Role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}
