import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { User, Ticket } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/cookies";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My Account" };

export default async function AccountPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login?next=/account");

  const [user, bookingCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.sub }, select: { name: true, email: true, role: true, createdAt: true } }),
    prisma.booking.count({ where: { userId: session.sub, status: "CONFIRMED" } }),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">My Account</h1>

      <Card className="mt-6">
        <CardContent className="flex items-center gap-4 pt-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-raised">
            <User className="h-6 w-6 text-muted" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>{user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
            <p className="mt-1 text-xs text-muted">Member since {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(user.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="flex items-center justify-between pt-5">
          <div className="flex items-center gap-3">
            <Ticket className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <CardTitle>Your bookings</CardTitle>
              <CardDescription>{bookingCount} confirmed booking{bookingCount === 1 ? "" : "s"}</CardDescription>
            </div>
          </div>
          <Link href="/account/bookings">
            <Button variant="secondary">View all</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
