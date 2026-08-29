/**
 * Desk path → N0 feature flag. Used by the route gate and lock copy.
 * Only flags that are specified in the matrix (features.ts / §7.5).
 */
import { FEATURE_LABELS, type FeatureFlag } from "./features";
import { requiredPlan, type PlanId } from "./plans";

export function featureForDeskPath(pathname: string): FeatureFlag | null {
  if (pathname.startsWith("/offers")) return "offers_pipeline";
  // Profit Tracker is the Free bet log (list, settle, wallets, basic P&L).
  // Campaigns and lots stay on offers_pipeline / Core.
  if (pathname.startsWith("/tracker")) return "calculators";
  if (pathname.startsWith("/acca")) return "acca_desk";
  if (pathname.startsWith("/bet-builder")) return "bet_builder_desk";
  if (pathname.startsWith("/systems")) return "systems_desk";
  if (pathname.startsWith("/report")) return "do_next";
  return null;
}

export function planDisplayName(plan: PlanId): "Free" | "Core" | "Edge" {
  if (plan === "free") return "Free";
  if (plan === "core") return "Core";
  return "Edge";
}

export function planLockCopy(
  feature: FeatureFlag,
  opts?: { real?: boolean }
): {
  title: string;
  description: string;
} {
  const plan = requiredPlan(feature);
  const name = planDisplayName(plan);
  const also = plan === "core" ? " and Edge" : "";
  return {
    title: `${name} plan`,
    description: opts?.real
      ? `${FEATURE_LABELS[feature]} sits on ${name}${also}. Upgrade in Settings → Subscription to open it.`
      : `${FEATURE_LABELS[feature]} sits on ${name}${also}. Switch the viewing bar to open it.`,
  };
}
