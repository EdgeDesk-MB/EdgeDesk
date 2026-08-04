import { describe, expect, it } from "vitest";
import { computePnlBuckets } from "@/lib/pnl/pnl-buckets";

describe("computePnlBuckets", () => {
  it("splits betting vs casino and totals them with adjustments", () => {
    // Bets: +10 won, -3 lost, void ignored, open ignored
    // Casino: +11.31 completed, planned ignored
    // Manual P&L adjustment: +2
    const buckets = computePnlBuckets({
      bets: [
        { status: "won", actualProfit: 10 },
        { status: "lost", actualProfit: -3 },
        { status: "void", actualProfit: 0 },
        { status: "open", actualProfit: null },
      ],
      casinoOffers: [
        { status: "completed", actualProfit: 11.31 },
        { status: "planned", actualProfit: null },
        { status: "completed", actualProfit: -1.5 },
      ],
      adjustments: [{ amount: 2 }, { amount: null }],
    });

    expect(buckets.bettingProfit).toBe(7);
    expect(buckets.casinoProfit).toBe(9.81);
    expect(buckets.adjustmentProfit).toBe(2);
    expect(buckets.settledProfit).toBe(18.81);
  });

  it("treats zero casino completions as zero, not missing", () => {
    const buckets = computePnlBuckets({
      bets: [],
      casinoOffers: [{ status: "completed", actualProfit: 0 }],
      adjustments: [],
    });
    expect(buckets.casinoProfit).toBe(0);
    expect(buckets.settledProfit).toBe(0);
  });
});
