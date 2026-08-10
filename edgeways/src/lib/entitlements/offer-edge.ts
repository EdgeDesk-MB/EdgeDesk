/**
 * Offer Edge / Race picks entitlement. Edge-tier only (plus unlocked preview);
 * Free and Core stay locked out. Delegates to the central matrix in plans.ts.
 */

import { canWithPreview, type PlanPreview } from "./plans";

export function canUseOfferEdge(
  settings?: { planPreview?: PlanPreview | null } | null
): boolean {
  return canWithPreview(settings, "offer_edge");
}
