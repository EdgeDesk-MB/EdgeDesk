import type Stripe from "stripe";
import {
  catalogueFromEnv,
  clerkUserIdFromStripe,
  entitlementFromSubscription,
  sourceFromStripeSubscription,
} from "@/lib/billing/entitlement-from-stripe";
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
  const entitlement = entitlementFromSubscription(source, catalogueFromEnv());
  await applyAppUserEntitlement({
    clerkUserId,
    email: extras?.email,
    entitlement,
  });
}
