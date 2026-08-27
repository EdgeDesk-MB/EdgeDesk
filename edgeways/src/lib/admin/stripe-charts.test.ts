import { describe, expect, it } from "vitest";
import {
  buildFoundingShare,
  buildStripeCharts,
  formatPenceGbp,
} from "@/lib/admin/stripe-charts";
import { sumSeries } from "@/lib/admin/series";

const now = new Date("2026-08-26T12:00:00Z");

function utcNoon(day: string): number {
  return Date.parse(`${day}T12:00:00Z`);
}

describe("buildStripeCharts", () => {
  it("charts paid volume, ignores unpaid invoices, and labels cancelled", () => {
    const charts = buildStripeCharts(
      {
        invoices: [
          { createdAt: utcNoon("2026-08-25"), amountPence: 999, paid: true },
          { createdAt: utcNoon("2026-08-25"), amountPence: 500, paid: false },
          { createdAt: utcNoon("2026-08-18"), amountPence: 499, paid: true },
        ],
        refunds: [{ createdAt: utcNoon("2026-08-26"), amountPence: 100 }],
        subscriptionCreatedAt: [utcNoon("2026-08-25"), utcNoon("2026-08-10")],
        status: { active: 2, trialing: 1, pastDue: 0, canceled: 3 },
      },
      now
    );

    expect(sumSeries(charts.paidVolume30)).toBe(1498);
    expect(sumSeries(charts.paidCount30)).toBe(2);
    expect(sumSeries(charts.refundVolume30)).toBe(100);
    expect(sumSeries(charts.newSubs30)).toBe(2);
    expect(charts.week.paidVolume.current).toBe(999);
    expect(charts.week.paidVolume.previous).toBe(499);
    expect(charts.statusShare.find((slice) => slice.label === "Cancelled")?.value).toBe(
      3
    );
  });
});

describe("formatPenceGbp / founding share", () => {
  it("formats pence and splits founding holders", () => {
    expect(formatPenceGbp(999)).toBe("£9.99");
    expect(buildFoundingShare(1, 4).map((slice) => slice.value)).toEqual([1, 3]);
  });
});
