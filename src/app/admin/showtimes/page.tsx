import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CreateShowtimeForm } from "@/components/admin/create-showtime-form";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { formatCents } from "@/lib/pricing";

export const metadata: Metadata = { title: "Admin · Showtimes" };

export default async function AdminShowtimesPage() {
  const [showtimes, movies, screens] = await Promise.all([
    prisma.showtime.findMany({
      where: { startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 50,
      include: { movie: true, screen: { include: { cinema: true } } },
    }),
    prisma.movie.findMany({ where: { status: { in: ["NOW_SHOWING", "COMING_SOON"] } }, orderBy: { title: "asc" } }),
    prisma.screen.findMany({ include: { cinema: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Showtimes</h1>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5">Movie</th>
              <th className="px-4 py-2.5">Cinema / Screen</th>
              <th className="px-4 py-2.5">When</th>
              <th className="px-4 py-2.5">Price</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {showtimes.map((st) => (
              <tr key={st.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium text-foreground">{st.movie.title}</td>
                <td className="px-4 py-2.5 text-muted">
                  {st.screen.cinema.name} · {st.screen.name}
                </td>
                <td className="px-4 py-2.5 text-muted">
                  {formatDate(st.startsAt)} {formatTime(st.startsAt)}
                </td>
                <td className="px-4 py-2.5 text-muted">{formatCents(st.basePriceCents)}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={st.status === "SCHEDULED" ? "success" : "default"}>{st.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-foreground">Schedule a showtime</h2>
      <div className="max-w-xl rounded-xl border border-border bg-surface p-5">
        <CreateShowtimeForm
          movies={movies.map((m) => ({ id: m.id, title: m.title }))}
          screens={screens.map((s) => ({ id: s.id, name: s.name, cinemaName: s.cinema.name }))}
        />
      </div>
    </div>
  );
}
