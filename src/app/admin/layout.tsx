import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/cookies";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/movies", label: "Movies" },
  { href: "/admin/cinemas", label: "Cinemas" },
  { href: "/admin/showtimes", label: "Showtimes" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/audit", label: "Audit Log" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Defense in depth: src/proxy.ts already redirects non-staff away from
  // /admin/*, but every server boundary re-checks — see docs/SECURITY.md.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!["STAFF", "CINEMA_MANAGER", "ADMIN"].includes(user.role)) redirect("/account");

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <aside className="hidden w-48 shrink-0 sm:block">
        <nav className="sticky top-20 space-y-1" aria-label="Admin">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-raised">
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="mb-4 flex flex-wrap gap-1 sm:hidden" aria-label="Admin">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
