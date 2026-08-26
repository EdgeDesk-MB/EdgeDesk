import type { Metadata } from "next";
import Link from "next/link";
import { MarketingDocPage } from "@/components/marketing/marketing-doc-page";
import { TRIAL_DAYS } from "@/lib/billing/public-offer";
import { LEGAL_PATHS } from "@/lib/legal/public";
import { canonicalUrl } from "@/lib/marketing/share-metadata";
import { SUPPORT_EMAIL, mailtoHref } from "@/lib/marketing/site-contacts";

export const metadata: Metadata = {
  title: "Refunds",
  description:
    "How Edgeways trials, cancellation, and refunds work. Edge has a 14-day trial. Core is billed from day one.",
  alternates: { canonical: canonicalUrl(LEGAL_PATHS.refund) },
};

export default function RefundPage() {
  return (
    <MarketingDocPage title="Refunds">
      <p>
        Start Edge and you get {TRIAL_DAYS} days at £0. Cancel before those days
        end and Stripe does not take the first payment. One trial per person.
      </p>
      <p>
        Core is billed from the day you subscribe. There is no trial on Core.
        Free has no subscription, so there is nothing to refund.
      </p>
      <p>
        After a payment, the plan renews each month or year until you cancel.
        Cancel any time from Settings → Subscription. That opens the Stripe
        billing portal. You keep paid features until the end of the period you
        already paid for. We do not refund part of a paid period except where
        UK or EU consumer law requires it.
      </p>
      <p>
        If you are a UK or EU consumer and you think a statutory cooling-off
        refund still applies after you have paid, email{" "}
        <a href={mailtoHref(SUPPORT_EMAIL)}>{SUPPORT_EMAIL}</a>
        . We will refund a proportionate amount for any unused period where the
        law requires. Nothing here limits your statutory rights.
      </p>
      <p>
        Manage billing from{" "}
        <Link href="/settings?tab=subscription">Settings → Subscription</Link>{" "}
        once you are signed in.
      </p>
    </MarketingDocPage>
  );
}
