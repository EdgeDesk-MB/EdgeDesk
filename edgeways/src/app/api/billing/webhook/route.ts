import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/billing/handle-stripe-event";
import { getStripe, stripeWebhookSecret } from "@/lib/billing/stripe-server";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const POST = withDeskScope(async function POST(request: Request) {
  const secret = stripeWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const raw = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad signature.";
    console.error("[billing/webhook]", message);
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error("[billing/webhook]", error);
    return NextResponse.json({ error: "Could not apply entitlement." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
});
