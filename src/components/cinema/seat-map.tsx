"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, X, Accessibility, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface SeatMapEntry {
  showtimeSeatId: string;
  seatId: string;
  row: string;
  column: number;
  label: string;
  category: { id: string; name: string; priceMultiplier: number };
  isAccessible: boolean;
  status: "AVAILABLE" | "HELD" | "BOOKED";
  priceCents: number;
  heldByMe: boolean;
}

export function SeatMap({ showtimeId }: { showtimeId: string }) {
  const router = useRouter();
  const [seats, setSeats] = useState<SeatMapEntry[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Manual refresh (e.g. after a SEAT_UNAVAILABLE conflict) — not called
  // directly from the mount effect below, which fetches independently so
  // it can guard against a stale response after unmount/showtime change.
  const loadSeats = useCallback(async () => {
    const res = await fetch(`/api/showtimes/${showtimeId}/seats`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setSeats(data.seats as SeatMapEntry[]);
    else setError(data.message ?? "Could not load the seat map.");
  }, [showtimeId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/showtimes/${showtimeId}/seats`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) setSeats(data.seats as SeatMapEntry[]);
        else setError(data.message ?? "Could not load the seat map.");
      })
      .catch(() => {
        if (!cancelled) setError("A network error occurred while loading seats.");
      });
    return () => {
      cancelled = true;
    };
  }, [showtimeId]);

  const rows = useMemo(() => {
    if (!seats) return [];
    const map = new Map<string, SeatMapEntry[]>();
    for (const seat of seats) {
      if (!map.has(seat.row)) map.set(seat.row, []);
      map.get(seat.row)!.push(seat);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const selectedSeats = useMemo(() => (seats ?? []).filter((s) => selected.has(s.showtimeSeatId)), [seats, selected]);
  const subtotalCents = selectedSeats.reduce((sum, s) => sum + s.priceCents, 0);

  function toggleSeat(seat: SeatMapEntry) {
    if (seat.status !== "AVAILABLE") return;
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.showtimeSeatId)) {
        next.delete(seat.showtimeSeatId);
      } else {
        if (next.size >= 10) return prev;
        next.add(seat.showtimeSeatId);
      }
      return next;
    });
  }

  async function reserveAndCheckout() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const holdRes = await fetch("/api/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showtimeId, seatIds: [...selected] }),
      });
      const holdData = await holdRes.json();
      if (!holdRes.ok) {
        if (holdData.code === "SEAT_UNAVAILABLE") {
          setError("One or more of your selected seats were just taken by another customer. Please choose again.");
          setSelected(new Set());
          await loadSeats();
        } else {
          setError(holdData.message ?? "Could not reserve your seats.");
        }
        return;
      }

      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId: holdData.holdId }),
      });
      const bookingData = await bookingRes.json();
      if (!bookingRes.ok) {
        setError(bookingData.message ?? "Could not start checkout.");
        return;
      }

      router.push(`/checkout/${bookingData.bookingId}`);
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !seats) {
    return <Alert variant="danger" title="Couldn't load seats">{error}</Alert>;
  }

  if (!seats) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mx-auto mb-8 h-2 w-full max-w-lg rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" aria-hidden="true" />
        <p className="mb-6 text-center text-xs uppercase tracking-widest text-muted">Screen</p>

        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="space-y-2 overflow-x-auto pb-2">
          {rows.map(([row, rowSeats]) => (
            <div key={row} className="flex items-center justify-center gap-1.5">
              <span className="w-4 shrink-0 text-xs text-muted">{row}</span>
              <div className="flex gap-1.5">
                {rowSeats
                  .sort((a, b) => a.column - b.column)
                  .map((seat) => {
                    const isSelected = selected.has(seat.showtimeSeatId);
                    const disabled = seat.status !== "AVAILABLE";
                    return (
                      <button
                        key={seat.showtimeSeatId}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleSeat(seat)}
                        aria-pressed={isSelected}
                        aria-label={`Seat ${seat.label}, ${seat.category.name.toLowerCase()}${seat.isAccessible ? ", accessible" : ""}, ${
                          seat.status === "BOOKED" ? "already booked" : seat.status === "HELD" ? "temporarily held by another customer" : isSelected ? "selected" : "available"
                        }, ${formatCents(seat.priceCents)}`}
                        title={`${seat.label} — ${seat.category.name} — ${formatCents(seat.priceCents)}`}
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          seat.status === "BOOKED" && "cursor-not-allowed border-border bg-surface text-muted/50",
                          seat.status === "HELD" && "cursor-not-allowed border-warning/40 bg-warning/10 text-warning",
                          seat.status === "AVAILABLE" && !isSelected && seat.category.name === "PREMIUM" && "border-primary/40 bg-primary/5 text-foreground hover:border-primary",
                          seat.status === "AVAILABLE" && !isSelected && seat.category.name !== "PREMIUM" && "border-border bg-surface-raised text-foreground hover:border-primary",
                          isSelected && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {seat.status === "BOOKED" ? (
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : seat.status === "HELD" ? (
                          <Lock className="h-3 w-3" aria-hidden="true" />
                        ) : isSelected ? (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : seat.isAccessible ? (
                          <Accessibility className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          seat.column
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-border bg-surface-raised" /> Available
          </li>
          <li className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-primary/40 bg-primary/5" /> Premium
          </li>
          <li className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-primary bg-primary text-primary-foreground">
              <Check className="h-3 w-3" />
            </span>{" "}
            Selected
          </li>
          <li className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-warning/40 bg-warning/10 text-warning">
              <Lock className="h-3 w-3" />
            </span>{" "}
            Temporarily held
          </li>
          <li className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-border bg-surface text-muted/50">
              <X className="h-3 w-3" />
            </span>{" "}
            Booked
          </li>
          <li className="flex items-center gap-1.5">
            <Accessibility className="h-4 w-4" /> Accessible
          </li>
        </ul>
      </div>

      <aside className="h-fit rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-foreground">Your selection</h2>
        {selectedSeats.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Select up to 10 seats.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {selectedSeats.map((s) => (
              <li key={s.showtimeSeatId} className="flex justify-between text-foreground">
                <span>
                  {s.label} <span className="text-muted">({s.category.name.toLowerCase()})</span>
                </span>
                <span>{formatCents(s.priceCents)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm font-medium text-foreground">
          <span>Subtotal</span>
          <span>{formatCents(subtotalCents)}</span>
        </div>
        <p className="mt-1 text-xs text-muted">Fees and tax are calculated at checkout.</p>
        <Button className="mt-4 w-full" disabled={selectedSeats.length === 0 || submitting} onClick={reserveAndCheckout}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitting ? "Reserving..." : "Reserve seats & continue"}
        </Button>
      </aside>
    </div>
  );
}
