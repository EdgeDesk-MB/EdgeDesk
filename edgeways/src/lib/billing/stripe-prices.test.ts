import { afterEach, describe, expect, it } from "vitest";
import { PUBLIC_PLANS } from "@/lib/billing/public-offer";
import {
  foundingStripePriceId,
  listPenceForSlot,
  publicCatalogueReady,
  publicStripePriceId,
  publicStripePriceSlot,
  STRIPE_LOOKUP_KEYS,
  STRIPE_PRICE_PENCE,
  STRIPE_PRODUCTS,
  stripePriceEnvKey,
  stripePriceId,
  trialPeriodDaysForCheckout,
  type StripePriceSlot,
} from "@/lib/billing/stripe-prices";

const ENV_SLOTS: StripePriceSlot[] = [
  "core_month",
  "core_year",
  "edge_month",
  "edge_year",
  "edge_founding_month",
];

const prev: Record<string, string | undefined> = {};

function stashEnv() {
  for (const slot of ENV_SLOTS) {
    const key = stripePriceEnvKey(slot);
    prev[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv() {
  for (const slot of ENV_SLOTS) {
    const key = stripePriceEnvKey(slot);
    if (prev[key] === undefined) delete process.env[key];
    else process.env[key] = prev[key];
  }
}

describe("stripe prices", () => {
  afterEach(restoreEnv);

  it("keeps one product per plan and lookup keys for every slot", () => {
    expect(STRIPE_PRODUCTS.core).toBe("edgeways_core");
    expect(STRIPE_PRODUCTS.edge).toBe("edgeways_edge");
    expect(STRIPE_LOOKUP_KEYS.core_month).toBe("core_month");
    expect(STRIPE_LOOKUP_KEYS.edge_founding_month).toBe("edge_founding_month");
  });

  it("matches public list pence (founding = Core monthly)", () => {
    const core = PUBLIC_PLANS.find((plan) => plan.id === "core")!;
    const edge = PUBLIC_PLANS.find((plan) => plan.id === "edge")!;
    expect(STRIPE_PRICE_PENCE.core_month).toBe(core.monthlyPence);
    expect(STRIPE_PRICE_PENCE.core_year).toBe(core.annualPence);
    expect(STRIPE_PRICE_PENCE.edge_month).toBe(edge.monthlyPence);
    expect(STRIPE_PRICE_PENCE.edge_year).toBe(edge.annualPence);
    expect(STRIPE_PRICE_PENCE.edge_founding_month).toBe(core.monthlyPence);
    expect(listPenceForSlot("core_year")).toBe(9990);
    expect(listPenceForSlot("edge_founding_month")).toBe(999);
  });

  it("reads price IDs from env and treats Free as no Stripe price", () => {
    stashEnv();
    expect(publicCatalogueReady()).toBe(false);
    expect(publicStripePriceId("core", "month")).toBeNull();
    expect(foundingStripePriceId()).toBeNull();

    process.env.STRIPE_PRICE_CORE_MONTH = " price_core_m ";
    process.env.STRIPE_PRICE_CORE_YEAR = "price_core_y";
    process.env.STRIPE_PRICE_EDGE_MONTH = "price_edge_m";
    process.env.STRIPE_PRICE_EDGE_YEAR = "price_edge_y";
    process.env.STRIPE_PRICE_EDGE_FOUNDING_MONTH = "price_founding";

    expect(stripePriceId("core_month")).toBe("price_core_m");
    expect(publicStripePriceSlot("edge", "year")).toBe("edge_year");
    expect(publicStripePriceId("edge", "year")).toBe("price_edge_y");
    expect(foundingStripePriceId()).toBe("price_founding");
    expect(publicCatalogueReady()).toBe(true);
  });

  it("applies the 14-day trial only on Edge checkout", () => {
    expect(trialPeriodDaysForCheckout("edge")).toBe(14);
    expect(trialPeriodDaysForCheckout("core")).toBe(0);
    expect(trialPeriodDaysForCheckout("free")).toBe(0);
  });
});
