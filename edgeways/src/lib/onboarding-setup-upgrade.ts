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

export function readSetupPlanBaseline(): PlanId | null {
  return readSessionPlan(SETUP_PLAN_BASELINE_KEY);
}

export function writeSetupPlanBaselineIfEmpty(plan: PlanId): PlanId {
  const stored = readSetupPlanBaseline();
  if (stored) return stored;
  writeSessionPlan(SETUP_PLAN_BASELINE_KEY, plan);
  return plan;
}

export function readSetupUpgradeIntent(): PlanId | null {
  return readSessionPlan(SETUP_UPGRADE_INTENT_KEY);
}

export function writeSetupUpgradeIntent(plan: PlanId) {
  writeSessionPlan(SETUP_UPGRADE_INTENT_KEY, plan);
}

export function readSetupUpgradeConfirmed(userId?: string | null): PlanId | null {
  try {
    const raw = localStorage.getItem(SETUP_UPGRADE_CONFIRMED_KEY);
    if (!raw) return null;
    const plain = parseStoredPlanId(raw);
    if (plain) return plain;
    const parsed = JSON.parse(raw) as { plan?: unknown; userId?: unknown };
    const plan = parseStoredPlanId(typeof parsed.plan === "string" ? parsed.plan : null);
    if (!plan) return null;
    if (
      typeof parsed.userId === "string" &&
      userId &&
      parsed.userId !== userId
    ) {
      return null;
    }
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

export function clearSetupUpgradeSignals() {
  try {
    sessionStorage.removeItem(SETUP_PLAN_BASELINE_KEY);
    sessionStorage.removeItem(SETUP_UPGRADE_INTENT_KEY);
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
    baseline: readSetupPlanBaseline(),
    intent: readSetupUpgradeIntent(),
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

/**
 * Plan to celebrate on the features step, or null if this visit is not an
 * in-flow upgrade. Checkout confirmation wins so a remount after Stripe
 * still shows the message when billing already returns the new tier.
 */
export function setupUpgradeSuccessPlan(input: {
  currentPlan: PlanId | null;
  baseline: PlanId | null;
  confirmed: PlanId | null;
  intent: PlanId | null;
}): PlanId | null {
  if (input.confirmed) {
    if (!input.currentPlan) return input.confirmed;
    return planMeetsTarget(input.currentPlan, input.confirmed)
      ? input.currentPlan
      : input.confirmed;
  }
  if (
    input.intent &&
    input.currentPlan &&
    planMeetsTarget(input.currentPlan, input.intent)
  ) {
    return input.currentPlan;
  }
  if (
    input.baseline &&
    input.currentPlan &&
    input.currentPlan !== input.baseline &&
    planMeetsTarget(input.currentPlan, input.baseline)
  ) {
    return input.currentPlan;
  }
  return null;
}
