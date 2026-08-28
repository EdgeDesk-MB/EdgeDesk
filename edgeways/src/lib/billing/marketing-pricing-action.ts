import { billingStatusIsLive } from "@/lib/billing/checkout-session";
import type { SubscriptionAccount } from "@/lib/billing/subscription-view";

export type MarketingPricingAction = "pending" | "checkout" | "manage";

/**
 * Homepage plan CTAs. Hold checkout until we know the visitor is not a live
 * subscriber, so signed-in users never flash “Start trial” on three cards.
 */
export function marketingPricingAction(input: {
  authLoaded: boolean;
  signedIn: boolean;
  billingLoaded: boolean;
  liveSubscriber: boolean;
}): MarketingPricingAction {
  if (!input.authLoaded) return "pending";
  if (!input.signedIn) return "checkout";
  if (!input.billingLoaded) return "pending";
  return input.liveSubscriber ? "manage" : "checkout";
}

export function isLiveSubscriberAccount(
  account: SubscriptionAccount | null | undefined
): boolean {
  return billingStatusIsLive(account?.billingStatus);
}
