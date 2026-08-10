/**
 * Systems Desk entitlement. Core+ like the other desks; has its own feature
 * id in the N0 matrix so it can diverge later without a refactor.
 */

import { canWithPreview, type PlanPreview } from "./plans";

export function canUseSystemsDesk(
  settings?: { planPreview?: PlanPreview | null } | null
): boolean {
  return canWithPreview(settings, "systems_desk");
}
