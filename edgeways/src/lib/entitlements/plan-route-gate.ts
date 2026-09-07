import type { AppSettings } from "@/lib/services/settings-shared";
import { canDesk } from "@/lib/entitlements/effective-plan";
import { featureForDeskPath } from "@/lib/entitlements/nav";
import { requiredPlan } from "@/lib/entitlements/plans";

export type PlanGatePhase = "pass" | "lock" | "wait" | "error";

/**
 * First paint must not block Core/Edge desks on /api/state when chrome
 * already has settings. A failed first fetch must surface retry, not spin.
 */
export function planGatePhase(input: {
  pathname: string;
  settings: Pick<AppSettings, "billing" | "planPreview"> | null | undefined;
  hasState: boolean;
  error: string | null;
}): PlanGatePhase {
  const feature = featureForDeskPath(input.pathname);
  if (!feature || requiredPlan(feature) === "free") return "pass";
  if (input.settings && canDesk(input.settings, feature)) return "pass";
  if (input.settings && !canDesk(input.settings, feature)) return "lock";
  if (input.error && !input.hasState) return "error";
  return "wait";
}
