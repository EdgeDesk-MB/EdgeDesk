/**
 * Whether the user backed the side that went two ahead.
 * Display only: solid 2UP badge vs outline watch mark.
 */
import { isLockInLoggedBet } from "@/lib/bets/lock-in-bets";
import type { Side } from "@/lib/calc/trigger";
import { betHighlightsBackRunner } from "@/lib/events/live-match-backs";
import { footballTeamsMatch } from "@/lib/services/exchange/football-match";

export type TwoupBackBet = {
  eventId: number | null;
  selection: string;
  status: string;
  backStake: number;
  betType: string;
  label: string;
  notes?: string | null;
  legs?: string | null;
};

function parseDutchLegs(legs: string | null | undefined): Array<{
  selection: string;
  stake: number;
}> {
  if (!legs) return [];
  try {
    const parsed = JSON.parse(legs) as Array<{ selection?: string; stake?: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((leg) => typeof leg?.selection === "string")
      .map((leg) => ({
        selection: leg.selection!,
        stake: typeof leg.stake === "number" ? leg.stake : 0,
      }));
  } catch {
    return [];
  }
}

function selectionBacksSide(
  selection: string,
  side: Side,
  homeTeam: string,
  awayTeam: string
): boolean {
  return betHighlightsBackRunner(selection, side, homeTeam, awayTeam);
}

function betIsPlacedBack(bet: TwoupBackBet): boolean {
  if (bet.status === "void") return false;
  if (bet.betType === "lay_only") return false;
  if (isLockInLoggedBet(bet)) return false;
  return true;
}

export type SideBackMark = {
  kind: "open" | "settled";
  betCount: number;
};

function selectionNamesASide(
  selection: string,
  homeTeam: string,
  awayTeam: string
): boolean {
  return (
    selectionBacksSide(selection, "home", homeTeam, awayTeam) ||
    selectionBacksSide(selection, "away", homeTeam, awayTeam)
  );
}

function betBacksSide(
  bet: TwoupBackBet,
  event: { id: number; homeTeam: string; awayTeam: string },
  side: Side
): boolean {
  if (bet.eventId !== event.id) return false;
  if (!betIsPlacedBack(bet)) return false;

  // Edited match-odds selection wins over leftover dutch legs.
  if (selectionNamesASide(bet.selection, event.homeTeam, event.awayTeam)) {
    return selectionBacksSide(bet.selection, side, event.homeTeam, event.awayTeam);
  }

  const dutch = parseDutchLegs(bet.legs);
  if (dutch.length > 0) {
    return dutch.some(
      (leg) =>
        leg.stake > 0 &&
        selectionBacksSide(leg.selection, side, event.homeTeam, event.awayTeam)
    );
  }

  if (bet.backStake <= 0) return false;
  return selectionBacksSide(bet.selection, side, event.homeTeam, event.awayTeam);
}

/**
 * Map event-home / event-away marks onto a fixture row when the feed
 * stored the clubs the other way around.
 */
export function alignSideBackMarksToFixture(
  event: { homeTeam: string; awayTeam: string },
  fixture: { homeTeam: string; awayTeam: string },
  marks: { home: SideBackMark | null; away: SideBackMark | null }
): { home: SideBackMark | null; away: SideBackMark | null } {
  // A same-city derby (e.g. "Manchester United" vs "Manchester City") can
  // pass the swapped check on a shared surname token even when the fixture
  // already agrees with the event side for side. Trust a direct match first;
  // only swap when the sides truly disagree.
  const aligned =
    footballTeamsMatch(fixture.homeTeam, event.homeTeam) &&
    footballTeamsMatch(fixture.awayTeam, event.awayTeam);
  if (aligned) return marks;
  const swapped =
    footballTeamsMatch(fixture.homeTeam, event.awayTeam) &&
    footballTeamsMatch(fixture.awayTeam, event.homeTeam);
  if (!swapped) return marks;
  return { home: marks.away, away: marks.home };
}

/**
 * Racing-style Backed mark for a match side. Open bets win over settled.
 * Tracked-only / lay-only / lock-in / void = no mark.
 */
export function eventSideBackMark(
  event: { id: number; homeTeam: string; awayTeam: string },
  side: Side,
  bets: TwoupBackBet[]
): SideBackMark | null {
  if (side !== "home" && side !== "away") return null;
  const hits = bets.filter((bet) => betBacksSide(bet, event, side));
  if (hits.length === 0) return null;
  const openCount = hits.filter((bet) => bet.status === "open").length;
  if (openCount > 0) return { kind: "open", betCount: openCount };
  return { kind: "settled", betCount: hits.length };
}

/** True when a desk bet actually backs this match side. Tracked-only = false. */
export function eventSideHasUserBack(
  event: { id: number; homeTeam: string; awayTeam: string },
  side: Side,
  bets: TwoupBackBet[]
): boolean {
  return eventSideBackMark(event, side, bets) != null;
}

/** True when any placed back is on this event. Racing uses the event, not home/away. */
export function eventHasAnyUserBack(
  event: { id: number; homeTeam: string; awayTeam: string; sport?: string | null },
  bets: TwoupBackBet[]
): boolean {
  if ((event.sport ?? "football") === "horse_racing") {
    return bets.some((bet) => {
      if (bet.eventId !== event.id) return false;
      if (!betIsPlacedBack(bet)) return false;
      const dutch = parseDutchLegs(bet.legs);
      if (dutch.length > 0) return dutch.some((leg) => leg.stake > 0);
      return bet.backStake > 0;
    });
  }
  return (
    eventSideHasUserBack(event, "home", bets) || eventSideHasUserBack(event, "away", bets)
  );
}
