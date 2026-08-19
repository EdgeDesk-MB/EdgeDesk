import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  buildSubscriptionCheckoutParams,
  checkoutPriceId,
  parseCheckoutFrom,
  parsePaidCheckout,
  subscribeSuccessHref,
} from "@/lib/billing/checkout-session";
import {
  foundingCheckoutPriceId,
  parseFoundingCheckout,
} from "@/lib/billing/founding-schedule";
import { requestOrigin } from "@/lib/billing/request-origin";
import { getStripe } from "@/lib/billing/stripe-server";
import { publicCatalogueReady } from "@/lib/billing/stripe-prices";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";
import { isWaitlistFoundingEligible } from "@/lib/services/waitlist";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = parseCheckoutFrom(url.searchParams.get("from"));
  const queryFounding = parseFoundingCheckout(url.searchParams.get("founding"));
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
    if (queryFounding) signUp.searchParams.set("founding", "1");
    return NextResponse.redirect(signUp);
  }

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
  const onWaitlist = email ? await isWaitlistFoundingEligible(email) : false;
  const foundingRequested = queryFounding || onWaitlist;

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

    const session = await stripe.checkout.sessions.create(
      buildSubscriptionCheckoutParams({
        priceId,
        plan: paid.plan,
        interval: paid.interval,
        clerkUserId: userId,
        customerId,
        customerEmail: customerId ? null : email,
        founding,
        successUrl: `${origin}${subscribeSuccessHref(paid.plan, paid.interval, undefined, from)}`,
        cancelUrl: `${origin}/#pricing`,
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
