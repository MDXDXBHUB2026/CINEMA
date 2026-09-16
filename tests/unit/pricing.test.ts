import { describe, it, expect } from "vitest";
import { priceSeat, computePricingBreakdown } from "@/lib/pricing";

const FEE_AND_TAX = { bookingFeeCents: 150, taxRate: 0.08 };

describe("priceSeat", () => {
  it("scales the base price by the category multiplier and rounds to the nearest cent", () => {
    expect(priceSeat(1200, 1.0)).toBe(1200);
    expect(priceSeat(1200, 1.5)).toBe(1800);
    expect(priceSeat(999, 1.5)).toBe(1499); // 1498.5 rounds up
  });
});

describe("computePricingBreakdown", () => {
  it("sums seats, adds a flat fee, taxes (subtotal + fee), and totals correctly", () => {
    const breakdown = computePricingBreakdown(
      [
        { showtimeSeatId: "a", seatLabel: "A1", categoryName: "STANDARD", unitPriceCents: 1200 },
        { showtimeSeatId: "b", seatLabel: "A2", categoryName: "STANDARD", unitPriceCents: 1200 },
      ],
      FEE_AND_TAX,
    );
    expect(breakdown.subtotalCents).toBe(2400);
    expect(breakdown.feesCents).toBe(150);
    expect(breakdown.taxCents).toBe(Math.round((2400 + 150) * 0.08));
    expect(breakdown.totalCents).toBe(breakdown.subtotalCents + breakdown.feesCents + breakdown.taxCents);
  });

  it("charges no fee for an empty seat list", () => {
    const breakdown = computePricingBreakdown([], FEE_AND_TAX);
    expect(breakdown.subtotalCents).toBe(0);
    expect(breakdown.feesCents).toBe(0);
    expect(breakdown.totalCents).toBe(0);
  });

  it("never lets a discount push the total negative", () => {
    const breakdown = computePricingBreakdown(
      [{ showtimeSeatId: "a", seatLabel: "A1", categoryName: "STANDARD", unitPriceCents: 1000 }],
      FEE_AND_TAX,
      999_999,
    );
    expect(breakdown.totalCents).toBe(0);
  });
});
