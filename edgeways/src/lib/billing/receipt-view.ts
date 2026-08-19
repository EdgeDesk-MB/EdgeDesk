import {
  formatGbpFromPence,
  PUBLIC_PLANS,
  TRIAL_DAYS,
  type BillingInterval,
} from "@/lib/billing/public-offer";
import { STRIPE_PRICE_PENCE } from "@/lib/billing/stripe-prices";

export type CheckoutReceiptSource = {
  id: string;
  amount_total: number | null;
  created: number;
  customer_details?: { email?: string | null } | null;
  metadata?: { plan?: string; interval?: string; founding?: string } | null;
  subscription?:
    | string
    | {
        trial_end?: number | null;
        current_period_end?: number | null;
      }
    | null;
};

export type SubscribeReceiptView = {
  planName: string;
  intervalLabel: string;
  paidToday: string;
  nextCharge: string | null;
  nextChargeOn: string | null;
  trialNote: string | null;
  reference: string | null;
  dateLabel: string;
  email: string | null;
  headline: string;
  nextStep: string;
};

export function receiptReference(sessionId: string): string {
  const compact = sessionId.replace(/^cs_(test|live)_/i, "");
  return compact.slice(-10).toUpperCase();
}

export function receiptDateLabel(createdUnix: number): string {
  return new Date(createdUnix * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Stripe unix seconds for the first paid invoice after checkout. */
export function nextChargeUnixSeconds(
  subscription: CheckoutReceiptSource["subscription"]
): number | null {
  if (!subscription || typeof subscription === "string") return null;
  if (typeof subscription.trial_end === "number" && subscription.trial_end > 0) {
    return subscription.trial_end;
  }
  if (
    typeof subscription.current_period_end === "number" &&
    subscription.current_period_end > 0
  ) {
    return subscription.current_period_end;
  }
  return null;
}

export function receiptHeadline(
  planId: string | undefined,
  trial = false
): string {
  if (planId === "edge" && trial) return `Your ${TRIAL_DAYS} days start now`;
  if (planId === "edge") return "Edge is live";
  if (planId === "core") return "Core is live";
  return "You're in";
}

export function receiptNextStep(from?: "setup" | null): string {
  if (from === "setup") {
    return "Close this tab and continue setup in the other one.";
  }
  return "Add your bank and bookies to start";
}

export function buildReceiptFromOffer(
  planId: "core" | "edge",
  interval: BillingInterval,
  extras?: {
    sessionId?: string | null;
    email?: string | null;
    created?: number;
    amountTotal?: number | null;
    nextChargeUnix?: number | null;
    founding?: boolean;
  }
): SubscribeReceiptView {
  const plan = PUBLIC_PLANS.find((row) => row.id === planId);
  const yearly = interval === "year";
  const founding = extras?.founding === true && planId === "edge" && !yearly;
  const nextPence = founding
    ? STRIPE_PRICE_PENCE.edge_founding_month
    : plan
      ? yearly
        ? plan.annualPence
        : plan.monthlyPence
      : null;
  const paidTodayPence =
    extras?.amountTotal != null
      ? extras.amountTotal
      : planId === "edge"
        ? 0
        : (nextPence ?? 0);
  const trial = planId === "edge" && paidTodayPence === 0;
  const trialNote = trial
    ? founding
      ? `${TRIAL_DAYS} days of Edge, then founding rate for 3 months`
      : `${TRIAL_DAYS} days of Edge, then list price`
    : null;

  return {
    planName: plan?.name ?? "Subscription",
    intervalLabel: yearly ? "Yearly" : "Monthly",
    paidToday: formatGbpFromPence(paidTodayPence),
    nextCharge:
      nextPence != null
        ? `${formatGbpFromPence(nextPence)}${yearly ? "/yr" : "/mo"}`
        : null,
    nextChargeOn:
      extras?.nextChargeUnix != null
        ? receiptDateLabel(extras.nextChargeUnix)
        : null,
    trialNote,
    reference: extras?.sessionId ? receiptReference(extras.sessionId) : null,
    dateLabel: receiptDateLabel(extras?.created ?? Date.now() / 1000),
    email: extras?.email?.trim() || null,
    headline: receiptHeadline(planId, trial),
    nextStep: receiptNextStep(),
  };
}

export function buildSubscribeReceipt(
  session: CheckoutReceiptSource
): SubscribeReceiptView | null {
  const planId = session.metadata?.plan;
  const interval = session.metadata?.interval as BillingInterval | undefined;
  if (planId !== "core" && planId !== "edge") return null;
  if (interval !== "month" && interval !== "year") return null;
  return buildReceiptFromOffer(planId, interval, {
    sessionId: session.id,
    email: session.customer_details?.email,
    created: session.created,
    amountTotal: session.amount_total,
    nextChargeUnix: nextChargeUnixSeconds(session.subscription),
    founding: session.metadata?.founding === "true",
  });
}
