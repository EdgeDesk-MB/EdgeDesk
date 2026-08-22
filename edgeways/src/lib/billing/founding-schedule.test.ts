import { afterEach, describe, expect, it } from "vitest";
import {
  FOUNDING_PAID_MONTHS,
  buildFoundingSchedulePhases,
  foundingCheckoutAllowed,
  foundingCheckoutPriceId,
  parseFoundingCheckout,
  shouldAttachFoundingSchedule,
} from "@/lib/billing/founding-schedule";

describe("founding schedule", () => {
  afterEach(() => {
    delete process.env.STRIPE_PRICE_EDGE_FOUNDING_MONTH;
  });

  it("is invite-only Edge monthly", () => {
    expect(parseFoundingCheckout("1")).toBe(true);
    expect(parseFoundingCheckout("true")).toBe(true);
    expect(parseFoundingCheckout("yes")).toBe(false);
    expect(foundingCheckoutAllowed("edge", "month", true)).toBe(true);
    expect(foundingCheckoutAllowed("edge", "year", true)).toBe(false);
    expect(foundingCheckoutAllowed("core", "month", true)).toBe(false);
    expect(foundingCheckoutAllowed("edge", "month", false)).toBe(false);
  });

  it("uses the founding price only when the invite flag is valid", () => {
    process.env.STRIPE_PRICE_EDGE_FOUNDING_MONTH = "price_founding";
    expect(foundingCheckoutPriceId("edge", "month", true)).toBe("price_founding");
    expect(foundingCheckoutPriceId("edge", "year", true)).toBeNull();
    expect(foundingCheckoutPriceId("edge", "month", false)).toBeNull();
  });

  it("builds trial then three founding months then Edge list", () => {
    const phases = buildFoundingSchedulePhases({
      foundingPriceId: "price_founding",
      listPriceId: "price_edge_month",
      startDate: 1_700_000_000,
      trialEnd: 1_700_000_000 + 14 * 24 * 60 * 60,
    });
    expect(FOUNDING_PAID_MONTHS).toBe(3);
    expect(phases).toHaveLength(2);
    expect(phases[0]).toMatchObject({
      items: [{ price: "price_founding", quantity: 1 }],
      start_date: 1_700_000_000,
      duration: { interval: "month", interval_count: 3 },
      trial_end: 1_700_000_000 + 14 * 24 * 60 * 60,
    });
    expect(phases[1]).toEqual({
      items: [{ price: "price_edge_month", quantity: 1 }],
    });
  });

  it("omits trial_end when Stripe has no trial on the first phase", () => {
    const phases = buildFoundingSchedulePhases({
      foundingPriceId: "price_founding",
      listPriceId: "price_edge_month",
      startDate: 10,
      trialEnd: null,
    });
    expect(phases[0]?.trial_end).toBeUndefined();
  });

  it("attaches only when checkout marked the session founding", () => {
    expect(shouldAttachFoundingSchedule({ founding: "true" })).toBe(true);
    expect(shouldAttachFoundingSchedule({ founding: "1" })).toBe(false);
    expect(shouldAttachFoundingSchedule({})).toBe(false);
  });
});
