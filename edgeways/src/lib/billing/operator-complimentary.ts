/**
 * Operator accounts (bootstrap admin / role=admin) keep Edge without Stripe.
 * Desk gates already resolve operators to Edge; this persists that grant so
 * Settings, /admin/subscribers, and checkout agree with the desk.
 */
import { isOperatorAdmin } from "@/lib/admin/emails";
import { billingStatusIsLive } from "@/lib/billing/checkout-session";
import type { AppUserEntitlement } from "@/lib/billing/entitlement-from-stripe";
import type { SubscriptionAccount } from "@/lib/billing/subscription-view";

export const COMPLIMENTARY_OPERATOR_ENTITLEMENT: AppUserEntitlement = {
  plan: "edge",
  billingStatus: "active",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  trialEndsAt: null,
  cancelAt: null,
  founding: false,
};

export function needsComplimentaryOperatorGrant(user: {
  email: string | null | undefined;
  role: string | null | undefined;
  plan: string;
  billingStatus: string;
  stripeCustomerId: string | null | undefined;
  stripeSubscriptionId?: string | null;
}): boolean {
  if (!isOperatorAdmin({ email: user.email, role: user.role })) return false;
  if (user.stripeCustomerId || user.stripeSubscriptionId) return false;
  return user.plan === "free" || !billingStatusIsLive(user.billingStatus);
}

/** Settings / billing API: operators without a live paid row still read as Edge. */
export function overlayOperatorSubscriptionAccount(
  user: { email: string | null | undefined; role: string | null | undefined } | undefined,
  account: SubscriptionAccount
): SubscriptionAccount {
  if (!user || !isOperatorAdmin(user)) return account;
  if (
    billingStatusIsLive(account.billingStatus) &&
    (account.plan === "edge" || account.plan === "core")
  ) {
    return account;
  }
  return { ...account, plan: "edge", billingStatus: "active" };
}

/** Do not start a paid Checkout for an operator who has no Stripe customer. */
export function shouldBlockComplimentaryOperatorCheckout(input: {
  operator: boolean;
  stripeCustomerId: string | null | undefined;
  listedStripeCustomerId: string | null | undefined;
}): boolean {
  if (!input.operator) return false;
  return !input.stripeCustomerId && !input.listedStripeCustomerId;
}

/** Admin subscribers billing column. Complimentary grants have no Stripe customer. */
export function adminBillingStatusLabel(user: {
  plan: string;
  billingStatus: string;
  stripeCustomerId: string | null | undefined;
}): string {
  if (
    (user.plan === "edge" || user.plan === "core") &&
    billingStatusIsLive(user.billingStatus) &&
    !user.stripeCustomerId
  ) {
    return "Complimentary";
  }
  return user.billingStatus.replace("_", " ");
}
