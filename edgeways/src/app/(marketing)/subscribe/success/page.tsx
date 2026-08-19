import type { Metadata } from "next";
import { SubscribeReceiptHydrate } from "@/components/marketing/subscribe-receipt-hydrate";
import { SubscribeSuccessNext } from "@/components/marketing/subscribe-success-next";
import {
  parseCheckoutFrom,
  parsePaidCheckout,
} from "@/lib/billing/checkout-session";
import { buildReceiptFromOffer } from "@/lib/billing/receipt-view";
import { isWaitlistSurface } from "@/lib/site-surface";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscription confirmed",
  robots: { index: false, follow: false },
};

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    plan?: string;
    interval?: string;
    from?: string;
  }>;
}) {
  const params = await searchParams;
  const paid = parsePaidCheckout(params.plan, params.interval);
  const from = parseCheckoutFrom(params.from);
  const sessionId = params.session_id;
  const receipt = paid
    ? buildReceiptFromOffer(paid.plan, paid.interval)
    : null;
  const waitlist = isWaitlistSurface();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-5 py-20">
      <SubscribeReceiptHydrate
        sessionId={sessionId}
        initial={receipt}
        from={from}
        paidPlan={paid?.plan ?? null}
      />
      {waitlist ? (
        <p className="mt-6 max-w-sm text-center text-sm text-white/55">
          Your subscription is with Stripe. The desk stays closed on this site
          until we open it for beta.
        </p>
      ) : null}
      {!(receipt || sessionId) ? (
        <p className="mt-6 max-w-sm text-center text-sm text-white/55">
          Prices in GBP.
        </p>
      ) : null}
      <SubscribeSuccessNext from={from} />
    </div>
  );
}
