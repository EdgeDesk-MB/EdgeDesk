/**
 * Pure alert rules (C4). Evaluated against app state every poll; the watcher
 * dedupes on `key` so each alert fires once. Rules never talk to a channel -
 * delivery is AlertChannel's job.
 */

import type { DoNextItem } from "@/lib/offers/do-next";
import type { DailyPlanRaceInput } from "@/lib/plan/daily-plan";
import type { AlertPrefs, EdgeAlert } from "./types";

/** Ignore sub-£1 edges - a notification interrupt has a price. */
const OFFER_EV_FLOOR = 1;
/** "Race off soon" window before the off. */
const RACE_WINDOW_MS = 15 * 60_000;

export interface SettledBetNotice {
  betId: number;
  label: string;
  profit: number;
}

export interface NakedExposureNotice {
  betId: number;
  label: string;
  bookmaker: string | null;
}

export interface TwoUpLockNotice {
  betId: number;
  label: string;
  eventName: string;
  /** Equalising exchange back suggestion; null when the live model can't price it */
  suggestion: { fairBackOdds: number; backStake: number; lockedProfit: number } | null;
}

export interface AlertRuleInput {
  now: number;
  prefs: AlertPrefs;
  doNext: DoNextItem[];
  races: Array<DailyPlanRaceInput & { hasOpenBet: boolean }>;
  settledSinceLastPoll: SettledBetNotice[];
  nakedExposed: NakedExposureNotice[];
  twoUpTriggered: TwoUpLockNotice[];
}

function dayKey(now: number): string {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatSignedGbp(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}£${Math.abs(value).toFixed(2)}`;
}

export function evaluateAlertRules(input: AlertRuleInput): EdgeAlert[] {
  const { now, prefs, doNext, races, settledSinceLastPoll, nakedExposed, twoUpTriggered } =
    input;
  const alerts: EdgeAlert[] = [];

  if (prefs.nakedExposure) {
    for (const exposed of nakedExposed) {
      alerts.push({
        key: `naked_exposure:${exposed.betId}`,
        kind: "naked_exposure",
        title: "Unhedged back bet",
        body: `${exposed.label}${exposed.bookmaker ? ` at ${exposed.bookmaker}` : ""} has no lay logged - full stake exposed.`,
        href: `/tracker?highlight=${exposed.betId}`,
      });
    }
  }

  if (prefs.twoUpLock) {
    for (const trigger of twoUpTriggered) {
      const s = trigger.suggestion;
      alerts.push({
        key: `two_up_lock:${trigger.betId}`,
        kind: "two_up_lock",
        title: `2UP triggered - ${trigger.eventName}`,
        body: s
          ? `Early payout is in. Back at ~${s.fairBackOdds.toFixed(2)} for £${s.backStake.toFixed(2)} to lock £${s.lockedProfit.toFixed(2)} either way.`
          : "Early payout is in - hedge the open lay to lock your profit.",
        href: `/tracker?highlight=${trigger.betId}`,
      });
    }
  }

  if (prefs.offerExpiring) {
    for (const item of doNext) {
      if (item.kind === "await_result" || item.kind === "fund_account") continue;
      if (item.remainingEv < OFFER_EV_FLOOR) continue;
      if (item.daysLeft == null || item.daysLeft > 1 || item.daysLeft < 0) continue;
      alerts.push({
        key: `offer_expiring:${item.id}:${dayKey(now)}`,
        kind: "offer_expiring",
        title: `Offer ends today - £${item.remainingEv.toFixed(0)} unclaimed`,
        body: `${item.offerTitle ?? item.title}: £${item.remainingEv.toFixed(2)} of edge expires with it.`,
        href: item.href ?? "/offers",
      });
    }
  }

  if (prefs.raceOffSoon) {
    for (const race of races) {
      if (race.resultLogged || race.hasOpenBet) continue;
      const untilOff = race.offTime - now;
      if (untilOff <= 0 || untilOff > RACE_WINDOW_MS) continue;
      const mins = Math.max(1, Math.round(untilOff / 60_000));
      alerts.push({
        key: `race_off_soon:${race.eventId}`,
        kind: "race_off_soon",
        title: `${race.course} off in ${mins} min`,
        body: "Tracked race with no bet logged yet - finish the workflow before the off.",
        href: "/racing",
      });
    }
  }

  if (prefs.resultSettled) {
    for (const settled of settledSinceLastPoll) {
      alerts.push({
        key: `result_settled:${settled.betId}`,
        kind: "result_settled",
        title: `Settled: ${settled.label}`,
        body: `${formatSignedGbp(settled.profit)} on ${settled.label}.`,
        href: `/tracker?highlight=${settled.betId}`,
      });
    }
  }

  return alerts;
}
