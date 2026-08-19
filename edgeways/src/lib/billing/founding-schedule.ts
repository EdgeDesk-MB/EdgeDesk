/**
 * Founding term: 14-day Edge trial, then 3 months at Core monthly,
 * then Edge list. Not a public price card. Waitlist email, or `?founding=1`.
 */
import type Stripe from "stripe";
import { foundingStripePriceId, stripePriceId } from "@/lib/billing/stripe-prices";

export const FOUNDING_PAID_MONTHS = 3;

export function parseFoundingCheckout(
  value: string | null | undefined
): boolean {
  return value === "1" || value === "true";
}

/** Founding is Edge monthly only. Core and yearly stay on list prices. */
export function foundingCheckoutAllowed(
  plan: string,
  interval: string,
  requested: boolean
): boolean {
  return requested && plan === "edge" && interval === "month";
}

export function shouldAttachFoundingSchedule(
  metadata: { founding?: string | null } | null | undefined
): boolean {
  return metadata?.founding === "true";
}

export function foundingCheckoutPriceId(
  plan: string,
  interval: string,
  requested: boolean
): string | null {
  if (!foundingCheckoutAllowed(plan, interval, requested)) return null;
  return foundingStripePriceId();
}

export function buildFoundingSchedulePhases(input: {
  foundingPriceId: string;
  listPriceId: string;
  startDate: number;
  trialEnd?: number | null;
}): Stripe.SubscriptionScheduleUpdateParams.Phase[] {
  const first: Stripe.SubscriptionScheduleUpdateParams.Phase = {
    items: [{ price: input.foundingPriceId, quantity: 1 }],
    start_date: input.startDate,
    iterations: FOUNDING_PAID_MONTHS,
  };
  if (input.trialEnd != null && input.trialEnd > input.startDate) {
    first.trial_end = input.trialEnd;
  }
  return [
    first,
    { items: [{ price: input.listPriceId, quantity: 1 }] },
  ];
}

export async function attachFoundingScheduleIfNeeded(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  metadata: { founding?: string | null } | null | undefined
): Promise<boolean> {
  if (!shouldAttachFoundingSchedule(metadata)) return false;
  if (subscription.schedule) return false;
  const foundingPriceId = foundingStripePriceId();
  const listPriceId = stripePriceId("edge_month");
  if (!foundingPriceId || !listPriceId) return false;

  const created = await stripe.subscriptionSchedules.create({
    from_subscription: subscription.id,
  });
  const startDate = created.phases[0]?.start_date ?? subscription.start_date;
  const trialEnd = created.phases[0]?.trial_end ?? subscription.trial_end ?? null;
  await stripe.subscriptionSchedules.update(created.id, {
    end_behavior: "release",
    phases: buildFoundingSchedulePhases({
      foundingPriceId,
      listPriceId,
      startDate,
      trialEnd,
    }),
  });
  return true;
}
