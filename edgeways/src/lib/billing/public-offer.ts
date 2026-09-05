/**
 * Public subscription offer (EDGE-21 / EDGE-3).
 * Canonical prose: docs/strategy/subscriptions.md (repo root).
 * Feature matrix: entitlements/plans.ts. Do not put Founding on these cards.
 */
import { can, type PlanId } from "@/lib/entitlements/plans";
import { FEATURES, type FeatureFlag } from "@/lib/entitlements/features";

export const TRIAL_DAYS = 14;
export const TRIAL_PLAN: PlanId = "edge";
/** Annual = 10 × monthly (≈ 2 months free). */
export const ANNUAL_MONTHS_CHARGED = 10;
export const YEARLY_MONTHS_FREE = 12 - ANNUAL_MONTHS_CHARGED;
export const FOUNDING_MONTHS_AT_CORE = 3;

export type PublicPlanId = PlanId;

export type PublicPlan = {
  id: PublicPlanId;
  name: string;
  /** Integer pence. */
  monthlyPence: number;
  annualPence: number;
  blurb: string;
  cta: string;
  href: string;
};

export const PUBLIC_PLANS: readonly PublicPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPence: 0,
    annualPence: 0,
    blurb: "Calculators, a bet log you can settle, wallets that follow results, and basic P&L. No card required.",
    cta: "Create a free account",
    href: "/sign-up",
  },
  {
    id: "core",
    name: "Core",
    monthlyPence: 999,
    annualPence: 999 * ANNUAL_MONTHS_CHARGED,
    blurb: "Offers pipeline, Do Next, Daily Plan, and Edge Report.",
    cta: "Choose Core",
    href: "/sign-up?plan=core",
  },
  {
    id: "edge",
    name: "Edge",
    monthlyPence: 2499,
    annualPence: 2499 * ANNUAL_MONTHS_CHARGED,
    blurb: "Live racing and football feeds, Offer Edge picks, and 2UP alerts.",
    cta: "Start 14-day Edge trial",
    href: "/sign-up?plan=edge",
  },
] as const;

/** Settings → Subscription choice plates. Short, scannable, no provider names. */
export const SETTINGS_PLAN_HIGHLIGHTS = {
  core: [
    "Offers pipeline and free-bet lots",
    "Acca, Bet Builder, and Systems desks",
    "Daily Plan and Edge Report",
  ],
  edge: [
    "Everything in Core",
    "Live UK and Irish racecards",
    "Offer Edge picks and 2UP alerts",
    "Football live card: scorers, bookings and lineups",
  ],
} as const;

/** Homepage comparison copy. Inclusion still comes from `can(plan, flag)`. */
export const COMPARISON_FEATURES: Record<
  FeatureFlag,
  { title: string; description: string }
> = {
  calculators: {
    title: "Calculators and bet log",
    description:
      "Qualifying, free-bet, Dutching, and the rest of the matched-bet maths. Log every bet by hand, settle it, and bookie and exchange wallets move with the result.",
  },
  demo_data: {
    title: "Demo Racing Desk",
    description:
      "Sample racecards so you can learn the desk. Live cards are on Edge.",
  },
  offers_pipeline: {
    title: "Offers pipeline",
    description:
      "Track bookie offers, free-bet lots, and where each campaign sits.",
  },
  do_next: {
    title: "Do Next and Daily Plan",
    description:
      "Ranked work for today, plus Edge Report on what you actually kept.",
  },
  acca_desk: {
    title: "Acca Desk",
    description:
      "Run accumulator offers one leg at a time, with a lay when that selection is due.",
  },
  bet_builder_desk: {
    title: "Bet Builder Desk",
    description:
      "Same-event builders. One combined lay, or no lay if the market is not there.",
  },
  systems_desk: {
    title: "Systems Desk",
    description:
      "Full-cover bets such as Lucky 15, with the lays mapped out.",
  },
  offer_edge: {
    title: "Offer Edge picks",
    description:
      "Modelled race and horse recommendations on Racing Desk.",
  },
  racing_live_feeds: {
    title: "Live racing cards",
    description:
      "Today's UK and Irish racecards and results. Demo cards are shown on Racing Desk.",
  },
  football_live_feeds: {
    title: "Football live card",
    description:
      "Who scored, bookings, and the named lineups on tracked matches.",
  },
  push_alerts: {
    title: "2UP alerts",
    description:
      "Push to your phone or desktop when a 2UP position needs a decision.",
  },
  exchange_lay: {
    title: "Live exchange prices",
    description:
      "Live exchange lay prices on each runner. You can still type a lay on Core.",
  },
};

export type ComparisonRow = {
  flag: FeatureFlag;
  title: string;
  description: string;
  included: Record<PlanId, boolean>;
};

export function comparisonRows(): ComparisonRow[] {
  return FEATURES.map((flag) => ({
    flag,
    title: COMPARISON_FEATURES[flag].title,
    description: COMPARISON_FEATURES[flag].description,
    included: {
      free: can("free", flag),
      core: can("core", flag),
      edge: can("edge", flag),
    },
  }));
}

export function formatGbpFromPence(pence: number): string {
  if (pence === 0) return "£0";
  const pounds = Math.trunc(pence / 100);
  const rem = Math.abs(pence % 100);
  return `£${pounds}.${String(rem).padStart(2, "0")}`;
}

export function monthlyLabel(plan: PublicPlan): string {
  if (plan.monthlyPence === 0) return "£0";
  return `${formatGbpFromPence(plan.monthlyPence)}/mo`;
}

export function annualLabel(plan: PublicPlan): string | null {
  if (plan.annualPence === 0) return null;
  return `${formatGbpFromPence(plan.annualPence)}/yr`;
}

export type BillingInterval = "month" | "year";

export function planCheckoutHref(
  plan: PublicPlan,
  interval: BillingInterval,
  from?: "setup" | null
): string {
  if (plan.id === "free") return "/sign-up";
  const params = new URLSearchParams({
    plan: plan.id,
    interval,
  });
  if (from === "setup") params.set("from", "setup");
  return `/subscribe?${params.toString()}`;
}

export function yearlyDealLabel(): string {
  return `${YEARLY_MONTHS_FREE} months free`;
}

export function yearlyDealCue(): string {
  return `${yearlyDealLabel()} with yearly`;
}

export function yearlyBillingSummary(): string {
  return `Yearly billing is ${yearlyDealLabel()}: 12 months for the price of ${ANNUAL_MONTHS_CHARGED}.`;
}

/** Public list offer under the comparison table. No founding / beta price. */
export function trialOfferSummary(): string {
  const core = PUBLIC_PLANS.find((p) => p.id === "core");
  const edge = PUBLIC_PLANS.find((p) => p.id === "edge");
  const coreMo = formatGbpFromPence(core?.monthlyPence ?? 0);
  const edgeMo = formatGbpFromPence(edge?.monthlyPence ?? 0);
  return `Everyone gets ${TRIAL_DAYS} days of Edge free. One trial per person. Cancel before it ends and you are not charged. After that, Edge is ${edgeMo} a month, or Core is ${coreMo} a month.`;
}
