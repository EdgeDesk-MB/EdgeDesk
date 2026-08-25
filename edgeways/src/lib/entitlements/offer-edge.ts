/**
 * Offer Edge / Race picks entitlement. Edge-tier only (plus unlocked preview);
 * Free and Core stay locked out. Delegates to the central matrix in plans.ts.
 */

import { canDesk, type DeskGateSettings } from "./effective-plan";

export function canUseOfferEdge(settings?: DeskGateSettings): boolean {
  return canDesk(settings, "offer_edge");
}
