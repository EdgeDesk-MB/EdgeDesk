import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { requestOrigin } from "@/lib/billing/request-origin";
import {
  getStripe,
  stripePortalConfigurationId,
} from "@/lib/billing/stripe-server";
import { SETTINGS_SUBSCRIPTION_HREF } from "@/lib/billing/subscription-view";
import { findAppUserByClerkId } from "@/lib/services/app-users";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const POST = withDeskScope(async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const appUser = await findAppUserByClerkId(userId);
  let customerId = appUser?.stripeCustomerId ?? null;

  if (!customerId) {
    const user = await currentUser();
    const email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress ??
      null;
    if (!email) {
      return NextResponse.json(
        { error: "Add an email to this account first." },
        { status: 400 }
      );
    }
    const existing = await getStripe().customers.list({ email, limit: 1 });
    customerId = existing.data[0]?.id ?? null;
  }

  if (!customerId) {
    return NextResponse.json(
      { error: "No Stripe customer for this account yet." },
      { status: 404 }
    );
  }

  const origin = requestOrigin(request);
  const configuration = stripePortalConfigurationId();
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}${SETTINGS_SUBSCRIPTION_HREF}`,
    ...(configuration ? { configuration } : {}),
  });

  return NextResponse.json({ url: session.url });
});
