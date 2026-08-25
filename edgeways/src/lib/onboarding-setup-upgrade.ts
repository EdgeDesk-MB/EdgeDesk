import type { PlanId } from "@/lib/entitlements/plans";
import { planMeetsTarget } from "@/lib/onboarding-profile";

export const SETUP_PLAN_BASELINE_KEY = "ew-setup-plan-baseline";
export const SETUP_UPGRADE_INTENT_KEY = "ew-setup-upgrade-intent";
export const SETUP_UPGRADE_CONFIRMED_KEY = "ew-setup-upgrade-confirmed";

export function parseStoredPlanId(
  value: string | null | undefined
): PlanId | null {
  return value === "free" || value === "core" || value === "edge" ? value : null;
}

function scopedKey(base: string, userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${base}:${id}` : base;
}

function readSessionPlan(key: string): PlanId | null {
  try {
    return parseStoredPlanId(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeSessionPlan(key: string, plan: PlanId) {
  try {
    sessionStorage.setItem(key, plan);
  } catch {
    /* private mode */
  }
}

export function readSetupPlanBaseline(userId?: string | null): PlanId | null {
  return readSessionPlan(scopedKey(SETUP_PLAN_BASELINE_KEY, userId));
}

export function writeSetupPlanBaselineIfEmpty(
  plan: PlanId,
  userId?: string | null
): PlanId {
  const stored = readSetupPlanBaseline(userId);
  if (stored) return stored;
  writeSessionPlan(scopedKey(SETUP_PLAN_BASELINE_KEY, userId), plan);
  return plan;
}

export function readSetupUpgradeIntent(userId?: string | null): PlanId | null {
  return readSessionPlan(scopedKey(SETUP_UPGRADE_INTENT_KEY, userId));
}

export function writeSetupUpgradeIntent(plan: PlanId, userId?: string | null) {
  writeSessionPlan(scopedKey(SETUP_UPGRADE_INTENT_KEY, userId), plan);
}

export function readSetupUpgradeConfirmed(userId?: string | null): PlanId | null {
  try {
    const raw = localStorage.getItem(SETUP_UPGRADE_CONFIRMED_KEY);
    if (!raw) return null;
    const plain = parseStoredPlanId(raw);
    if (plain) return userId ? null : plain;
    const parsed = JSON.parse(raw) as { plan?: unknown; userId?: unknown };
    const plan = parseStoredPlanId(typeof parsed.plan === "string" ? parsed.plan : null);
    if (!plan) return null;
    const storedUser =
      typeof parsed.userId === "string" && parsed.userId.trim()
        ? parsed.userId
        : null;
    if (userId && storedUser !== userId) return null;
    if (userId && !storedUser) return null;
    return plan;
  } catch {
    return null;
  }
}

export function writeSetupUpgradeConfirmed(plan: PlanId, userId?: string | null) {
  try {
    localStorage.setItem(
      SETUP_UPGRADE_CONFIRMED_KEY,
      JSON.stringify({ plan, userId: userId ?? null })
    );
  } catch {
    /* private mode */
  }
}

export function clearSetupUpgradeSignals(userId?: string | null) {
  try {
    sessionStorage.removeItem(SETUP_PLAN_BASELINE_KEY);
    sessionStorage.removeItem(SETUP_UPGRADE_INTENT_KEY);
    sessionStorage.removeItem(scopedKey(SETUP_PLAN_BASELINE_KEY, userId));
    sessionStorage.removeItem(scopedKey(SETUP_UPGRADE_INTENT_KEY, userId));
    localStorage.removeItem(SETUP_UPGRADE_CONFIRMED_KEY);
  } catch {
    /* ignore */
  }
}

export function readSetupUpgradeSignals(userId?: string | null): {
  baseline: PlanId | null;
  intent: PlanId | null;
  confirmed: PlanId | null;
} {
  return {
    baseline: readSetupPlanBaseline(userId),
    intent: readSetupUpgradeIntent(userId),
    confirmed: readSetupUpgradeConfirmed(userId),
  };
}

/** Prefer the checkout tab's plan when billing has not caught up yet. */
export function resolveSetupDisplayPlan(
  current: PlanId | null,
  confirmed: PlanId | null
): PlanId | null {
  if (!current) return confirmed;
  if (!confirmed) return current;
  return planMeetsTarget(current, confirmed) ? current : confirmed;
}

export type SetupUpgradeSuccess = {
  plan: PlanId;
  /** True when the upgrade happened inside the setup flow (clicked the
   * in-page upgrade button or returned from a setup checkout). False when
   * they arrived already subscribed — celebrate the subscription, not an
   * upgrade they never made here. */
  inFlow: boolean;
};

/**
 * Plan to celebrate on the features step, or null if this visit is not an
 * upgrade moment. Checkout confirmation wins so a remount after Stripe
 * still shows the message when billing already returns the new tier.
 */
export function setupUpgradeSuccess(input: {
  currentPlan: PlanId | null;
  baseline: PlanId | null;
  confirmed: PlanId | null;
  intent: PlanId | null;
}): SetupUpgradeSuccess | null {
  if (input.confirmed) {
    const plan =
      input.currentPlan && planMeetsTarget(input.currentPlan, input.confirmed)
        ? input.currentPlan
        : input.confirmed;
    return { plan, inFlow: true };
  }
  const roseAboveBaseline =
    Boolean(input.baseline) &&
    Boolean(input.currentPlan) &&
    input.currentPlan !== input.baseline &&
    planMeetsTarget(input.currentPlan!, input.baseline!);
  if (
    input.intent &&
    input.currentPlan &&
    roseAboveBaseline &&
    planMeetsTarget(input.currentPlan, input.intent)
  ) {
    return { plan: input.currentPlan, inFlow: true };
  }
  if (roseAboveBaseline) return { plan: input.currentPlan!, inFlow: false };
  return null;
}
