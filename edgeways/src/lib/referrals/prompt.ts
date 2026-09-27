/**
 * Refer a friend ask (EDGE-219). Opens once, right after a settle made in
 * this tab takes realised P&L above £0 for the first time. Profit that was
 * already on the desk (seed, import, restore, another device) never opens it.
 */

import { roundPence } from "@/lib/calc/money";
import {
  effectivePlan,
  type EntitlementBilling,
} from "@/lib/entitlements/effective-plan";

const DISMISSED_KEY = "edgeways:referral-prompt-dismissed";

export const REFERRAL_PITCH =
  "They get 50% off their first paid month. You get £10 credit towards your bill when their first payment lands.";

export function referralPromptStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${DISMISSED_KEY}:${id}` : DISMISSED_KEY;
}

/** Device-local latch. Also honours dismissals made before the desk setting existed. */
export function isReferralPromptDismissed(userId?: string | null): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(referralPromptStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markReferralPromptDismissed(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(referralPromptStorageKey(userId), "1");
  } catch {
    /* private mode */
  }
}

/**
 * Live Core or Edge, same honouring as the desk gate. Trial and past_due
 * count: they already chose a paid plan. Free, cancelled, and missing billing
 * do not.
 */
export function isReferralSubscriber(
  billing: EntitlementBilling | null | undefined
): boolean {
  if (!billing) return false;
  const plan = effectivePlan(billing);
  return plan === "core" || plan === "edge";
}

/**
 * Client mutations that can settle a bet or complete a campaign. Import,
 * restore and demo data routes are left out on purpose.
 */
const SETTLE_ROUTE =
  /^\/api\/(bets|events|acca|bet-builder|boosts|casino|offers|racing|systems)(\/|$)/;

/** How long after a settle mutation a crossing snapshot still counts as that settle. */
export const REFERRAL_SETTLE_WINDOW_MS = 60_000;

let lastSettleActionAt = 0;

export function isReferralSettleRoute(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  if (verb === "GET" || verb === "HEAD") return false;
  return SETTLE_ROUTE.test(path.split("?")[0] ?? path);
}

/** Called by `api()` after a successful mutation. */
export function noteReferralSettleAction(
  method: string,
  path: string,
  now = Date.now()
): void {
  if (isReferralSettleRoute(method, path)) lastSettleActionAt = now;
}

export function hasRecentReferralSettleAction(now = Date.now()): boolean {
  return (
    lastSettleActionAt > 0 &&
    now - lastSettleActionAt <= REFERRAL_SETTLE_WINDOW_MS
  );
}

export function resetReferralSettleActionForTests(): void {
  lastSettleActionAt = 0;
}

/** Realised P&L went from £0 or less to above £0, compared to the pence. */
export function crossedIntoProfit(
  before: number | null | undefined,
  after: number | null | undefined
): boolean {
  if (before == null || after == null) return false;
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
  return roundPence(before) <= 0 && roundPence(after) > 0;
}

export function shouldArmReferralAsk(input: {
  /** Realised P&L on the previous snapshot this tab saw. Null on first load. */
  before: number | null;
  after: number;
  recentSettle: boolean;
  signedIn: boolean;
  publicDemo: boolean;
  subscribed: boolean;
  alreadyAsked: boolean;
}): boolean {
  if (input.publicDemo) return false;
  if (!input.signedIn) return false;
  if (!input.subscribed) return false;
  if (input.alreadyAsked) return false;
  if (!input.recentSettle) return false;
  return crossedIntoProfit(input.before, input.after);
}
