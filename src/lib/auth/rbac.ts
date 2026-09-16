import { AppError } from "@/lib/errors";
import type { Role } from "@/lib/enums";
import type { SessionPayload } from "@/lib/auth/session";

export type AuthedUser = SessionPayload;

const STAFF_ROLES: Role[] = ["STAFF", "CINEMA_MANAGER", "ADMIN"];

export function requireUser(user: AuthedUser | null): AuthedUser {
  if (!user) throw new AppError("UNAUTHORIZED", "You must be signed in to do that.");
  return user;
}

export function requireRole(user: AuthedUser | null, roles: Role[]): AuthedUser {
  const authed = requireUser(user);
  if (!roles.includes(authed.role)) {
    throw new AppError("FORBIDDEN", "You do not have permission to do that.");
  }
  return authed;
}

export function requireStaff(user: AuthedUser | null): AuthedUser {
  return requireRole(user, STAFF_ROLES);
}

export function requireAdmin(user: AuthedUser | null): AuthedUser {
  return requireRole(user, ["ADMIN"]);
}

/**
 * Ownership check for customer-scoped resources (bookings, tickets). Staff
 * roles bypass ownership because they operate on other customers' records
 * (e.g. box-office lookups); customers may only ever see their own.
 * IDOR guard — always call this before returning a booking/ticket by id.
 */
export function assertOwnsResourceOrStaff(user: AuthedUser | null, ownerUserId: string): void {
  const authed = requireUser(user);
  if (authed.sub === ownerUserId) return;
  if (STAFF_ROLES.includes(authed.role)) return;
  throw new AppError("FORBIDDEN", "You do not have permission to view this resource.");
}
