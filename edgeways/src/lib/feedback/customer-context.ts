/**
 * Coarse customer facts for the owner feedback email.
 * Counts and dates only — no P&L, stakes, or venue names.
 */
import "server-only";
import { count, eq, min } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { receiptDateLabel } from "@/lib/billing/receipt-view";
import { TRIAL_DAYS } from "@/lib/billing/public-offer";
import {
  billingStatusLabel,
  planDisplayName,
} from "@/lib/billing/subscription-view";
import { getStripe } from "@/lib/billing/stripe-server";
import type { DeskActor } from "@/lib/db/desk-scope";
import { accounts, bets, db, isDemoMode, offers } from "@/lib/db";
import {
  ONBOARDING_EXPERIENCE,
  ONBOARDING_HEARD,
} from "@/lib/onboarding-profile";
import { findAppUserByClerkId, type AppUser } from "@/lib/services/app-users";

export type FeedbackCustomerContext = {
  email: string | null;
  subscription: string;
  signedUpOn: string | null;
  accountAge: string | null;
  subscriptionStartedOn: string | null;
  trialEndsOn: string | null;
  experience: string | null;
  heardFrom: string | null;
  deskSummary: string | null;
};

export function formatFeedbackDate(ms: number): string {
  return receiptDateLabel(Math.floor(ms / 1000));
}

export function formatAccountAge(createdAtMs: number, now = Date.now()): string {
  const days = Math.floor((now - createdAtMs) / 86_400_000);
  if (days < 1) return "less than a day";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  const weeks = Math.floor(days / 7);
  if (days < 60) return weeks === 1 ? "1 week" : `${weeks} weeks`;
  const months = Math.floor(days / 30);
  if (days < 730) return months === 1 ? "1 month" : `${months} months`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year" : `${years} years`;
}

export function formatSubscriptionLabel(user: Pick<
  AppUser,
  "plan" | "billingStatus" | "founding"
>): string {
  const parts = [planDisplayName(user.plan)];
  if (user.billingStatus !== "none") {
    parts.push(billingStatusLabel(user.billingStatus));
  }
  if (user.founding) parts.push("Founding");
  return parts.join(" · ");
}

export function formatDeskSummary(input: {
  demo: boolean;
  bets: number;
  offers: number;
  bookies: number;
  exchanges: number;
  firstActivityMs: number | null;
}): string {
  if (input.demo) return "Demo desk (seeded data, ignore counts)";
  const bits = [
    `${input.bets} ${input.bets === 1 ? "bet" : "bets"}`,
    `${input.offers} ${input.offers === 1 ? "offer" : "offers"}`,
    `${input.bookies} ${input.bookies === 1 ? "bookie" : "bookies"}`,
  ];
  if (input.exchanges > 0) {
    bits.push(
      `${input.exchanges} ${input.exchanges === 1 ? "exchange" : "exchanges"}`
    );
  }
  if (input.firstActivityMs) {
    bits.push(`first activity ${formatFeedbackDate(input.firstActivityMs)}`);
  }
  return bits.join(", ");
}

function experienceLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return ONBOARDING_EXPERIENCE.find((row) => row.id === id)?.label ?? null;
}

function heardLabel(id: string | null | undefined): string | null {
  if (!id || id === "skipped") return null;
  return ONBOARDING_HEARD.find((row) => row.id === id)?.label ?? null;
}

async function stripeSubscriptionStartedAt(
  subscriptionId: string | null
): Promise<number | null> {
  if (!subscriptionId || !process.env.STRIPE_SECRET_KEY?.trim()) return null;
  try {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    const start = sub.start_date;
    return typeof start === "number" && start > 0 ? start * 1000 : null;
  } catch {
    return null;
  }
}

function inferTrialStartedAt(trialEndsAt: number | null): number | null {
  if (!trialEndsAt) return null;
  return trialEndsAt - TRIAL_DAYS * 86_400_000;
}

function readDeskSummary(): string | null {
  try {
    if (isDemoMode()) {
      return formatDeskSummary({
        demo: true,
        bets: 0,
        offers: 0,
        bookies: 0,
        exchanges: 0,
        firstActivityMs: null,
      });
    }
    const betAgg = db
      .select({ n: count(), first: min(bets.createdAt) })
      .from(bets)
      .get();
    const offerAgg = db
      .select({ n: count(), first: min(offers.createdAt) })
      .from(offers)
      .get();
    const bookieAgg = db
      .select({ n: count() })
      .from(accounts)
      .where(eq(accounts.type, "bookie"))
      .get();
    const exchangeAgg = db
      .select({ n: count() })
      .from(accounts)
      .where(eq(accounts.type, "exchange"))
      .get();
    const firsts = [betAgg?.first, offerAgg?.first].filter(
      (value): value is number => typeof value === "number" && value > 0
    );
    return formatDeskSummary({
      demo: false,
      bets: Number(betAgg?.n ?? 0),
      offers: Number(offerAgg?.n ?? 0),
      bookies: Number(bookieAgg?.n ?? 0),
      exchanges: Number(exchangeAgg?.n ?? 0),
      firstActivityMs: firsts.length > 0 ? Math.min(...firsts) : null,
    });
  } catch {
    return null;
  }
}

export async function loadFeedbackCustomerContext(
  actor: DeskActor,
  now = Date.now()
): Promise<FeedbackCustomerContext> {
  const empty: FeedbackCustomerContext = {
    email: actor.email,
    subscription: "Unknown",
    signedUpOn: null,
    accountAge: null,
    subscriptionStartedOn: null,
    trialEndsOn: null,
    experience: null,
    heardFrom: null,
    deskSummary: actor.clerkUserId ? readDeskSummary() : null,
  };

  if (!actor.clerkUserId) return empty;

  let clerkCreatedAt: number | null = null;
  try {
    const user = await currentUser();
    const raw = user?.createdAt;
    if (typeof raw === "number" && raw > 0) clerkCreatedAt = raw;
  } catch {
    clerkCreatedAt = null;
  }

  const appUser = await findAppUserByClerkId(actor.clerkUserId).catch(() => undefined);
  const signedUpMs = clerkCreatedAt ?? appUser?.createdAt ?? null;
  const stripeStart = await stripeSubscriptionStartedAt(
    appUser?.stripeSubscriptionId ?? null
  );
  const trialStart = inferTrialStartedAt(appUser?.trialEndsAt ?? null);
  const subscriptionStartedMs = stripeStart ?? trialStart;

  return {
    email: actor.email ?? appUser?.email ?? null,
    subscription: appUser ? formatSubscriptionLabel(appUser) : "Unknown",
    signedUpOn: signedUpMs ? formatFeedbackDate(signedUpMs) : null,
    accountAge: signedUpMs ? formatAccountAge(signedUpMs, now) : null,
    subscriptionStartedOn: subscriptionStartedMs
      ? formatFeedbackDate(subscriptionStartedMs)
      : null,
    trialEndsOn:
      appUser?.billingStatus === "trialing" && appUser.trialEndsAt
        ? formatFeedbackDate(appUser.trialEndsAt)
        : null,
    experience: experienceLabel(appUser?.onboardingProfile?.experience),
    heardFrom: heardLabel(appUser?.onboardingProfile?.attribution),
    deskSummary: empty.deskSummary,
  };
}
