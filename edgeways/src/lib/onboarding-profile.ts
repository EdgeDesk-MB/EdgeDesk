/**
 * First-run profile answers (EDGE-62). Stored on hosted `app_users`, not in
 * the local betting database. Monthly profit target stays in local settings.
 */

import type { FeatureFlag } from "@/lib/entitlements/features";
import { planDisplayName } from "@/lib/entitlements/nav";
import { requiredPlan, type PlanId } from "@/lib/entitlements/plans";

export const ONBOARDING_EXPERIENCE = [
  {
    id: "beginner",
    label: "I am new to matched betting",
    comment:
      "Edgeways does not send you bookie offers. You still need a source of offers. This desk organises the work once you have it.",
    skill: 1,
  },
  {
    id: "spreadsheet",
    label: "I match bets with spreadsheets or notes",
    comment: "This is why most people open an Edgeways account.",
    skill: 2,
  },
  {
    id: "finder",
    label: "I already use an offer finder (e.g. Oddsmonkey, Outplayed)",
    comment: "We fit alongside these platforms. Edgeways helps you run your day.",
    skill: 3,
  },
  {
    id: "long_time",
    label: "I have been doing this a long time",
    comment: "You'll feel at home. Calculators, executing offers and profit tracking, you'll find it all here.",
    skill: 4,
  },
] as const;

export const ONBOARDING_WHY = [
  {
    id: "calculators",
    label: "Calculators",
    description:
      "Qualifying, free-bet, Dutching, and the rest of the matched-bet maths.",
    flag: "calculators",
  },
  {
    id: "bet_log",
    label: "Bet log",
    description: "Log every bet by hand, settle it, and move the wallets.",
    flag: "calculators",
  },
  {
    id: "profit_tracking",
    label: "Profit tracking",
    description: "Basic P&L and account balances from the bets you have logged and settled.",
    flag: "calculators",
  },
  {
    id: "demo_racing",
    label: "Demo Racing Desk",
    description: "Sample racecards so you can learn the desk.",
    flag: "demo_data",
  },
  {
    id: "offers",
    label: "Offers and campaigns",
    description:
      "Track bookie offers, free-bet lots, and where each campaign sits.",
    flag: "offers_pipeline",
  },
  {
    id: "do_next",
    label: "Do next and Daily Plan",
    description: "Ranked work for today, in one queue.",
    flag: "do_next",
  },
  {
    id: "edge_report",
    label: "Edge Report",
    description: "Expected value against what you actually kept.",
    flag: "do_next",
  },
  {
    id: "acca",
    label: "Acca Desk",
    description: "Run accumulator offers one leg at a time.",
    flag: "acca_desk",
  },
  {
    id: "bet_builder",
    label: "Bet Builder Desk",
    description:
      "Same-event builders, with one combined lay when the market is there.",
    flag: "bet_builder_desk",
  },
  {
    id: "systems",
    label: "Systems Desk",
    description: "Full-cover bets such as Lucky 15, with the lays mapped out.",
    flag: "systems_desk",
  },
  {
    id: "offer_edge",
    label: "Offer Edge picks",
    description: "Modelled race and horse recommendations on Racing Desk.",
    flag: "offer_edge",
  },
  {
    id: "racing_live",
    label: "Live racing cards",
    description: "Today's UK and Irish racecards. Demo cards are shown on Racing Desk.",
    flag: "racing_live_feeds",
  },
  {
    id: "live_results",
    label: "Live results",
    description: "Fixtures and races settle when results land.",
    flag: "racing_live_feeds",
  },
  {
    id: "push_alerts",
    label: "2UP alerts",
    description:
      "Push to your phone or desktop when a 2UP position needs a decision.",
    flag: "push_alerts",
  },
  {
    id: "exchange_lay",
    label: "Live exchange prices",
    description: "Live Betfair lay prices on each runner.",
    flag: "exchange_lay",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  description: string;
  flag: FeatureFlag;
}[];

export const ONBOARDING_HOSTED_STEPS = [
  {
    id: "experience",
    title: "What's your experience of matched betting?",
    body: "So we know how to talk to you.",
    help: "Edgeways does not send bookie offers.",
  },
  {
    id: "why",
    title: "What brought you to Edgeways app?",
    body: "Which features interest you most?",
    help: "Some are available on a Core or Edge subscription. We will say if an upgrade would unlock them.",
  },
  {
    id: "heard",
    title: "How did you hear about Edgeways app?",
    body: "Optional. Skip if you would rather not say.",
    help: "Not used for ads.",
  },
] as const;

export const ONBOARDING_HEARD = [
  { id: "reddit", label: "Reddit" },
  { id: "discord", label: "Discord" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X" },
  { id: "google", label: "Google search" },
  { id: "friend", label: "A friend" },
  { id: "other", label: "Other" },
] as const;

export type OnboardingExperienceId = (typeof ONBOARDING_EXPERIENCE)[number]["id"];
export type OnboardingWhyId = (typeof ONBOARDING_WHY)[number]["id"];
export type OnboardingHeardId = (typeof ONBOARDING_HEARD)[number]["id"];

export type OnboardingProfile = {
  experience: OnboardingExperienceId;
  whyHere: OnboardingWhyId[];
  whyHereOther: string | null;
  attribution: OnboardingHeardId | "skipped";
  attributionOther: string | null;
  savedAt: number;
};

export const MONTHLY_TARGET_MAX = 2000;
export const MONTHLY_TARGET_STEP = 50;

export function monthlyTargetPace(monthly: number): {
  daily: number;
  yearly: number;
} {
  const safe = Number.isFinite(monthly) ? Math.max(0, monthly) : 0;
  return { daily: safe / 30, yearly: safe * 12 };
}

const EXPERIENCE_IDS = new Set<string>(ONBOARDING_EXPERIENCE.map((row) => row.id));
const WHY_IDS = new Set<string>(ONBOARDING_WHY.map((row) => row.id));
const HEARD_IDS = new Set<string>(ONBOARDING_HEARD.map((row) => row.id));

function asTrimmed(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed ? trimmed : null;
}

function parseWhyHere(raw: unknown): OnboardingWhyId[] | null {
  const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const ids: OnboardingWhyId[] = [];
  for (const item of list) {
    const id = String(item);
    if (!WHY_IDS.has(id)) continue;
    if (!ids.includes(id as OnboardingWhyId)) ids.push(id as OnboardingWhyId);
  }
  return ids.length > 0 ? ids : null;
}

export function parseOnboardingProfile(raw: unknown): OnboardingProfile | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!EXPERIENCE_IDS.has(String(row.experience))) return null;
  const whyHere = parseWhyHere(row.whyHere);
  if (!whyHere) return null;
  const attribution =
    row.attribution === "skipped" || HEARD_IDS.has(String(row.attribution))
      ? (row.attribution as OnboardingHeardId | "skipped")
      : null;
  if (!attribution) return null;
  const savedAt =
    typeof row.savedAt === "number" && Number.isFinite(row.savedAt)
      ? row.savedAt
      : Date.now();
  return {
    experience: row.experience as OnboardingExperienceId,
    whyHere,
    whyHereOther: asTrimmed(row.whyHereOther),
    attribution,
    attributionOther: asTrimmed(row.attributionOther),
    savedAt,
  };
}

export function serializeOnboardingProfile(profile: OnboardingProfile): string {
  return JSON.stringify(profile);
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, core: 1, edge: 2 };

export function featurePlan(id: OnboardingWhyId): PlanId {
  const row = ONBOARDING_WHY.find((item) => item.id === id);
  return row ? requiredPlan(row.flag) : "free";
}

/** Lowest paid plan that covers every selected feature, or null if the current plan already does. */
export function upgradePlanForFeatures(
  selected: readonly OnboardingWhyId[],
  current: PlanId
): PlanId | null {
  let need: PlanId = "free";
  for (const id of selected) {
    const req = featurePlan(id);
    if (PLAN_RANK[req] > PLAN_RANK[need]) need = req;
  }
  if (PLAN_RANK[need] <= PLAN_RANK[current]) return null;
  return need;
}

export function featureAbovePlan(id: OnboardingWhyId, current: PlanId): boolean {
  return PLAN_RANK[featurePlan(id)] > PLAN_RANK[current];
}

export function lockedFeatureLabels(
  selected: readonly OnboardingWhyId[],
  current: PlanId
): string[] {
  return ONBOARDING_WHY.filter(
    (row) => selected.includes(row.id) && featureAbovePlan(row.id, current)
  ).map((row) => row.label);
}

export function joinBritishList(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function planTierLabel(plan: PlanId): string {
  return `${planDisplayName(plan)} tier`;
}

export function upgradeNudgeTitle(target: PlanId): string {
  return `Available on ${planDisplayName(target)} subscription`;
}

export function upgradeNudgeBody(): string {
  return "You can continue without upgrading. Upgrade and the features you selected will be available when you land on the desk.";
}

export function planMeetsTarget(current: PlanId, target: PlanId): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[target];
}

export function upgradeSuccessTitle(plan: PlanId): string {
  return `Successfully upgraded to ${planTierLabel(plan)}`;
}

/** They arrived already subscribed — celebrate coverage, not an upgrade. */
export function subscriptionSuccessTitle(plan: PlanId): string {
  return `Available with your ${planDisplayName(plan)} subscription`;
}

export function upgradeSuccessBody(): string {
  return "The features you selected will be available when you land on the desk.";
}
