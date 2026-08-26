/**
 * EDGE-83: when to 403 a gated feed. EDGE-89: fail closed — no billing row
 * (signed out, no app_users row, or a Clerk/Neon lookup failure) denies the
 * feed. Guarded routes answer 403 with the canned locked payload, so a
 * transient blip shows the locked state rather than spending operator keys.
 */
import { canDesk, type EntitlementBilling } from "./effective-plan";
import type { FeatureFlag } from "./features";

export function shouldDenyFeed(
  billing: EntitlementBilling | null | undefined,
  feature: FeatureFlag
): boolean {
  if (billing == null) return true;
  return !canDesk({ billing }, feature);
}
