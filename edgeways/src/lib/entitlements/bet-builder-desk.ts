/**
 * Bet Builder Desk entitlement. Core+ like Acca Desk; has its own feature id
 * in the N0 matrix so it can diverge later without a refactor.
 */

import { canWithPreview, type PlanPreview } from "./plans";

export function canUseBetBuilderDesk(
  settings?: { planPreview?: PlanPreview | null } | null
): boolean {
  return canWithPreview(settings, "bet_builder_desk");
}
