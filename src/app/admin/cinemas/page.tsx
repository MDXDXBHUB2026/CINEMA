import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin · Cinemas" };

export default async function AdminCinemasPage() {
  const cinemas = await prisma.cinema.findMany({
    orderBy: { name: "asc" },
    include: { screens: { include: { _count: { select: { seats: true } } } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Cinemas</h1>
      <p className="mt-1 text-sm text-muted">Cinema/screen configuration is managed via the seed script in this local environment.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cinemas.map((cinema) => (
          <Card key={cinema.id}>
            <CardContent className="pt-5">
              <CardTitle>{cinema.name}</CardTitle>
              <CardDescription>
                {cinema.address}, {cinema.city}
              </CardDescription>
              <ul className="mt-3 space-y-1">
                {cinema.screens.map((screen) => (
                  <li key={screen.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{screen.name}</span>
                    <span className="flex items-center gap-2">
                      <Badge>{screen.screenType}</Badge>
                      <span className="text-xs text-muted">{screen._count.seats} seats</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
