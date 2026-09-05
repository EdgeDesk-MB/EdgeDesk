/**
 * N0 entitlement matrix (docs/roadmap/implementation-briefs.md, brief N0;
 * pricing intent in product-roadmap.md §7.5). Single source of truth for
 * "which plan can use which feature". Core must stay useful without feeds;
 * Edge is where API cost and modelled picks live.
 *
 * Profit Tracker (`/tracker`) is the Free bet log: list, settle, wallets,
 * and basic P&L. It is gated on `calculators`, not `offers_pipeline`. Core
 * still owns campaigns, lots, Do Next, and the combo desks.
 *
 * `PlanPreview` adds "unlocked" — Sam's daily default until billing exists —
 * which allows everything. Real enforcement replaces the preview in EDGE-22.
 */

import { FEATURES, type FeatureFlag } from "./features";

export type PlanId = "free" | "core" | "edge";
export type PlanPreview = PlanId | "unlocked";

const FREE: readonly FeatureFlag[] = ["calculators", "demo_data"];
const CORE: readonly FeatureFlag[] = [
  ...FREE,
  "offers_pipeline",
  "do_next",
  "acca_desk",
  "bet_builder_desk",
  "systems_desk",
];
const EDGE: readonly FeatureFlag[] = [
  ...CORE,
  "offer_edge",
  "racing_live_feeds",
  "football_live_feeds",
  "push_alerts",
  "exchange_lay",
];

export const ENTITLEMENTS: Record<PlanId, readonly FeatureFlag[]> = {
  free: FREE,
  core: CORE,
  edge: EDGE,
};

export function can(plan: PlanId, feature: FeatureFlag): boolean {
  return ENTITLEMENTS[plan].includes(feature);
}

/**
 * Preview-aware check used by the desk stubs. Missing settings or
 * "unlocked" allow everything, preserving pre-N0 behaviour exactly.
 */
export function canWithPreview(
  settings: { planPreview?: PlanPreview | null } | null | undefined,
  feature: FeatureFlag
): boolean {
  const preview = settings?.planPreview ?? "unlocked";
  if (preview === "unlocked") return true;
  return can(preview, feature);
}

/** Lowest plan that includes a feature (for lock copy). */
export function requiredPlan(feature: FeatureFlag): PlanId {
  if (can("free", feature)) return "free";
  if (can("core", feature)) return "core";
  return "edge";
}

/** Every flag is entitled somewhere — guards against orphan ids. */
export function allFeatures(): readonly FeatureFlag[] {
  return FEATURES;
}
