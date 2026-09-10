/**
 * When a side first went two goals ahead. Used to stamp 2UP history and
 * "2UP paid early" on that kick, not on the later settle poll.
 */
import { eventResultPostedAt } from "@/lib/events/result-posted";
import type { Side } from "@/lib/calc/trigger";
import { tapeGoals } from "@/lib/events/match-tape";
import {
  eventSideHasUserBack,
  type TwoupBackBet,
} from "@/lib/events/twoup-backed";

export function twoUpLeadMinute(
  goalsJson: string | null | undefined,
  side: Side
): number | null {
  const goals = tapeGoals(goalsJson);
  let home = 0;
  let away = 0;
  let homeDone = false;
  let awayDone = false;
  for (const goal of goals) {
    if (goal.side === "home") home += 1;
    else away += 1;
    const lead = home - away;
    if (!homeDone && lead >= 2) {
      if (side === "home") return goal.minute;
      homeDone = true;
    }
    if (!awayDone && lead <= -2) {
      if (side === "away") return goal.minute;
      awayDone = true;
    }
  }
  return null;
}

export function twoUpOccurredAt(
  startTime: number,
  minute: number
): number {
  return startTime + minute * 60 * 1000;
}

export type EarlyPayoutEvent = {
  id: number;
  sport?: string | null;
  status?: string | null;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  goals?: string | null;
  minute?: number | null;
  homeLed2?: number | null;
  awayLed2?: number | null;
  resultPostedAt?: number | null;
};

/**
 * Wall-clock of the first 2-up for the side this bet backed.
 * Null when the tape never shows that lead (do not invent from current minute).
 */
export function earlyPayoutOccurredAt(
  bet: TwoupBackBet,
  event: EarlyPayoutEvent
): number | null {
  const sides: Side[] = [];
  if (eventSideHasUserBack(event, "home", [bet])) sides.push("home");
  if (eventSideHasUserBack(event, "away", [bet])) sides.push("away");
  if (sides.length === 0) {
    if (event.homeLed2) sides.push("home");
    if (event.awayLed2) sides.push("away");
  }

  let earliest: number | null = null;
  for (const side of sides) {
    const minute = twoUpLeadMinute(event.goals, side);
    if (minute == null) continue;
    const at = twoUpOccurredAt(event.startTime, minute);
    if (earliest == null || at < earliest) earliest = at;
  }
  return earliest;
}

export function earlyPayoutLeadMinute(
  bet: TwoupBackBet,
  event: EarlyPayoutEvent
): number | null {
  const at = earlyPayoutOccurredAt(bet, event);
  if (at == null) return null;
  return Math.round((at - event.startTime) / 60_000);
}

/** settledAt / History createdAt for a just-settled bet. */
export function settlementOccurredAt(input: {
  status: string;
  now: number;
  event?: EarlyPayoutEvent | null;
  bet?: TwoupBackBet | null;
}): number {
  if (
    input.status === "early_payout" &&
    input.event &&
    input.bet
  ) {
    const at = earlyPayoutOccurredAt(input.bet, input.event);
    if (at != null) return at;
  }
  if (input.event?.sport === "horse_racing" && input.event.startTime > 0) {
    return input.event.startTime;
  }
  if (input.event?.status === "finished") {
    const posted = eventResultPostedAt(input.event);
    if (posted != null) return posted;
  }
  return input.now;
}
