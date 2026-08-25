/**
 * Bet Builder Desk entitlement. Core+ like Acca Desk; has its own feature id
 * in the N0 matrix so it can diverge later without a refactor.
 */

import { canDesk, type DeskGateSettings } from "./effective-plan";

export function canUseBetBuilderDesk(settings?: DeskGateSettings): boolean {
  return canDesk(settings, "bet_builder_desk");
}
