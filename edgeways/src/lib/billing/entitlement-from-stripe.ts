/**
 * Map a Stripe subscription onto the N0 plan id (EDGE-5).
 * Desk feature locks stay EDGE-22 — this only decides what to persist.
 */
import type { PlanId } from "@/lib/entitlements/plans";
import { stripePriceId } from "@/lib/billing/stripe-prices";

export type BillingStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type AppUserEntitlement = {
  plan: PlanId;
  billingStatus: BillingStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: number | null;
  /** Scheduled cancellation (epoch ms) while access continues. Null when
   * the subscription is not pending cancellation. */
  cancelAt: number | null;
  founding: boolean;
};

export type PriceCatalogue = {
  core: readonly string[];
  edge: readonly string[];
  founding: readonly string[];
};

export type StripeEntitlementSource = {
  status: string | null | undefined;
  customerId?: string | null;
  subscriptionId?: string | null;
  trialEnd?: number | null;
  /** Unix seconds. Set when a cancellation is scheduled (cancel_at, or
   * cancel_at_period_end resolved to the item's period end). */
  cancelAt?: number | null;
  metadata?: { plan?: string | null; clerkUserId?: string | null } | null;
  priceId?: string | null;
};

const PAID_DOWN: ReadonlySet<string> = new Set([
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

export function catalogueFromEnv(): PriceCatalogue {
  return {
    core: compact([stripePriceId("core_month"), stripePriceId("core_year")]),
    edge: compact([stripePriceId("edge_month"), stripePriceId("edge_year")]),
    founding: compact([stripePriceId("edge_founding_month")]),
  };
}

export function planFromPriceId(
  priceId: string | null | undefined,
  catalogue: PriceCatalogue
): PlanId | null {
  if (!priceId) return null;
  if (catalogue.founding.includes(priceId)) return "edge";
  if (catalogue.edge.includes(priceId)) return "edge";
  if (catalogue.core.includes(priceId)) return "core";
  return null;
}

export function clerkUserIdFromStripe(source: {
  clientReferenceId?: string | null;
  metadata?: { clerkUserId?: string | null } | null;
}): string | null {
  const fromMeta = source.metadata?.clerkUserId?.trim();
  if (fromMeta) return fromMeta;
  const fromRef = source.clientReferenceId?.trim();
  return fromRef || null;
}

export function entitlementFromSubscription(
  source: StripeEntitlementSource,
  catalogue: PriceCatalogue
): AppUserEntitlement {
  const status = source.status ?? "";
  const founding = Boolean(
    source.priceId && catalogue.founding.includes(source.priceId)
  );
  const fromPrice = planFromPriceId(source.priceId, catalogue);
  const fromMeta =
    source.metadata?.plan === "core" || source.metadata?.plan === "edge"
      ? source.metadata.plan
      : null;
  const paidPlan = fromPrice ?? fromMeta;

  if (PAID_DOWN.has(status)) {
    return {
      plan: "free",
      billingStatus: "canceled",
      stripeCustomerId: source.customerId ?? null,
      stripeSubscriptionId: source.subscriptionId ?? null,
      trialEndsAt: null,
      cancelAt: null,
      founding: false,
    };
  }

  if (status === "trialing") {
    return {
      plan: "edge",
      billingStatus: "trialing",
      stripeCustomerId: source.customerId ?? null,
      stripeSubscriptionId: source.subscriptionId ?? null,
      trialEndsAt: unixSecondsToMs(source.trialEnd),
      cancelAt: unixSecondsToMs(source.cancelAt),
      founding,
    };
  }

  const billingStatus: BillingStatus =
    status === "past_due" ? "past_due" : status === "active" ? "active" : "none";

  return {
    plan: paidPlan ?? "free",
    billingStatus: paidPlan ? billingStatus : "none",
    stripeCustomerId: source.customerId ?? null,
    stripeSubscriptionId: source.subscriptionId ?? null,
    trialEndsAt: unixSecondsToMs(source.trialEnd),
    cancelAt: unixSecondsToMs(source.cancelAt),
    founding,
  };
}

function unixSecondsToMs(value: number | null | undefined): number | null {
  if (value == null || value <= 0) return null;
  return value * 1000;
}

export function sourceFromStripeSubscription(sub: {
  id: string;
  status: string;
  customer: string | { id?: string } | null;
  trial_end?: number | null;
  cancel_at?: number | null;
  cancel_at_period_end?: boolean | null;
  metadata?: { plan?: string; clerkUserId?: string } | null;
  items: {
    data: Array<{
      price?: { id?: string } | null;
      current_period_end?: number | null;
    }>;
  };
}): StripeEntitlementSource {
  const customer =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  const item = sub.items.data[0];
  return {
    status: sub.status,
    customerId: customer,
    subscriptionId: sub.id,
    trialEnd: sub.trial_end ?? null,
    cancelAt:
      sub.cancel_at ??
      (sub.cancel_at_period_end ? (item?.current_period_end ?? null) : null),
    metadata: sub.metadata ?? null,
    priceId: item?.price?.id ?? null,
  };
}

function compact(ids: Array<string | null>): string[] {
  return ids.filter((id): id is string => Boolean(id));
}
