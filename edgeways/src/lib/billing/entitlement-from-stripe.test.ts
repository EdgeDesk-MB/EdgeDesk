import { describe, expect, it } from "vitest";
import {
  clerkUserIdFromStripe,
  entitlementFromSubscription,
  planFromPriceId,
  type PriceCatalogue,
} from "@/lib/billing/entitlement-from-stripe";

const catalogue: PriceCatalogue = {
  core: ["price_core_m", "price_core_y"],
  edge: ["price_edge_m", "price_edge_y"],
  founding: ["price_founding"],
};

describe("planFromPriceId", () => {
  it("maps catalogue prices, founding as Edge", () => {
    expect(planFromPriceId("price_core_m", catalogue)).toBe("core");
    expect(planFromPriceId("price_edge_y", catalogue)).toBe("edge");
    expect(planFromPriceId("price_founding", catalogue)).toBe("edge");
    expect(planFromPriceId("price_unknown", catalogue)).toBeNull();
  });
});

describe("entitlementFromSubscription", () => {
  it("treats Edge trial as Edge, not Core", () => {
    const row = entitlementFromSubscription(
      {
        status: "trialing",
        customerId: "cus_1",
        subscriptionId: "sub_1",
        trialEnd: 1_800_000_000,
        metadata: { plan: "edge" },
        priceId: "price_edge_m",
      },
      catalogue
    );
    expect(row.plan).toBe("edge");
    expect(row.billingStatus).toBe("trialing");
    expect(row.trialEndsAt).toBe(1_800_000_000_000);
    expect(row.founding).toBe(false);
  });

  it("keeps Core when the subscription is active", () => {
    const row = entitlementFromSubscription(
      {
        status: "active",
        metadata: { plan: "core" },
        priceId: "price_core_y",
      },
      catalogue
    );
    expect(row.plan).toBe("core");
    expect(row.billingStatus).toBe("active");
  });

  it("marks Founding as Edge", () => {
    const row = entitlementFromSubscription(
      {
        status: "active",
        priceId: "price_founding",
        metadata: { plan: "edge" },
      },
      catalogue
    );
    expect(row.plan).toBe("edge");
    expect(row.founding).toBe(true);
  });

  it("drops to Free when Stripe cancels", () => {
    const row = entitlementFromSubscription(
      {
        status: "canceled",
        priceId: "price_edge_m",
        metadata: { plan: "edge" },
        customerId: "cus_1",
        subscriptionId: "sub_1",
      },
      catalogue
    );
    expect(row.plan).toBe("free");
    expect(row.billingStatus).toBe("canceled");
    expect(row.founding).toBe(false);
    expect(row.trialEndsAt).toBeNull();
    expect(row.cancelAt).toBeNull();
  });

  it("carries a scheduled cancellation while access continues", () => {
    const row = entitlementFromSubscription(
      {
        status: "trialing",
        customerId: "cus_1",
        subscriptionId: "sub_1",
        trialEnd: 1_800_000_000,
        cancelAt: 1_800_000_000,
        metadata: { plan: "edge" },
        priceId: "price_edge_m",
      },
      catalogue
    );
    expect(row.plan).toBe("edge");
    expect(row.billingStatus).toBe("trialing");
    expect(row.cancelAt).toBe(1_800_000_000_000);
  });

  it("keeps the paid plan on past_due", () => {
    const row = entitlementFromSubscription(
      {
        status: "past_due",
        priceId: "price_core_m",
      },
      catalogue
    );
    expect(row.plan).toBe("core");
    expect(row.billingStatus).toBe("past_due");
  });

  it("falls back to metadata when the price is not in this env", () => {
    const row = entitlementFromSubscription(
      {
        status: "active",
        priceId: "price_from_another_account",
        metadata: { plan: "edge" },
      },
      catalogue
    );
    expect(row.plan).toBe("edge");
  });
});

describe("clerkUserIdFromStripe", () => {
  it("prefers metadata over client_reference_id", () => {
    expect(
      clerkUserIdFromStripe({
        clientReferenceId: "user_ref",
        metadata: { clerkUserId: "user_meta" },
      })
    ).toBe("user_meta");
    expect(clerkUserIdFromStripe({ clientReferenceId: "user_ref" })).toBe(
      "user_ref"
    );
  });
});
