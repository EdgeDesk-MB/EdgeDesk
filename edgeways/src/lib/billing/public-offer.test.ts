import { describe, expect, it } from "vitest";
import { can } from "@/lib/entitlements/plans";
import {
  ANNUAL_MONTHS_CHARGED,
  comparisonRows,
  formatGbpFromPence,
  FOUNDING_MONTHS_AT_CORE,
  planCheckoutHref,
  PUBLIC_PLANS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  YEARLY_MONTHS_FREE,
  yearlyBillingSummary,
  yearlyDealLabel,
  yearlyDealCue,
  betaOfferSummary,
} from "@/lib/billing/public-offer";

describe("public offer", () => {
  it("locks list prices in pence (no float monthly maths)", () => {
    const free = PUBLIC_PLANS.find((p) => p.id === "free");
    const core = PUBLIC_PLANS.find((p) => p.id === "core");
    const edge = PUBLIC_PLANS.find((p) => p.id === "edge");
    expect(free?.monthlyPence).toBe(0);
    expect(core?.monthlyPence).toBe(999);
    expect(core?.annualPence).toBe(9990);
    expect(edge?.monthlyPence).toBe(2499);
    expect(edge?.annualPence).toBe(24990);
    expect(ANNUAL_MONTHS_CHARGED).toBe(10);
    expect(YEARLY_MONTHS_FREE).toBe(2);
    expect(yearlyDealLabel()).toBe("2 months free");
    expect(yearlyDealCue()).toBe("2 months free with yearly");
    expect(TRIAL_DAYS).toBe(14);
    expect(TRIAL_PLAN).toBe("edge");
    expect(FOUNDING_MONTHS_AT_CORE).toBe(3);
  });

  it("formats GBP from integer pence", () => {
    expect(formatGbpFromPence(0)).toBe("£0");
    expect(formatGbpFromPence(999)).toBe("£9.99");
    expect(formatGbpFromPence(2499)).toBe("£24.99");
    expect(formatGbpFromPence(9990)).toBe("£99.90");
    expect(formatGbpFromPence(24990)).toBe("£249.90");
  });

  it("comparison rows follow the entitlement matrix", () => {
    const rows = comparisonRows();
    const doNext = rows.find((r) => r.flag === "do_next");
    expect(doNext?.included).toEqual({
      free: false,
      core: true,
      edge: true,
    });
    const picks = rows.find((r) => r.flag === "offer_edge");
    expect(picks?.included).toEqual({
      free: false,
      core: false,
      edge: true,
    });
    for (const row of rows) {
      expect(row.included.free).toBe(can("free", row.flag));
      expect(row.included.core).toBe(can("core", row.flag));
      expect(row.included.edge).toBe(can("edge", row.flag));
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.description.length).toBeGreaterThan(20);
    }
    const lay = rows.find((r) => r.flag === "exchange_lay");
    expect(lay?.title).toBe("Live exchange prices");
    expect(lay?.description.toLowerCase()).toContain("betfair");
  });

  it("checkout links carry plan and billing interval", () => {
    const core = PUBLIC_PLANS.find((p) => p.id === "core")!;
    const free = PUBLIC_PLANS.find((p) => p.id === "free")!;
    expect(planCheckoutHref(free, "year")).toBe("/sign-up");
    expect(planCheckoutHref(core, "month")).toBe(
      "/sign-up?plan=core&interval=month"
    );
    expect(planCheckoutHref(core, "year")).toBe(
      "/sign-up?plan=core&interval=year"
    );
  });

  it("states yearly and beta deals in plain language", () => {
    expect(yearlyBillingSummary()).toBe(
      "Yearly billing is 2 months free: 12 months for the price of 10."
    );
    expect(betaOfferSummary()).toBe(
      "Waitlist and invited beta testers get 14 days of Edge free, then 3 months of Edge for £9.99 a month. After that, Edge is £24.99 a month."
    );
  });
});
