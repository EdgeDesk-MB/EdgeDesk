/**
 * Acca Desk entitlement. Core+ in the N0 matrix; Free preview falls back to
 * Add bet. Delegates to the central matrix in plans.ts (EDGE-17).
 */

import { canDesk, type DeskGateSettings } from "./effective-plan";
import type { PlanPreview } from "./plans";

export type { PlanPreview };

export function canUseAccaDesk(settings?: DeskGateSettings): boolean {
  return canDesk(settings, "acca_desk");
}
