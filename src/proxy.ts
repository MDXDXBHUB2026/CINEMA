import { NextResponse, NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { ROLES, type Role } from "@/lib/enums";

const STAFF_ROLES: Role[] = ["STAFF", "CINEMA_MANAGER", "ADMIN"];

/**
 * Edge-of-request redirect for unauthenticated/unauthorized page loads —
 * a UX convenience, NOT the authorization boundary. Every server action and
 * API route re-checks the session and role independently (see
 * src/lib/auth/rbac.ts); an attacker who bypasses this proxy (e.g. calling
 * the API directly) still hits those checks. See docs/SECURITY.md.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAccountArea = pathname.startsWith("/account");
  const isAdminArea = pathname.startsWith("/admin");
  if (!isAccountArea && !isAdminArea) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !(ROLES as readonly string[]).includes(session.role)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminArea && !STAFF_ROLES.includes(session.role)) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
