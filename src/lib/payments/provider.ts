/**
 * Payment provider abstraction. The booking domain only ever talks to this
 * interface, never to a concrete provider — swapping `SimulatedPaymentProvider`
 * for e.g. a Stripe-backed implementation later requires no changes outside
 * `src/lib/payments/`. See docs/SECURITY.md and docs/ARCHITECTURE.md.
 */

export const SIMULATED_OUTCOMES = ["SUCCESS", "DECLINED", "TIMEOUT", "CANCELLED"] as const;
export type SimulatedOutcome = (typeof SIMULATED_OUTCOMES)[number];

export type PaymentChargeStatus = "SUCCEEDED" | "FAILED" | "CANCELLED" | "TIMEOUT";

export interface PaymentChargeRequest {
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  /** Only meaningful for SimulatedPaymentProvider; ignored by real providers. */
  simulateOutcome?: SimulatedOutcome;
}

export interface PaymentChargeResult {
  status: PaymentChargeStatus;
  providerRef: string;
}

export interface PaymentProvider {
  charge(request: PaymentChargeRequest): Promise<PaymentChargeResult>;
}
