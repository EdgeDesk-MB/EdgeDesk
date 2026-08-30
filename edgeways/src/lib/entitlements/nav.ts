/**
 * Desk path → N0 feature flag. Used by the route gate and lock copy.
 * Only flags that are specified in the matrix (features.ts / §7.5).
 */
import { SETTINGS_SUBSCRIPTION_HREF } from "@/lib/billing/subscription-view";
import { publicDemoPlansHref } from "@/lib/demo/public-demo";
import { FEATURE_LABELS, type FeatureFlag } from "./features";
import { requiredPlan, type PlanId } from "./plans";

export function featureForDeskPath(pathname: string): FeatureFlag | null {
  if (pathname.startsWith("/offers")) return "offers_pipeline";
  // Profit Tracker is the Free bet log (list, settle, wallets, basic P&L).
  // Campaigns and lots stay on offers_pipeline / Core.
  if (pathname.startsWith("/tracker")) return "calculators";
  if (pathname.startsWith("/acca")) return "acca_desk";
  if (pathname.startsWith("/bet-builder")) return "bet_builder_desk";
  if (pathname.startsWith("/systems")) return "systems_desk";
  if (pathname.startsWith("/report")) return "do_next";
  return null;
}

export function planDisplayName(plan: PlanId): "Free" | "Core" | "Edge" {
  if (plan === "free") return "Free";
  if (plan === "core") return "Core";
  return "Edge";
}

export type PlanLockOpts = {
  real?: boolean;
  publicDemo?: boolean;
};

/** In-page lock title. Names the plan, not the desk. */
export function availableOnSubscriptionTitle(plan: PlanId): string {
  return `Available on ${planDisplayName(plan)} subscription`;
}

export const FEATURE_LOCK_BODIES: Record<FeatureFlag, string> = {
  calculators:
    "Qualifying, free-bet, and Dutching maths, plus a bet log you can settle.",
  demo_data: "Sample racecards so you can learn the desk.",
  offers_pipeline:
    "Track bookie offers as campaigns. Qualifiers through to free bet payouts.",
  do_next:
    "Ranked work for today, Daily Plan, and Edge Report on what you kept.",
  acca_desk:
    "Run accumulator offers one leg at a time, with a lay when that selection is due.",
  bet_builder_desk:
    "Same-event builders. One combined lay, or no lay if the market is not there.",
  systems_desk: "Full-cover bets such as Lucky 15, with the lays mapped out.",
  offer_edge: "Modelled race and horse recommendations on Racing Desk.",
  racing_live_feeds:
    "Today's UK and Irish racecards and results. Demo cards are shown on Racing Desk.",
  push_alerts:
    "Push to your phone or desktop when a 2UP position needs a decision.",
  exchange_lay:
    "Live exchange lay prices on each runner. You can still type a lay on Core.",
};

export function planLockCopy(
  feature: FeatureFlag,
  opts?: PlanLockOpts
): {
  title: string;
  description: string;
} {
  const plan = requiredPlan(feature);
  const name = planDisplayName(plan);
  const also = plan === "core" ? " and Edge" : "";
  return {
    title: availableOnSubscriptionTitle(plan),
    description: opts?.real
      ? `${FEATURE_LABELS[feature]} is available on ${name}${also}. Upgrade in Settings → Subscription to open it.`
      : `${FEATURE_LABELS[feature]} is available on ${name}${also}. Switch the viewing bar to open it.`,
  };
}

export function planLockPlansHref(opts?: { publicDemo?: boolean }): string {
  return opts?.publicDemo ? publicDemoPlansHref() : SETTINGS_SUBSCRIPTION_HREF;
}

export function planLockEmptyCopy(
  feature: FeatureFlag,
  opts?: PlanLockOpts
): {
  title: string;
  description: string;
  action: { label: string; href: string };
  secondaryAction: { label: string; href: string };
} {
  const plan = requiredPlan(feature);
  const also = plan === "core" ? "\nIncluded on Core and Edge." : "";
  return {
    title: availableOnSubscriptionTitle(plan),
    description: `${FEATURE_LOCK_BODIES[feature]}${also}`,
    action: {
      label: "View plans",
      href: planLockPlansHref(opts),
    },
    secondaryAction:
      plan === "edge"
        ? { label: "Open calculators", href: "/calculators" }
        : { label: "Open Profit Tracker", href: "/tracker" },
  };
}

/**
 * One plate covering a few Edge flags on a desk that still works.
 * Title names the lead gap; body lists the rest.
 */
export const EDGE_DESK_PROMOS = {
  racing: {
    feature: "racing_live_feeds" as const satisfies FeatureFlag,
    title: "Available on Edge subscription",
    description:
      "Today's UK and Irish cards, Offer Edge picks, and live exchange lays.",
  },
  twoUp: {
    feature: "push_alerts" as const satisfies FeatureFlag,
    title: "Available on Edge subscription",
    description:
      "Get notified when a 2UP position needs a decision. Live exchange prices on this desk are Edge too.",
  },
} as const;
