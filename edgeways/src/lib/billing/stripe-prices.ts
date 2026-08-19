/**
 * Stripe test-mode catalogue (EDGE-3).
 * Price IDs come from env. Trial is Checkout `subscription_data.trial_period_days`,
 * not a Price. Founding is an account term, not a public card.
 */
import type { PlanId } from "@/lib/entitlements/plans";
import {
  PUBLIC_PLANS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  type BillingInterval,
} from "@/lib/billing/public-offer";

export const STRIPE_PRODUCTS = {
  core: "edgeways_core",
  edge: "edgeways_edge",
} as const;

export type StripePriceSlot =
  | "core_month"
  | "core_year"
  | "edge_month"
  | "edge_year"
  | "edge_founding_month";

export const STRIPE_LOOKUP_KEYS: Record<StripePriceSlot, string> = {
  core_month: "core_month",
  core_year: "core_year",
  edge_month: "edge_month",
  edge_year: "edge_year",
  edge_founding_month: "edge_founding_month",
};

/** Integer pence. Must match PUBLIC_PLANS + Founding = Core monthly. */
export const STRIPE_PRICE_PENCE = {
  core_month: 999,
  core_year: 9990,
  edge_month: 2499,
  edge_year: 24990,
  edge_founding_month: 999,
} as const satisfies Record<StripePriceSlot, number>;

const ENV_KEYS: Record<StripePriceSlot, string> = {
  core_month: "STRIPE_PRICE_CORE_MONTH",
  core_year: "STRIPE_PRICE_CORE_YEAR",
  edge_month: "STRIPE_PRICE_EDGE_MONTH",
  edge_year: "STRIPE_PRICE_EDGE_YEAR",
  edge_founding_month: "STRIPE_PRICE_EDGE_FOUNDING_MONTH",
};

export type PaidPlanId = Exclude<PlanId, "free">;

export function stripePriceEnvKey(slot: StripePriceSlot): string {
  return ENV_KEYS[slot];
}

export function stripePriceId(slot: StripePriceSlot): string | null {
  const raw = process.env[ENV_KEYS[slot]]?.trim();
  return raw || null;
}

export function publicStripePriceSlot(
  plan: PaidPlanId,
  interval: BillingInterval
): Exclude<StripePriceSlot, "edge_founding_month"> {
  return `${plan}_${interval}` as Exclude<StripePriceSlot, "edge_founding_month">;
}

export function publicStripePriceId(
  plan: PaidPlanId,
  interval: BillingInterval
): string | null {
  return stripePriceId(publicStripePriceSlot(plan, interval));
}

export function foundingStripePriceId(): string | null {
  return stripePriceId("edge_founding_month");
}

export function publicCatalogueReady(): boolean {
  return (
    Boolean(stripePriceId("core_month")) &&
    Boolean(stripePriceId("core_year")) &&
    Boolean(stripePriceId("edge_month")) &&
    Boolean(stripePriceId("edge_year"))
  );
}

/** 14-day Edge trial on Checkout. Core and Free get none. */
export function trialPeriodDaysForCheckout(plan: PlanId): number {
  return plan === TRIAL_PLAN ? TRIAL_DAYS : 0;
}

export function listPenceForSlot(slot: StripePriceSlot): number {
  if (slot === "edge_founding_month") {
    const core = PUBLIC_PLANS.find((plan) => plan.id === "core");
    return core?.monthlyPence ?? STRIPE_PRICE_PENCE.edge_founding_month;
  }
  const [planId, interval] = slot.split("_") as [PaidPlanId, BillingInterval];
  const plan = PUBLIC_PLANS.find((row) => row.id === planId);
  if (!plan) return STRIPE_PRICE_PENCE[slot];
  return interval === "year" ? plan.annualPence : plan.monthlyPence;
}
