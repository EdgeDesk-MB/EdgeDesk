/** Homepage Refer a friend prompt. Dismiss is device-local, keyed by Clerk user. */

import { roundPence } from "@/lib/calc/money";

const DISMISSED_KEY = "edgeways:referral-prompt-dismissed";
const SNOOZED_KEY = "edgeways:referral-prompt-snoozed";

export const REFERRAL_PITCH =
  "They get 50% off their first paid month. You get £10 credit towards your bill when their first payment lands.";

export function referralPromptStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${DISMISSED_KEY}:${id}` : DISMISSED_KEY;
}

export function referralPromptSnoozeKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${SNOOZED_KEY}:${id}` : SNOOZED_KEY;
}

function readFlag(storage: "local" | "session", key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const store = storage === "local" ? localStorage : sessionStorage;
    return store.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(storage: "local" | "session", key: string): void {
  if (typeof window === "undefined") return;
  try {
    const store = storage === "local" ? localStorage : sessionStorage;
    store.setItem(key, "1");
  } catch {
    /* private mode */
  }
}

export function isReferralPromptDismissed(userId?: string | null): boolean {
  if (typeof window === "undefined") return true;
  const key = referralPromptStorageKey(userId);
  if (readFlag("local", key)) return true;
  return readFlag("session", key);
}

export function markReferralPromptDismissed(userId?: string | null): void {
  const key = referralPromptStorageKey(userId);
  writeFlag("local", key);
  writeFlag("session", key);
}

export function isReferralPromptSnoozed(userId?: string | null): boolean {
  if (typeof window === "undefined") return true;
  return readFlag("session", referralPromptSnoozeKey(userId));
}

export function snoozeReferralPrompt(userId?: string | null): void {
  writeFlag("session", referralPromptSnoozeKey(userId));
}

export function isReferralPromptHidden(userId?: string | null): boolean {
  return isReferralPromptDismissed(userId) || isReferralPromptSnoozed(userId);
}

/** Live Core or Edge. Trial counts: they already chose a paid plan. */
export function isReferralSubscriber(account: {
  plan: string;
  billingStatus: string;
} | null | undefined): boolean {
  if (!account) return false;
  if (account.plan !== "core" && account.plan !== "edge") return false;
  return (
    account.billingStatus === "active" ||
    account.billingStatus === "trialing" ||
    account.billingStatus === "past_due"
  );
}

function isProfitable(amount: number | null | undefined): boolean {
  if (amount == null || !Number.isFinite(amount)) return false;
  return roundPence(amount) > 0;
}

/**
 * A first successful moment: a settled bet or a completed casino offer
 * that made a profit. Losing first, then winning, still qualifies.
 */
export function hasReferralSuccessMoment(input: {
  bets: Array<{ status: string; actualProfit: number | null }>;
  casinoSettlements: Array<{ amount: number }>;
}): boolean {
  for (const bet of input.bets) {
    if (bet.status === "open" || bet.status === "void") continue;
    if (isProfitable(bet.actualProfit)) return true;
  }
  return input.casinoSettlements.some((row) => isProfitable(row.amount));
}

export function shouldOpenReferralPrompt(input: {
  pathname: string;
  signedIn: boolean;
  publicDemo: boolean;
  suppressed: boolean;
  hidden: boolean;
  subscribed: boolean;
  hasSuccessMoment: boolean;
}): boolean {
  if (input.publicDemo) return false;
  if (!input.signedIn) return false;
  if (!input.subscribed) return false;
  if (!input.hasSuccessMoment) return false;
  if (input.suppressed) return false;
  if (input.hidden) return false;
  return input.pathname === "/desk" || input.pathname === "/desk/";
}
