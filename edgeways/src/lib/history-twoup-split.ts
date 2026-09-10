/**
 * Split a 2UP matched bet into bookie-at-trigger and lay-at-full-time
 * History rows. Only Chelsea v Leeds (this desk's live record) and
 * kick-offs from 10 Sep 2026 onward. Older 2UP rows stay one combined line.
 */
import { roundPence } from "@/lib/calc/money";
import { settleBet, settlementSidePnL } from "@/lib/calc/settlement";
import { toMatchResult, toSettleable } from "@/lib/bets/settle-inputs";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import { footballTeamsMatch } from "@/lib/services/exchange/football-match";
import { eventResultPostedAt } from "@/lib/events/result-posted";
import { regulationEndMinute } from "@/lib/history-match-clock";
import {
  earlyPayoutLeadMinute,
  earlyPayoutOccurredAt,
} from "@/lib/history-twoup-moment";

/** First morning after the Chelsea v Leeds 2UP we are allowed to split. */
export const TWO_UP_SPLIT_FUTURE_FROM = Date.parse("2026-09-10T00:00:00+01:00");

const LAY_ID_OFFSET = 10_000_000;

function matchOddsSide(
  selection: string,
  event: Pick<EventRow, "homeTeam" | "awayTeam">
): "home" | "away" | "draw" | null {
  const raw = selection.trim().toLowerCase();
  if (raw === "home" || raw === "h") return "home";
  if (raw === "away" || raw === "a") return "away";
  if (raw === "draw" || raw === "d" || raw === "x") return "draw";
  if (footballTeamsMatch(selection, event.homeTeam)) return "home";
  if (footballTeamsMatch(selection, event.awayTeam)) return "away";
  return null;
}

export function isChelseaLeedsFixture(event: {
  homeTeam?: string | null;
  awayTeam?: string | null;
}): boolean {
  const home = event.homeTeam ?? "";
  const away = event.awayTeam ?? "";
  const chelseaHome = footballTeamsMatch(home, "Chelsea");
  const chelseaAway = footballTeamsMatch(away, "Chelsea");
  const leedsHome = footballTeamsMatch(home, "Leeds");
  const leedsAway = footballTeamsMatch(away, "Leeds");
  return (chelseaHome && leedsAway) || (chelseaAway && leedsHome);
}

export function shouldSplitTwoUpHistory(
  event: Pick<EventRow, "homeTeam" | "awayTeam" | "startTime">
): boolean {
  if (isChelseaLeedsFixture(event)) return true;
  return event.startTime >= TWO_UP_SPLIT_FUTURE_FROM;
}

function twoUpTriggeredOnBet(bet: BetRow, event: EventRow): boolean {
  if (bet.earlyPayout || bet.status === "early_payout") {
    if (event.homeLed2 || event.awayLed2) return true;
  }
  return bet.status === "early_payout";
}

export function isTwoUpLayHistoryDedupe(dedupe: string): boolean {
  return dedupe.includes(":twoup-lay");
}

export function isTwoUpBookieHistoryDedupe(dedupe: string): boolean {
  return dedupe.includes(":twoup-bookie");
}

export type TwoUpSplitLeg = {
  title: string;
  amount: number;
  at: number;
  minute: number | null;
  role: "bookie" | "lay";
};

export function twoUpSplitLegs(
  bet: BetRow,
  event: EventRow
): { bookie: TwoUpSplitLeg; lay: TwoUpSplitLeg } | null {
  if (!twoUpTriggeredOnBet(bet, event)) return null;
  if (bet.layStake <= 0 || bet.layOdds <= 1) return null;
  const result = toMatchResult(event);
  const selection = matchOddsSide(bet.selection, event) ?? bet.selection;
  const settled = settleBet(toSettleable({ ...bet, selection }), result);
  if (!settled) return null;
  const won = settled.status === "won";
  const early = settled.status === "early_payout";
  const paid = won || early;
  const sides = settlementSidePnL(toSettleable(bet), won, paid, early);
  const twoUpAt = earlyPayoutOccurredAt(bet, event);
  const twoUpMinute = earlyPayoutLeadMinute(bet, event);
  if (twoUpAt == null || twoUpMinute == null) return null;
  const ftMinute = regulationEndMinute(event.matchEnding);
  const ftAt =
    eventResultPostedAt(event) ?? event.startTime + ftMinute * 60 * 1000;
  return {
    bookie: {
      title: "2UP paid early",
      amount: roundPence(sides.bookie),
      at: twoUpAt,
      minute: twoUpMinute,
      role: "bookie",
    },
    lay: {
      title: sides.exchange >= 0 ? "Lay won" : "Lay lost",
      amount: roundPence(sides.exchange),
      at: ftAt,
      minute: ftMinute,
      role: "lay",
    },
  };
}

function alreadySplitForBet(entries: HistoryRow[], betId: number): boolean {
  return entries.some(
    (row) =>
      row.betId === betId &&
      (isTwoUpBookieHistoryDedupe(row.dedupe) || isTwoUpLayHistoryDedupe(row.dedupe))
  );
}

/** Replace a combined 2UP settlement with bookie + lay rows when allowed. */
export function expandTwoUpHistoryEntries(
  entries: HistoryRow[],
  betsById: Map<number, BetRow>,
  eventsById: Map<number, EventRow>
): HistoryRow[] {
  const out: HistoryRow[] = [];
  for (const entry of entries) {
    if (entry.kind !== "settlement" || entry.betId == null) {
      out.push(entry);
      continue;
    }
    if (
      isTwoUpBookieHistoryDedupe(entry.dedupe) ||
      isTwoUpLayHistoryDedupe(entry.dedupe)
    ) {
      out.push(entry);
      continue;
    }
    const bet = betsById.get(entry.betId);
    const event =
      (entry.eventId != null ? eventsById.get(entry.eventId) : undefined) ??
      (bet?.eventId != null ? eventsById.get(bet.eventId) : undefined);
    if (!bet || !event || !shouldSplitTwoUpHistory(event)) {
      out.push(entry);
      continue;
    }
    if (alreadySplitForBet(entries, bet.id)) {
      out.push(entry);
      continue;
    }
    const legs = twoUpSplitLegs(bet, event);
    if (!legs) {
      out.push(entry);
      continue;
    }
    out.push({
      ...entry,
      dedupe: `${entry.dedupe}:twoup-bookie`,
      title: legs.bookie.title,
      amount: legs.bookie.amount,
      minute: legs.bookie.minute,
      createdAt: legs.bookie.at,
    });
    out.push({
      ...entry,
      id: entry.id + LAY_ID_OFFSET,
      dedupe: `${entry.dedupe}:twoup-lay`,
      title: legs.lay.title,
      amount: legs.lay.amount,
      minute: legs.lay.minute,
      createdAt: legs.lay.at,
    });
  }
  return out;
}
