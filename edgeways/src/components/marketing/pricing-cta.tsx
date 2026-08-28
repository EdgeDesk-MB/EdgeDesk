"use client";

/**
 * EDGE-82: pricing CTAs that respect an existing subscription. Guests see
 * per-card checkout. Live subscribers get one “Manage subscription” under
 * the cards, with live=1 so a leftover /demo cookie cannot open Settings
 * as DEMO DATA. CTAs stay pending until that split is known.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  isLiveSubscriberAccount,
  marketingPricingAction,
  type MarketingPricingAction,
} from "@/lib/billing/marketing-pricing-action";
import { type SubscriptionAccount } from "@/lib/billing/subscription-view";

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

export function useMarketingPricingAction(): MarketingPricingAction {
  const { isLoaded, isSignedIn } = useAuth();
  const [billing, setBilling] = useState<SubscriptionAccount | null | undefined>(
    () => cache
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let live = true;
    void loadBillingAccount().then((account) => {
      if (live) setBilling(account);
    });
    return () => {
      live = false;
    };
  }, [isLoaded, isSignedIn]);

  return marketingPricingAction({
    authLoaded: isLoaded,
    signedIn: isSignedIn === true,
    billingLoaded: !isSignedIn || billing !== undefined,
    liveSubscriber: isLiveSubscriberAccount(billing),
  });
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
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
