import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { getCinemas } from "@/lib/catalog";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = { title: "Cinemas" };

export default async function CinemasPage() {
  const cinemas = await getCinemas();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Our Cinemas</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cinemas.map((cinema) => (
          <Link key={cinema.id} href={`/cinemas/${cinema.slug}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="pt-5">
                <CardTitle>{cinema.name}</CardTitle>
                <CardDescription className="mt-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {cinema.address}, {cinema.city}
                </CardDescription>
                <p className="mt-3 text-xs text-muted">{cinema.screens.length} screens</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
