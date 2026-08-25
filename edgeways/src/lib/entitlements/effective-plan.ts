/**
 * EDGE-22: the desk's real gate. `app_users.plan` is written by Stripe
 * webhooks (EDGE-5); this decides what that row means for feature access.
 * Trial and Founding already persist as `edge` — see entitlement-from-stripe.
 * Settings `planPreview` is a preview, never the gate (subscriptions.md §9).
 */
import type { BillingStatus } from "@/lib/billing/entitlement-from-stripe";
import {
  can,
  canWithPreview,
  type PlanId,
  type PlanPreview,
} from "@/lib/entitlements/plans";
import type { FeatureFlag } from "@/lib/entitlements/features";

const PLAN_HONOURED: ReadonlySet<BillingStatus> = new Set([
  "trialing",
  "active",
  "past_due",
]);

/** What the billing row entitles right now. Lapsed/canceled falls to Free. */
export function effectivePlan(input: {
  plan: PlanId;
  billingStatus: BillingStatus;
}): PlanId {
  return PLAN_HONOURED.has(input.billingStatus) ? input.plan : "free";
}

/**
 * Real gate for desk surfaces. Preview may only step *down* from the paid
 * plan (Sam checking what Core/Free look like); it never unlocks above the
 * billing row. Missing preview behaves as the paid plan.
 */
export function canWithPlan(input: {
  plan: PlanId;
  billingStatus: BillingStatus;
  planPreview?: PlanPreview | null;
  feature: FeatureFlag;
}): boolean {
  const paid = effectivePlan(input);
  const preview = input.planPreview;
  if (preview == null || preview === "unlocked") return can(paid, input.feature);
  // "unlocked" was Sam's pre-billing default; treated as the paid plan above.
  // Any concrete preview below the paid plan gates as that plan.
  const previewRank = rank(preview);
  const paidRank = rank(paid);
  const gated = previewRank < paidRank ? preview : paid;
  return can(gated, input.feature);
}

function rank(plan: PlanId): number {
  if (plan === "edge") return 2;
  if (plan === "core") return 1;
  return 0;
}

/** Server-resolved billing row injected into the settings payload. */
export type EntitlementBilling = {
  plan: PlanId;
  billingStatus: BillingStatus;
};

/** Structural shape the desk gate needs from settings state. */
export type DeskGateSettings = {
  planPreview?: PlanPreview | null;
  billing?: EntitlementBilling | null;
} | null | undefined;

/**
 * The desk gate. When the server injected a billing row (any signed-in
 * session) the real plan decides; preview may only step down. Without a
 * billing row (public demo, signed out) keep the legacy preview behaviour so
 * the demo desk still shows everything.
 */
export function canDesk(
  settings: DeskGateSettings,
  feature: FeatureFlag
): boolean {
  const billing = settings?.billing;
  if (!billing) return canWithPreview(settings, feature);
  return canWithPlan({
    plan: billing.plan,
    billingStatus: billing.billingStatus,
    planPreview: settings?.planPreview,
    feature,
  });
}
