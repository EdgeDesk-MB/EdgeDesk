import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  billingStatusIsLive,
  buildSubscriptionCheckoutParams,
  checkoutPriceId,
  parseCheckoutFrom,
  parsePaidCheckout,
  priorTrialConsumed,
  stripeSubscriptionIsLive,
  subscribeCancelHref,
  subscribeSuccessHref,
} from "@/lib/billing/checkout-session";
import { foundingCheckoutPriceId } from "@/lib/billing/founding-schedule";
import { requestOrigin } from "@/lib/billing/request-origin";
import {
  getStripe,
  stripePortalConfigurationId,
} from "@/lib/billing/stripe-server";
import { SETTINGS_SUBSCRIPTION_HREF } from "@/lib/billing/subscription-view";
import { publicCatalogueReady } from "@/lib/billing/stripe-prices";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";
import { claimReferralBestEffort } from "@/lib/referrals/referral-service";
import { findAppUserByClerkId } from "@/lib/services/app-users";
import { isWaitlistFoundingEligible } from "@/lib/services/waitlist";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = parseCheckoutFrom(url.searchParams.get("from"));
  const ref = url.searchParams.get("ref");
  const paid = parsePaidCheckout(
    url.searchParams.get("plan"),
    url.searchParams.get("interval") ?? "month"
  );
  if (!paid) {
    return NextResponse.redirect(new URL("/#pricing", request.url));
  }

  const { userId } = await auth();
  if (!userId) {
    const signUp = new URL("/sign-up", request.url);
    signUp.searchParams.set("plan", paid.plan);
    signUp.searchParams.set("interval", paid.interval);
    if (from) signUp.searchParams.set("from", from);
    if (ref) signUp.searchParams.set("ref", ref);
    return NextResponse.redirect(signUp);
  }

  // EDGE-67: a signed-in arrival with ?ref= claims the referral before
  // checkout, so attribution holds even if the code is never typed into
  // the Stripe promotion-code box.
  await claimReferralBestEffort(userId, ref);

  if (!publicCatalogueReady()) {
    return NextResponse.json(
      { error: "Stripe catalogue is not configured." },
      { status: 503 }
    );
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;
  // EDGE-93: Founding is waitlist-only. The Clerk account email is looked up
  // server-side; no query param can grant the founding schedule.
  const foundingRequested = email
    ? await isWaitlistFoundingEligible(email)
    : false;

  const foundingPriceId = foundingCheckoutPriceId(
    paid.plan,
    paid.interval,
    foundingRequested
  );
  const founding = Boolean(foundingPriceId);
  if (foundingRequested && !foundingPriceId && paid.plan === "edge" && paid.interval === "month") {
    return NextResponse.json(
      { error: "Founding is not priced yet." },
      { status: 503 }
    );
  }
  const priceId = foundingPriceId ?? checkoutPriceId(paid.plan, paid.interval);
  if (!priceId) {
    return NextResponse.json(
      { error: "That plan is not priced yet." },
      { status: 503 }
    );
  }

  try {
    const origin = requestOrigin(request);
    const stripe = getStripe();
    const existing = email
      ? await stripe.customers.list({ email, limit: 1 })
      : { data: [] };
    const customer = existing.data[0];
    if (customer && customer.metadata.clerkUserId !== userId) {
      await stripe.customers.update(customer.id, {
        metadata: { ...customer.metadata, clerkUserId: userId },
      });
    }
    const customerId = customer?.id;

    // EDGE-82: never stack a second live subscription. If the app_users row
    // (or Stripe itself, covering webhook lag right after a checkout) shows a
    // live subscription, send them to the portal to switch plans instead.
    const appUser = await findAppUserByClerkId(userId);
    const portalCustomerId = appUser?.stripeCustomerId ?? customerId ?? null;
    let hasLiveSub = billingStatusIsLive(appUser?.billingStatus);
    // Fetched once when there is a customer and no locally-known live sub:
    // covers the EDGE-82 webhook-lag check and the EDGE-104 trial history.
    let priorSubs: Awaited<
      ReturnType<typeof stripe.subscriptions.list>
    >["data"] = [];
    if (!hasLiveSub && customerId) {
      priorSubs = (
        await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 20,
        })
      ).data;
      hasLiveSub = priorSubs.some((sub) => stripeSubscriptionIsLive(sub.status));
    }
    if (hasLiveSub && portalCustomerId) {
      const configuration = stripePortalConfigurationId();
      const portal = await stripe.billingPortal.sessions.create({
        customer: portalCustomerId,
        return_url: `${origin}${SETTINGS_SUBSCRIPTION_HREF}`,
        ...(configuration ? { configuration } : {}),
      });
      const redirect = NextResponse.redirect(portal.url);
      redirect.cookies.set(PUBLIC_DEMO_COOKIE, "", { path: "/", maxAge: 0 });
      return redirect;
    }
    if (hasLiveSub) {
      console.warn(
        "[subscribe] live subscription but no Stripe customer id; allowing checkout"
      );
    }

    const session = await stripe.checkout.sessions.create(
      buildSubscriptionCheckoutParams({
        priceId,
        plan: paid.plan,
        interval: paid.interval,
        clerkUserId: userId,
        customerId,
        customerEmail: customerId ? null : email,
        founding,
        // EDGE-104: one trial per person - a second Edge checkout bills now.
        trialEligible: !priorTrialConsumed(appUser?.trialEndsAt, priorSubs),
        successUrl: `${origin}${subscribeSuccessHref(paid.plan, paid.interval, undefined, from)}`,
        cancelUrl: `${origin}${subscribeCancelHref(from)}`,
      })
    );

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }

    const checkout = NextResponse.redirect(session.url);
    checkout.cookies.set(PUBLIC_DEMO_COOKIE, "", { path: "/", maxAge: 0 });
    return checkout;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout failed.";
    console.error("[subscribe]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
