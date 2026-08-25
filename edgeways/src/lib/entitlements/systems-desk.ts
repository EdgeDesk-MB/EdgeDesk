/**
 * Systems Desk entitlement. Core+ like the other desks; has its own feature
 * id in the N0 matrix so it can diverge later without a refactor.
 */

import { canDesk, type DeskGateSettings } from "./effective-plan";

export function canUseSystemsDesk(settings?: DeskGateSettings): boolean {
  return canDesk(settings, "systems_desk");
}
