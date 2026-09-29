import { captureServerEvent } from "@/lib/analytics/server-capture";
import type { PaidPlanId } from "@/lib/billing/stripe-prices";

export function upgradeStartedProperties(plan: PaidPlanId) {
  return { plan };
}

/**
 * Loop signal: a user was sent to Stripe Checkout for a paid plan. Sends
 * the plan key only. Never the price, amount, email or Stripe ids.
 */
export function captureUpgradeStarted(input: {
  clerkUserId: string;
  plan: PaidPlanId;
}): void {
  captureServerEvent(
    input.clerkUserId,
    "upgrade_started",
    upgradeStartedProperties(input.plan)
  );
}
