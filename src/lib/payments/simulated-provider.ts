import type { PaymentChargeRequest, PaymentChargeResult, PaymentProvider } from "@/lib/payments/provider";

/**
 * Development-only payment provider. No network calls, no real card data —
 * the outcome is whatever the caller requests (default SUCCESS), which lets
 * the UI/tests exercise DECLINED/TIMEOUT/CANCELLED paths deterministically.
 * The checkout UI must clearly disclose that no real transaction occurs.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  async charge(request: PaymentChargeRequest): Promise<PaymentChargeResult> {
    const outcome = request.simulateOutcome ?? "SUCCESS";
    const providerRef = `sim_${request.idempotencyKey}`;

    switch (outcome) {
      case "SUCCESS":
        return { status: "SUCCEEDED", providerRef };
      case "DECLINED":
        return { status: "FAILED", providerRef };
      case "TIMEOUT":
        return { status: "TIMEOUT", providerRef };
      case "CANCELLED":
        return { status: "CANCELLED", providerRef };
    }
  }
}

export const paymentProvider: PaymentProvider = new SimulatedPaymentProvider();
