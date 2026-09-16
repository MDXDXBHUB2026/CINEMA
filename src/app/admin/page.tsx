import type { Metadata } from "next";
import { TrendingUp, Ticket, CalendarClock, PieChart } from "lucide-react";
import { getDashboardMetrics } from "@/lib/admin/metrics";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { StatusChart } from "@/components/admin/status-chart";
import { formatCents } from "@/lib/pricing";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics();

  const stats = [
    { label: "Today's confirmed bookings", value: metrics.todaysBookings, icon: CalendarClock },
    { label: "Tickets sold (all time)", value: metrics.ticketsSold, icon: Ticket },
    { label: "Revenue (confirmed)", value: formatCents(metrics.revenueCents), icon: TrendingUp },
    { label: "Seat occupancy", value: `${Math.round(metrics.occupancyRate * 100)}%`, icon: PieChart },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5">
              <stat.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <CardTitle>Bookings by status</CardTitle>
            <CardDescription>All bookings ever created, grouped by current status.</CardDescription>
            <div className="mt-4">
              <StatusChart data={metrics.statusBreakdown} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <CardTitle>Popular movies</CardTitle>
            <CardDescription>By confirmed tickets sold.</CardDescription>
            <ul className="mt-4 space-y-2">
              {metrics.popularMovies.length === 0 && <li className="text-sm text-muted">No confirmed bookings yet.</li>}
              {metrics.popularMovies.map((m, i) => (
                <li key={m.title} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    <span className="mr-2 text-muted">#{i + 1}</span>
                    {m.title}
                  </span>
                  <span className="font-medium text-foreground">{m.count} tickets</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-sm text-muted">{metrics.upcomingShowtimes} upcoming showtimes scheduled.</p>
    </div>
  );
}
