"use client";

import { useEffect, useState } from "react";
import { AlarmClock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Live countdown to a server-issued expiry. Never computes its own TTL — always driven by an authoritative `expiresAt` from the API. */
export function HoldCountdown({ expiresAt, onExpire, className }: { expiresAt: string; onExpire?: () => void; className?: string }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());
  const [hasExpired, setHasExpired] = useState(remainingMs <= 0);

  useEffect(() => {
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const diff = target - Date.now();
      setRemainingMs(diff);
      if (diff <= 0 && !hasExpired) {
        setHasExpired(true);
        onExpire?.();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isUrgent = totalSeconds <= 60;

  return (
    <div
      role="timer"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
        isUrgent ? "border-danger/40 bg-danger/10 text-danger" : "border-border bg-surface-raised text-foreground",
        className,
      )}
    >
      <AlarmClock className="h-4 w-4" aria-hidden="true" />
      {hasExpired ? "Reservation expired" : `${minutes}:${seconds.toString().padStart(2, "0")} left to complete your booking`}
    </div>
  );
}
