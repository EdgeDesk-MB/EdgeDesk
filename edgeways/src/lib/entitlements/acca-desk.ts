/**
 * Acca Desk entitlement. Core+ in the N0 matrix; Free preview falls back to
 * Add bet. Delegates to the central matrix in plans.ts (EDGE-17).
 */

import { canWithPreview, type PlanPreview } from "./plans";

export type { PlanPreview };

export function canUseAccaDesk(
  settings?: { planPreview?: PlanPreview | null } | null
): boolean {
  return canWithPreview(settings, "acca_desk");
}
