import { describe, it, expect } from "vitest";
import { generateBookingRef, generateTicketCode } from "@/lib/ids";
import { requireUser, requireRole, assertOwnsResourceOrStaff } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors";
import type { AuthedUser } from "@/lib/auth/rbac";

describe("id generators", () => {
  it("produces unique, prefixed, unambiguous booking references", () => {
    const refs = new Set(Array.from({ length: 500 }, () => generateBookingRef()));
    expect(refs.size).toBe(500);
    for (const ref of refs) {
      expect(ref).toMatch(/^CB-[A-Z0-9]{8}$/);
      expect(ref).not.toMatch(/[0O1I]/); // ambiguous characters excluded from alphabet
    }
  });

  it("produces unique ticket codes", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateTicketCode()));
    expect(codes.size).toBe(200);
  });
});

function user(overrides: Partial<AuthedUser> = {}): AuthedUser {
  return { sub: "user-1", email: "a@test.local", role: "CUSTOMER", name: "A", ...overrides };
}

describe("rbac", () => {
  it("requireUser rejects null with UNAUTHORIZED", () => {
    expect(() => requireUser(null)).toThrow(AppError);
    try {
      requireUser(null);
    } catch (err) {
      expect((err as AppError).code).toBe("UNAUTHORIZED");
    }
  });

  it("requireRole rejects a signed-in user with the wrong role as FORBIDDEN", () => {
    try {
      requireRole(user({ role: "CUSTOMER" }), ["ADMIN"]);
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).code).toBe("FORBIDDEN");
    }
  });

  it("assertOwnsResourceOrStaff allows the owner", () => {
    expect(() => assertOwnsResourceOrStaff(user({ sub: "owner-1" }), "owner-1")).not.toThrow();
  });

  it("assertOwnsResourceOrStaff blocks a different customer (IDOR guard)", () => {
    expect(() => assertOwnsResourceOrStaff(user({ sub: "attacker-1", role: "CUSTOMER" }), "victim-1")).toThrow(AppError);
  });

  it("assertOwnsResourceOrStaff allows staff to view another user's resource", () => {
    expect(() => assertOwnsResourceOrStaff(user({ sub: "staff-1", role: "STAFF" }), "someone-else")).not.toThrow();
    expect(() => assertOwnsResourceOrStaff(user({ sub: "admin-1", role: "ADMIN" }), "someone-else")).not.toThrow();
  });
});
