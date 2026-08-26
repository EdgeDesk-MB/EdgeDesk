/**
 * EDGE-83: when to 403 a gated feed. Fail open with no billing row so a
 * Clerk/Neon blip never locks a paying user, matching `/api/offers/edge`.
 */
import { canDesk, type EntitlementBilling } from "./effective-plan";
import type { FeatureFlag } from "./features";

export function shouldDenyFeed(
  billing: EntitlementBilling | null | undefined,
  feature: FeatureFlag
): boolean {
  return billing != null && !canDesk({ billing }, feature);
}
