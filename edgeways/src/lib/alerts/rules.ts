/**
 * Pure alert rules (C4). Evaluated against app state every poll; the watcher
 * dedupes on `key` so each alert fires once. Rules never talk to a channel -
 * delivery is AlertChannel's job.
 *
 * Offer reminders fire close to impact (first race / promo deadline), not as
 * soon as an offer is created on the same calendar day.
 */

import { accaCampaignCompleteAlert, type AccaCompleteAlertRun } from "./acca-complete";
import { isAccaDeskBack, isAccaDeskLay } from "@/lib/bets/acca-desk-bets";
import { nakedExposureAlertKey } from "@/lib/bets/naked-exposure";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import type { DoNextItem } from "@/lib/offers/do-next";
import type { DailyPlanRaceInput } from "@/lib/plan/daily-plan";
import { freeBetLotNoteLabel } from "@/lib/accounts/free-bet-expiry";
import { formatClockTime } from "@/lib/time-format";
import {
  alertDayKey,
  freeBetExpiringAlertKey,
} from "./expiring-alert-keys";
import {
  alertCopyAmounts,
  formatAlertStake,
  isOfferImpactAlertDue,
  offerExpiringAlertCopy,
  OFFER_EXPIRY_LEAD_MS,
  resolveOfferImpact,
  type OfferImpactOffer,
} from "./offer-impact";
import { resultSettledAlertKey } from "./settled-since-poll";
import { formatAlertHours, formatAlertMinutes } from "./toast-age";
import type { AlertPrefs, EdgeAlert } from "./types";

export {
  freeBetExpiringAlertDedupePrefix,
  freeBetExpiringAlertKeys,
  offerExpiringAlertDedupePrefix,
  offerExpiringAlertKeys,
} from "./expiring-alert-keys";

/** Ignore sub-£1 edges - a notification interrupt has a price. */
const OFFER_EV_FLOOR = 1;
/** "Race off soon" window before the off. */
const RACE_WINDOW_MS = 15 * 60_000;

function isQuietOfferExpiringKind(kind: DoNextItem["kind"]): boolean {
  return (
    kind === "await_result" ||
    kind === "fund_account" ||
    kind === "playbook_await_award"
  );
}

function offerQualifyingAlreadyPlaced(
  offer: OfferImpactOffer | undefined
): boolean {
  return (
    (offer?.qualifyingOpenCount ?? 0) > 0 ||
    (offer?.qualifyingSettledCount ?? 0) > 0
  );
}

export interface SettledBetNotice {
  betId: number;
  label: string;
  profit: number;
  /** When void/push, copy mirrors Profit Tracker (no signed P&L). */
  status?: string;
  /** Bet workflow type - short label in the body (e.g. Qualifying · …). */
  betType?: string | null;
  /** Linked campaign title when the bet belongs to an offer. */
  offerTitle?: string | null;
  bookmaker?: string | null;
  /**
   * Linked event result for the body lead, e.g. "Finished 4th" or "2–1".
   * Omitted when the event/selection result is unknown.
   */
  resultSummary?: string | null;
  /** Acca desk backs store "Acca desk" in notes. */
  notes?: string | null;
}

export interface NakedExposureNotice {
  betId: number;
  label: string;
  bookmaker: string | null;
  betType?: string | null;
  offerTitle?: string | null;
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

/**
 * Identity line under settlement / exposure titles.
 * Prefer the offer title when linked: "Qualifying · Bet £10 get £10".
 * Bookie is carried on EdgeAlert.bookmaker (toast VenueBadge / plain suffix).
 */
export function formatAlertIdentityBody(input: {
  label: string;
  betType?: string | null;
  offerTitle?: string | null;
  /** Optional event result lead ("Finished 4th", "2–1"). */
  resultSummary?: string | null;
}): string {
  const type = alertBetTypeLabel(input.betType);
  const subject = input.offerTitle?.trim() || input.label.trim() || "Bet";
  const identity = `${type} · ${subject}`;
  const result = input.resultSummary?.trim();
  return result ? `${result} · ${identity}` : identity;
}

export interface TwoUpLockNotice {
  betId: number;
  label: string;
  eventName: string;
  /** Equalising exchange back suggestion; null when the live model can't price it */
  suggestion: { fairBackOdds: number; backStake: number; lockedProfit: number } | null;
}

export type FreeBetExpiringLot = {
  id: number;
  accountName: string;
  remaining: number;
  note: string | null;
  expiresAt: number | null;
};

export interface AlertRuleInput {
  now: number;
  prefs: AlertPrefs;
  doNext: DoNextItem[];
  /** Open free-bet lots with an optional user-set conversion deadline. */
  freeBetLots?: FreeBetExpiringLot[];
  /** Offer rows used to resolve race/course/expiry impact times. */
  offers: OfferImpactOffer[];
  races: Array<
    DailyPlanRaceInput & {
      hasOpenBet: boolean;
      externalId?: string | null;
      fieldSize?: number | null;
      region?: string | null;
    }
  >;
  settledSinceLastPoll: SettledBetNotice[];
  /** Acca runs that completed since the previous poll. */
  accaCompletedSinceLastPoll?: AccaCompleteAlertRun[];
  nakedExposed: NakedExposureNotice[];
  twoUpTriggered: TwoUpLockNotice[];
}

export function isAccaDeskSettlement(settled: SettledBetNotice): boolean {
  if (
    isAccaDeskLay({
      label: settled.label,
      betType: settled.betType ?? "",
    })
  ) {
    return true;
  }
  if (
    isAccaDeskBack({
      label: settled.label,
      notes: settled.notes ?? null,
      betType: settled.betType ?? "",
    })
  ) {
    return true;
  }
  return (
    settled.label.startsWith("Acca ·") ||
    settled.label.startsWith("Acca FB ·") ||
    settled.label.startsWith("Acca lay")
  );
}

/** Title/body for a free-bet conversion deadline (same 2-hour lead as promo expiry). */
export function freeBetExpiringAlertCopy(args: {
  remaining: number;
  expiresAt: number;
  now: number;
  note: string | null;
}): { title: string; body: string } {
  const stake = formatAlertStake(args.remaining);
  const amount = stake ? `£${stake}` : "Free bet";
  const until = args.expiresAt - args.now;
  const clock = formatClockTime(args.expiresAt);
  const note = freeBetLotNoteLabel(args.note);
  if (until > 0 && until <= OFFER_EXPIRY_LEAD_MS) {
    const mins = Math.round(until / 60_000);
    const when =
      mins >= 60
        ? formatAlertHours(Math.round(mins / 60))
        : formatAlertMinutes(Math.max(1, mins));
    return {
      title: `⚡ ${amount} free bet ends in ${when}`,
      body: `${note} · convert before ${clock}`,
    };
  }
  return {
    title: `⚡ ${amount} free bet ends today`,
    body: `${note} · convert before it expires`,
  };
}

function formatSignedGbp(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}£${Math.abs(value).toFixed(2)}`;
}

function formatGbpAmount(value: number): string {
  return `£${Math.abs(value).toFixed(2)}`;
}

/**
 * Secondary settlement outcome for alert titles (after the £ amount).
 * Aligns with Profit Tracker history wording; void/push use their own titles.
 */
export function settlementOutcomeLabel(status: string | undefined): string | null {
  switch (status) {
    case "won":
      return "Bet won";
    case "lost":
      return "Bet lost";
    case "early_payout":
      return "2UP paid early";
    case "half_win":
      return "Bet half won";
    case "half_lose":
      return "Bet half lost";
    default:
      return null;
  }
}

function withOutcomeSuffix(title: string, status: string | undefined): string {
  const outcome = settlementOutcomeLabel(status);
  return outcome ? `${title} · ${outcome}` : title;
}

/** Title/body for a settlement alert (void/push match Profit Tracker treatment). */
export function settledResultAlertCopy(settled: SettledBetNotice): {
  title: string;
  body: string;
} {
  const body = formatAlertIdentityBody({
    label: settled.label,
    betType: settled.betType,
    offerTitle: settled.offerTitle,
    resultSummary: settled.resultSummary,
  });
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
  if (settled.profit > 0) {
    return {
      title: withOutcomeSuffix(
        `You just made ${formatGbpAmount(settled.profit)}`,
        settled.status
      ),
      body,
    };
  }
  if (settled.profit < 0) {
    // Sober ledger line - no emoji (web toast + inbox). Push adds ⚡ if needed.
    return {
      title: withOutcomeSuffix(
        `${formatSignedGbp(settled.profit)} settled`,
        settled.status
      ),
      body,
    };
  }
  return {
    title: withOutcomeSuffix(`${formatGbpAmount(0)} settled`, settled.status),
    body,
  };
}

export function settledResultAlert(settled: SettledBetNotice): EdgeAlert {
  const copy = settledResultAlertCopy(settled);
  const voidOrPush = settled.status === "void" || settled.status === "push";
  const tone = voidOrPush
    ? null
    : settled.profit > 0
      ? "positive"
      : settled.profit < 0
        ? "negative"
        : null;
  return {
    key: resultSettledAlertKey(settled.betId),
    kind: "result_settled",
    title: copy.title,
    body: copy.body,
    bookmaker: settled.bookmaker?.trim() || null,
    tone,
    href: `/tracker?highlight=${settled.betId}`,
  };
}

export function evaluateAlertRules(input: AlertRuleInput): EdgeAlert[] {
  const {
    now,
    prefs,
    doNext,
    freeBetLots,
    offers,
    races,
    settledSinceLastPoll,
    accaCompletedSinceLastPoll,
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
        body: formatAlertIdentityBody({
          label: exposed.label,
          betType: exposed.betType,
          offerTitle: exposed.offerTitle,
        }),
        bookmaker: exposed.bookmaker?.trim() || null,
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
      if (isQuietOfferExpiringKind(item.kind)) continue;
      if (item.remainingEv < OFFER_EV_FLOOR) continue;
      // Still require a same-day (or overdue) window so multi-day promos stay quiet.
      if (item.daysLeft == null || item.daysLeft > 1) continue;

      const offer = item.offerId != null ? offersById.get(item.offerId) : undefined;
      if (offer?.status === "completed" || offer?.status === "expired") continue;
      const impact = offer
        ? resolveOfferImpact(offer, races, item.edge?.startTime ?? null, item.kind)
        : item.daysLeft < 0
          ? null
          : {
              at: now + item.daysLeft * 24 * 60 * 60_000,
              source: "expiry" as const,
              label: null,
              raceClockHhmm: null,
              firstOffHhmm: null,
              scopedRaceCount: null,
              qualifyingRaceCount: null,
            };
      if (impact == null) continue;
      // Qualifier already logged: don't nag that the meeting is about to start.
      // Convert / review-expiry still use the hard deadline (source "expiry").
      if (offerQualifyingAlreadyPlaced(offer) && impact.source !== "expiry") continue;

      const hardExpiry =
        offer != null
          ? effectiveOfferExpiryMs({
              expiresAt: offer.expiresAt,
              eventDate: offer.eventDate,
              scopeRaceLabel: offer.scopeRaceLabel,
              scopeRaceId: offer.scopeRaceId,
              sport: offer.sport,
              status: offer.status ?? "active",
            })
          : impact.at;
      if (!isOfferImpactAlertDue(impact, now, hardExpiry)) continue;
      // Fully expired with nothing left to do.
      if (item.daysLeft < 0 && (hardExpiry == null || now >= hardExpiry)) continue;

      const amounts = alertCopyAmounts({
        offer,
        offerTitle: item.offerTitle ?? item.title,
        convertLotRemaining: item.convertLot?.remaining ?? null,
      });
      const copy = offerExpiringAlertCopy({
        remainingEv: item.remainingEv,
        offerTitle: item.offerTitle ?? item.title,
        impact,
        now,
        bookmaker: item.bookmaker,
        actionKind: item.kind,
        stake: amounts.stake,
        freeBetAmount: amounts.freeBetAmount,
      });
      alerts.push({
        key: `offer_expiring:${item.id}:${alertDayKey(now)}`,
        kind: "offer_expiring",
        title: copy.title,
        body: copy.body,
        bookmaker: item.bookmaker?.trim() || null,
        // P1: land on the campaign details modal, not the add-bet flow
        href: item.offerId != null ? `/offers?view=${item.offerId}` : (item.href ?? "/offers"),
      });
    }
  }

  if (prefs.freeBetExpiring) {
    for (const lot of freeBetLots ?? []) {
      if (lot.expiresAt == null || lot.remaining <= 0.001) continue;
      const until = lot.expiresAt - now;
      if (until > OFFER_EXPIRY_LEAD_MS || until <= 0) continue;
      const copy = freeBetExpiringAlertCopy({
        remaining: lot.remaining,
        expiresAt: lot.expiresAt,
        now,
        note: lot.note,
      });
      alerts.push({
        key: freeBetExpiringAlertKey(lot.id, now),
        kind: "free_bet_expiring",
        title: copy.title,
        body: copy.body,
        bookmaker: lot.accountName.trim() || null,
        href: "/desk?freeBets=1",
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
        title: `⏰ ${race.course} off in ${formatAlertMinutes(mins)}`,
        body: "No bet logged · finish the workflow",
        href: "/racing",
      });
    }
  }

  if (prefs.resultSettled) {
    for (const settled of settledSinceLastPoll) {
      // Acca desk bets are mid-campaign ledger lines. The run toast
      // (`acca_complete`) summarises campaign P&L when the last leg lands.
      if (isAccaDeskSettlement(settled)) continue;
      alerts.push(settledResultAlert(settled));
    }
    for (const acca of accaCompletedSinceLastPoll ?? []) {
      alerts.push(accaCampaignCompleteAlert(acca));
    }
  }

  return alerts;
}
