import type Stripe from "stripe";
import {
  billingStatusIsLive,
  stripeSubscriptionIsLive,
} from "@/lib/billing/checkout-session";
import {
  catalogueFromEnv,
  clerkUserIdFromStripe,
  entitlementFromSubscription,
  sourceFromStripeSubscription,
} from "@/lib/billing/entitlement-from-stripe";
import { attachFoundingScheduleIfNeeded } from "@/lib/billing/founding-schedule";
import { getStripe } from "@/lib/billing/stripe-server";
import {
  applyAppUserEntitlement,
  findAppUserByStripeCustomerId,
} from "@/lib/services/app-users";

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applyStripeSubscription(event.data.object);
      return;
    default:
      return;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) return;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const clerkUserId =
    clerkUserIdFromStripe({
      clientReferenceId: session.client_reference_id,
      metadata: {
        clerkUserId:
          session.metadata?.clerkUserId ?? subscription.metadata?.clerkUserId,
      },
    }) ?? null;
  await applyStripeSubscription(subscription, {
    clerkUserId,
    email: session.customer_details?.email,
  });
  try {
    await attachFoundingScheduleIfNeeded(
      getStripe(),
      subscription,
      session.metadata
    );
  } catch (error) {
    console.error("[billing/webhook] founding schedule", error);
  }
}

export async function applyStripeSubscription(
  subscription: Stripe.Subscription,
  extras?: { clerkUserId?: string | null; email?: string | null }
): Promise<void> {
  const source = sourceFromStripeSubscription(subscription);
  const clerkUserId =
    extras?.clerkUserId?.trim() ||
    clerkUserIdFromStripe({ metadata: subscription.metadata }) ||
    (
      await findAppUserByStripeCustomerId(source.customerId ?? "")
    )?.clerkUserId;
  if (!clerkUserId) {
    console.error(
      "[billing/webhook] no Clerk user for subscription",
      subscription.id
    );
    return;
  }

  // EDGE-82: a canceled/old sub's lifecycle events must not wipe the
  // entitlement of a second live subscription on the same customer.
  let effective = subscription;
  if (!billingStatusIsLive(subscription.status) && source.customerId) {
    try {
      const subs = await getStripe().subscriptions.list({
        customer: source.customerId,
        status: "all",
        limit: 10,
      });
      effective = preferredLiveSubscription(subscription, subs.data);
    } catch (error) {
      console.error("[billing/webhook] live-subscription fallback", error);
    }
  }

  const catalogue = catalogueFromEnv();
  const entitlement = entitlementFromSubscription(
    effective === subscription ? source : sourceFromStripeSubscription(effective),
    catalogue
  );
  await applyAppUserEntitlement({
    clerkUserId,
    email: extras?.email,
    entitlement,
  });
}

/**
 * EDGE-82: the subscription that should drive entitlement. A live incoming
 * sub always wins; otherwise prefer the newest other live sub on the customer
 * so an old sub's cancel event can't drop a paying user to Free.
 */
export function preferredLiveSubscription(
  incoming: Stripe.Subscription,
  others: Stripe.Subscription[]
): Stripe.Subscription {
  if (billingStatusIsLive(incoming.status)) return incoming;
  const live = others
    .filter((s) => s.id !== incoming.id && stripeSubscriptionIsLive(s.status))
    .sort((a, b) => b.created - a.created);
  return live[0] ?? incoming;
}
