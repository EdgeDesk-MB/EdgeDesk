/**
 * Shared desk auto-result: derive won/lost/void(/placed) from a finished event.
 * Acca, Systems and Bet Builder all call this — do not invent a second engine.
 *
 * Supported today: football score markets + horse racing win/place/EW.
 * Future sports add cases here only.
 */

import {
  deriveOutcomes,
  selectionWon,
  type Market,
} from "@/lib/calc/settlement";
import { racingMarketReadyToSettle } from "@/lib/calc/racing-settlement";
import {
  parseRaceResults,
  selectionPlaced,
  selectionWonRace,
} from "@/lib/racing";

export type DeskLegAutoResult = "won" | "placed" | "lost" | "void";

export type DeskLegAutoInput = {
  market?: string | null;
  selection?: string | null;
  sport?: string | null;
};

export type DeskEventAutoInput = {
  sport?: string | null;
  status?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeLed2?: number | null;
  awayLed2?: number | null;
  goals?: string | null;
};

function isRacingSport(sport: string | null | undefined): boolean {
  return sport === "horse_racing" || sport === "greyhounds";
}

/** Acca / Bet Builder only distinguish win vs lose (place finish pays a place market). */
export function toBinaryDeskResult(
  result: DeskLegAutoResult
): "won" | "lost" | "void" {
  if (result === "placed") return "won";
  return result;
}

/**
 * Derive a desk leg/selection outcome from a finished linked event.
 * Returns null when the event is not finished or the market cannot be priced yet.
 */
export function deriveDeskLegAutoResult(
  leg: DeskLegAutoInput,
  event: DeskEventAutoInput
): DeskLegAutoResult | null {
  if (event.status !== "finished") return null;

  const market = (leg.market ?? "").trim();
  const selection = (leg.selection ?? "").trim();
  if (!market || !selection || market === "other") return null;

  const sport = leg.sport?.trim() || event.sport?.trim() || null;

  if (isRacingSport(sport) || isRacingSport(event.sport)) {
    return deriveRacingDeskResult(market, selection, event);
  }

  // Unknown non-football sports stay manual until a handler exists.
  if (sport != null && sport !== "football") return null;

  return deriveFootballDeskResult(market, selection, event);
}

function deriveFootballDeskResult(
  market: string,
  selection: string,
  event: DeskEventAutoInput
): DeskLegAutoResult | null {
  const outcomes = deriveOutcomes({
    homeScore: event.homeScore ?? 0,
    awayScore: event.awayScore ?? 0,
    homeLed2: event.homeLed2 === 1,
    awayLed2: event.awayLed2 === 1,
  });

  if (market === "draw_no_bet" && outcomes.matchOdds === "draw") {
    return "void";
  }

  const won = selectionWon(market as Market, selection, outcomes);
  if (won === null) return null;
  return won ? "won" : "lost";
}

function deriveRacingDeskResult(
  market: string,
  selection: string,
  event: DeskEventAutoInput
): DeskLegAutoResult | null {
  const race = parseRaceResults(event.goals);
  if (!race) return null;
  if (!racingMarketReadyToSettle(market, race)) return null;

  if (market === "win") {
    return selectionWonRace(selection, race) ? "won" : "lost";
  }
  if (market === "place") {
    return selectionPlaced(selection, race) ? "won" : "lost";
  }
  if (market === "each_way" || market === "extra_place") {
    if (selectionWonRace(selection, race)) return "won";
    if (selectionPlaced(selection, race)) return "placed";
    return "lost";
  }
  return null;
}
