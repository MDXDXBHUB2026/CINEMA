"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { HoldCountdown } from "@/components/cinema/hold-countdown";

type SimOutcome = "SUCCESS" | "DECLINED" | "TIMEOUT" | "CANCELLED";

export function PaymentPanel({ bookingId, holdExpiresAt }: { bookingId: string; holdExpiresAt: string | null }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [showTestControls, setShowTestControls] = useState(false);

  async function pay(simulateOutcome: SimOutcome) {
    setSubmitting(true);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/bookings/${bookingId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey, simulateOutcome }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Payment could not be processed.");
        return;
      }
      if (data.bookingStatus === "CONFIRMED") {
        router.push(`/booking/confirmation/${bookingId}`);
        return;
      }
      setError(
        data.paymentStatus === "FAILED"
          ? "Your card was declined. Your booking has not been confirmed — you can try again below."
          : data.paymentStatus === "TIMEOUT"
            ? "The payment timed out. Your booking has not been confirmed — you can try again below."
            : "Payment was cancelled. Your booking has not been confirmed.",
      );
    } catch {
      setError("A network error occurred. Your booking has not been confirmed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Payment</h2>
        {holdExpiresAt && !expired && <HoldCountdown expiresAt={holdExpiresAt} onExpire={() => setExpired(true)} />}
      </div>

      <Alert variant="info" className="mb-4">
        <strong>Simulated payment.</strong> This is a local demo — no real card is charged and no real transaction occurs.
      </Alert>

      {expired ? (
        <Alert variant="danger" title="Your seat reservation expired">
          Please go back and select your seats again.
        </Alert>
      ) : error ? (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}

      {!expired && (
        <>
          <Button className="w-full" size="lg" disabled={submitting} onClick={() => pay("SUCCESS")}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            {submitting ? "Processing..." : "Pay now"}
          </Button>

          <button
            type="button"
            onClick={() => setShowTestControls((v) => !v)}
            className="mt-3 text-xs text-muted underline-offset-2 hover:underline"
          >
            {showTestControls ? "Hide" : "Show"} test payment outcomes
          </button>
          {showTestControls && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={submitting} onClick={() => pay("DECLINED")}>
                Simulate declined
              </Button>
              <Button variant="secondary" size="sm" disabled={submitting} onClick={() => pay("TIMEOUT")}>
                Simulate timeout
              </Button>
              <Button variant="secondary" size="sm" disabled={submitting} onClick={() => pay("CANCELLED")}>
                Simulate cancelled
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
