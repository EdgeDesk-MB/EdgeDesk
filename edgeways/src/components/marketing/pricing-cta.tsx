"use client";

/**
 * EDGE-82: pricing CTA that respects an existing subscription. SSR renders
 * the normal checkout href; after mount a signed-in subscriber (live
 * billing status) gets Settings → Subscription instead, so the marketing
 * pricing page never sends them into a second Checkout. The /subscribe
 * route also guards server-side — this is the kinder front door.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { billingStatusIsLive } from "@/lib/billing/checkout-session";
import {
  SETTINGS_SUBSCRIPTION_HREF,
  type SubscriptionAccount,
} from "@/lib/billing/subscription-view";

let cache: SubscriptionAccount | null | undefined;
let inFlight: Promise<SubscriptionAccount | null> | null = null;

function loadBillingAccount(): Promise<SubscriptionAccount | null> {
  if (cache !== undefined) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  inFlight = fetch("/api/billing/account")
    .then(async (res) => {
      if (!res.ok) return null;
      return (await res.json()) as SubscriptionAccount;
    })
    .catch(() => null)
    .then((account) => {
      cache = account;
      inFlight = null;
      return account;
    });
  return inFlight;
}

export function PricingCta({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [subscriber, setSubscriber] = useState(false);

  useEffect(() => {
    let live = true;
    void loadBillingAccount().then((account) => {
      if (live) setSubscriber(billingStatusIsLive(account?.billingStatus));
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Link
      href={subscriber ? SETTINGS_SUBSCRIPTION_HREF : href}
      className={className}
    >
      {subscriber ? "Manage subscription" : children}
    </Link>
  );
}
