import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getShowtimeWithContext } from "@/lib/catalog";
import { SeatMap } from "@/components/cinema/seat-map";
import { formatDate, formatTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Select Seats" };

export default async function BookingPage({ params }: PageProps<"/booking/[showtimeId]">) {
  const { showtimeId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/booking/${showtimeId}`);

  const showtime = await getShowtimeWithContext(showtimeId);
  if (showtime.status !== "SCHEDULED" || showtime.startsAt <= new Date()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-xl font-semibold text-foreground">This showtime isn&apos;t available for booking</h1>
        <p className="mt-2 text-muted">It may have already started, or been cancelled. Please pick another showtime.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{showtime.movie.title}</h1>
        <p className="text-sm text-muted">
          {showtime.screen.cinema.name} · {showtime.screen.name} · {formatDate(showtime.startsAt, { year: "numeric" })} at {formatTime(showtime.startsAt)}
        </p>
      </div>
      <SeatMap showtimeId={showtime.id} />
    </div>
  );
}
