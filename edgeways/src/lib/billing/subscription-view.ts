/**
 * Settings → Subscription copy (EDGE-58).
 * Portal leftovers (upgrade/downgrade, Founding schedule) stay EDGE-4.
 */
import type { PlanId } from "@/lib/entitlements/plans";
import type { BillingStatus } from "@/lib/billing/entitlement-from-stripe";
import { receiptDateLabel } from "@/lib/billing/receipt-view";

export const SETTINGS_SUBSCRIPTION_HREF = "/settings?tab=subscription";

export type SubscriptionAccount = {
  plan: PlanId;
  billingStatus: BillingStatus;
  trialEndsAt: number | null;
  /** Scheduled cancellation (epoch ms) while access continues. */
  cancelAt: number | null;
  founding: boolean;
  canManage: boolean;
};

export function subscriptionAccountFromUser(
  user:
    | {
        plan: PlanId;
        billingStatus: BillingStatus;
        trialEndsAt: number | null;
        cancelAt: number | null;
        founding: boolean;
        stripeCustomerId: string | null;
      }
    | undefined
): SubscriptionAccount {
  if (!user) {
    return {
      plan: "free",
      billingStatus: "none",
      trialEndsAt: null,
      cancelAt: null,
      founding: false,
      canManage: false,
    };
  }
  return {
    plan: user.plan,
    billingStatus: user.billingStatus,
    trialEndsAt: user.trialEndsAt,
    cancelAt: user.cancelAt,
    founding: user.founding,
    canManage: Boolean(user.stripeCustomerId),
  };
}

export function planDisplayName(plan: PlanId): string {
  if (plan === "edge") return "Edge";
  if (plan === "core") return "Core";
  return "Free";
}

export function billingStatusLabel(status: BillingStatus): string {
  if (status === "trialing") return "Trial";
  if (status === "active") return "Active";
  if (status === "past_due") return "Payment failed";
  if (status === "canceled") return "Cancelled";
  return "No subscription";
}

/** A cancellation is scheduled but access continues until cancelAt. */
export function isCancelling(account: SubscriptionAccount): boolean {
  return (
    account.cancelAt != null &&
    (account.billingStatus === "trialing" ||
      account.billingStatus === "active" ||
      account.billingStatus === "past_due")
  );
}

export function billingStatusBadgeVariant(
  status: BillingStatus
): "success" | "destructive" | "outline" {
  if (status === "active") return "success";
  if (status === "past_due") return "destructive";
  return "outline";
}

export function subscriptionDateLabel(ms: number): string {
  return receiptDateLabel(Math.floor(ms / 1000));
}

export function subscriptionDetail(account: SubscriptionAccount): string {
  if (isCancelling(account) && account.cancelAt) {
    const ends = `You keep ${planDisplayName(account.plan)} until ${subscriptionDateLabel(account.cancelAt)}.`;
    return account.billingStatus === "trialing"
      ? `Trial cancelled. ${ends}`
      : `Cancellation scheduled. ${ends}`;
  }
  if (account.billingStatus === "trialing" && account.trialEndsAt) {
    const trial = `Trial ends ${subscriptionDateLabel(account.trialEndsAt)}`;
    return account.founding ? `${trial}. Founding rate after that.` : trial;
  }
  if (account.billingStatus === "trialing") {
    return account.founding ? "Trial is live. Founding rate after that." : "Trial is live.";
  }
  if (account.billingStatus === "past_due") {
    return "Update the card to keep the desk.";
  }
  if (account.billingStatus === "canceled") {
    return "Access continues until the period ends.";
  }
  if (account.founding) return "You are on the founding rate.";
  if (account.plan === "free") return "Calculators and a manual bet log.";
  return "Card, invoices and cancel live with Stripe.";
}

export function showSubscribeActions(account: SubscriptionAccount): boolean {
  return (
    account.plan === "free" ||
    account.billingStatus === "none" ||
    account.billingStatus === "canceled"
  );
}
