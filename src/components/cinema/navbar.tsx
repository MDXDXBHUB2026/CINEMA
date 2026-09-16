import Link from "next/link";
import { Clapperboard, LayoutDashboard } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/cookies";
import { logoutAction } from "@/app/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { MobileNav } from "@/components/cinema/mobile-nav";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/movies", label: "Movies" },
  { href: "/cinemas", label: "Cinemas" },
];

export async function Navbar() {
  const user = await getCurrentUser();
  const isStaff = user && ["STAFF", "CINEMA_MANAGER", "ADMIN"].includes(user.role);

  const authLinks = user ? (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      {isStaff && (
        <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-raised">
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Admin
        </Link>
      )}
      <Link href="/account" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-raised">
        {user.name}
      </Link>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="sm">
          Log out
        </Button>
      </form>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-raised">
        Log in
      </Link>
      <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
        Sign up
      </Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
          <Clapperboard className="h-6 w-6 text-primary" aria-hidden="true" />
          <span>CineBook</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-raised">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden sm:block">{authLinks}</div>
        <MobileNav links={NAV_LINKS} authLinks={authLinks} />
      </div>
    </header>
  );
}
