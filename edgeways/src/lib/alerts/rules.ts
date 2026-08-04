/**
 * Pure alert rules (C4). Evaluated against app state every poll; the watcher
 * dedupes on `key` so each alert fires once. Rules never talk to a channel -
 * delivery is AlertChannel's job.
 *
 * Offer reminders fire close to impact (first race / promo deadline), not as
 * soon as an offer is created on the same calendar day.
 */

import { nakedExposureAlertKey } from "@/lib/bets/naked-exposure";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import type { DoNextItem } from "@/lib/offers/do-next";
import type { OfferNextActionKind } from "@/lib/offers/next-actions";
import type { DailyPlanRaceInput } from "@/lib/plan/daily-plan";
import {
  isOfferImpactAlertDue,
  offerExpiringAlertCopy,
  resolveOfferImpact,
  type OfferImpactOffer,
} from "./offer-impact";
import type { AlertPrefs, EdgeAlert } from "./types";

/** Ignore sub-£1 edges - a notification interrupt has a price. */
const OFFER_EV_FLOOR = 1;
/** "Race off soon" window before the off. */
const RACE_WINDOW_MS = 15 * 60_000;

/** Action kinds that can produce an offer_expiring alert (see evaluateAlertRules). */
const OFFER_EXPIRING_ACTION_KINDS: OfferNextActionKind[] = [
  "place_qualifying",
  "convert_free_bet",
  "start_planned",
  "review_expiry",
];

export interface SettledBetNotice {
  betId: number;
  label: string;
  profit: number;
  /** When void/push, copy mirrors Profit Tracker (no signed P&L). */
  status?: string;
  /** Bet workflow type - short label in the body (e.g. Qualifying · Windsor). */
  betType?: string | null;
}

export interface NakedExposureNotice {
  betId: number;
  label: string;
  bookmaker: string | null;
  betType?: string | null;
}

/** Short push-friendly bet type for alert bodies. */
export function alertBetTypeLabel(betType: string | null | undefined): string {
  switch (betType) {
    case "qualifying":
      return "Qualifying";
    case "free_snr":
    case "free_sr":
      return "Free bet";
    case "risk_free":
      return "Risk-free";
    case "dutch":
      return "Dutch";
    case "boost":
      return "Boost";
    case "lay_only":
      return "Lay";
    default:
      return "Bet";
  }
}

function alertIdentityBody(
  label: string,
  betType?: string | null,
  suffix?: string | null
): string {
  const type = alertBetTypeLabel(betType);
  const head = `${type} · ${label}`;
  return suffix ? `${head}${suffix}` : head;
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
  /** Offer rows used to resolve race/course/expiry impact times. */
  offers: OfferImpactOffer[];
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

/** Dedupe keys AlertWatcher may have used for this offer today. */
export function offerExpiringAlertKeys(offerId: number, now = Date.now()): string[] {
  const day = dayKey(now);
  return OFFER_EXPIRING_ACTION_KINDS.map(
    (kind) => `offer_expiring:offer-${offerId}-${kind}:${day}`
  );
}

/** Inbox LIKE pattern covering every offer_expiring key for one offer. */
export function offerExpiringAlertDedupePrefix(offerId: number): string {
  return `offer_expiring:offer-${offerId}-`;
}

function formatSignedGbp(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}£${Math.abs(value).toFixed(2)}`;
}

/** Title/body for a settlement alert (void/push match Profit Tracker treatment). */
export function settledResultAlertCopy(settled: SettledBetNotice): {
  title: string;
  body: string;
} {
  const body = alertIdentityBody(settled.label, settled.betType);
  if (settled.status === "void") {
    return {
      title: "Void · stakes returned",
      body,
    };
  }
  if (settled.status === "push") {
    return {
      title: "Push · stakes returned",
      body,
    };
  }
  // Value in the title (OS-bold on lock screens); one polarity emoji only.
  const emoji = settled.profit >= 0 ? "🟢" : "🔴";
  return {
    title: `${emoji} ${formatSignedGbp(settled.profit)} settled`,
    body,
  };
}

export function settledResultAlert(settled: SettledBetNotice): EdgeAlert {
  const copy = settledResultAlertCopy(settled);
  return {
    key: `result_settled:${settled.betId}`,
    kind: "result_settled",
    title: copy.title,
    body: copy.body,
    href: `/tracker?highlight=${settled.betId}`,
  };
}

export function evaluateAlertRules(input: AlertRuleInput): EdgeAlert[] {
  const {
    now,
    prefs,
    doNext,
    offers,
    races,
    settledSinceLastPoll,
    nakedExposed,
    twoUpTriggered,
  } = input;
  const alerts: EdgeAlert[] = [];
  const offersById = new Map(offers.map((o) => [o.id, o]));

  if (prefs.nakedExposure) {
    for (const exposed of nakedExposed) {
      alerts.push({
        key: nakedExposureAlertKey(exposed.betId),
        kind: "naked_exposure",
        title: "⚠️ Lay missing · full stake exposed",
        body: alertIdentityBody(
          exposed.label,
          exposed.betType,
          exposed.bookmaker ? ` at ${exposed.bookmaker}` : null
        ),
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
        title: s
          ? `🔒 2UP · lock £${s.lockedProfit.toFixed(2)}`
          : "🔒 2UP · hedge the lay",
        body: s
          ? `${trigger.eventName} · back ~${s.fairBackOdds.toFixed(2)} for £${s.backStake.toFixed(2)}`
          : `${trigger.eventName} · early payout is in`,
        href: `/tracker?highlight=${trigger.betId}`,
      });
    }
  }

  if (prefs.offerExpiring) {
    for (const item of doNext) {
      if (item.kind === "await_result" || item.kind === "fund_account") continue;
      if (item.remainingEv < OFFER_EV_FLOOR) continue;
      // Still require a same-day (or overdue) window so multi-day promos stay quiet.
      if (item.daysLeft == null || item.daysLeft > 1) continue;

      const offer = item.offerId != null ? offersById.get(item.offerId) : undefined;
      const impact = offer
        ? resolveOfferImpact(offer, races, item.edge?.startTime ?? null, item.kind)
        : item.daysLeft < 0
          ? null
          : {
              at: now + item.daysLeft * 24 * 60 * 60_000,
              source: "expiry" as const,
              label: null,
            };
      if (impact == null) continue;

      const hardExpiry = offer != null ? effectiveOfferExpiryMs(offer) : impact.at;
      if (!isOfferImpactAlertDue(impact, now, hardExpiry)) continue;
      // Fully expired with nothing left to do.
      if (item.daysLeft < 0 && (hardExpiry == null || now >= hardExpiry)) continue;

      const copy = offerExpiringAlertCopy({
        remainingEv: item.remainingEv,
        offerTitle: item.offerTitle ?? item.title,
        impact,
        now,
      });
      alerts.push({
        key: `offer_expiring:${item.id}:${dayKey(now)}`,
        kind: "offer_expiring",
        title: copy.title,
        body: copy.body,
        // P1: land on the campaign details modal, not the add-bet flow
        href: item.offerId != null ? `/offers?view=${item.offerId}` : (item.href ?? "/offers"),
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
        title: `⏰ ${race.course} off in ${mins} min`,
        body: "No bet logged · finish the workflow",
        href: "/racing",
      });
    }
  }

  if (prefs.resultSettled) {
    for (const settled of settledSinceLastPoll) {
      alerts.push(settledResultAlert(settled));
    }
  }

  return alerts;
}
