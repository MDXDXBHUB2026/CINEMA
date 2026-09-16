"use client";

import { useState, useTransition } from "react";
import { cancelBookingAction } from "@/app/actions/bookings";
import { Button } from "@/components/ui/button";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Cancel booking
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Cancel this booking?</span>
        <Button
          variant="danger"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelBookingAction(bookingId);
              if (result.error) setError(result.error);
            })
          }
        >
          {isPending ? "Cancelling..." : "Yes, cancel"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Never mind
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
