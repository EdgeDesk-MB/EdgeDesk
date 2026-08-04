/**
 * Horse racing settlement - derives win/place/extra-place from RaceResult stored on the event.
 */

import type { EachWayBetMeta } from "@/lib/bets/ew-meta";
import { parseEwMeta } from "@/lib/bets/ew-meta";
import {
  classifyEachWayFinish,
  eachWayOutcomePnL,
  placeOddsFromTerms,
} from "@/lib/calc/each-way-outcomes";
import type { RaceResult } from "@/lib/racing";
import {
  placePositions,
  selectionPosition,
  selectionWonRace,
  selectionPlaced,
} from "@/lib/racing";
import {
  settleFromOutcome,
  type SettleableBet,
  type SettlementOutcome,
} from "@/lib/calc/settlement";

function settleDualLayEachWay(
  bet: SettleableBet,
  result: RaceResult,
  meta: EachWayBetMeta
): SettlementOutcome {
  const position = selectionPosition(bet.selection, result);
  const exchangePlaces = meta.exchangePlaces || placePositions(result.fieldSize);
  const bookiePlaces =
    meta.mode === "extra_place"
      ? Math.max(meta.bookiePlaces, exchangePlaces + 1)
      : meta.bookiePlaces || exchangePlaces;

  const outcomeKey = classifyEachWayFinish(position, bookiePlaces, exchangePlaces);
  const pnl = eachWayOutcomePnL(
    {
      stakePerPart: meta.stakePerPart,
      winOdds: bet.backOdds,
      placeFraction: meta.placeFraction,
      layWinStake: meta.layWin.stake,
      layWinOdds: meta.layWin.odds,
      layPlaceStake: meta.layPlace.stake,
      layPlaceOdds: meta.layPlace.odds,
      commission: bet.commission,
    },
    outcomeKey
  );

  const placeOdds = placeOddsFromTerms(bet.backOdds, meta.placeFraction);
  const bookiePaidWin = outcomeKey === "win";
  const bookiePaidPlace =
    outcomeKey === "win" || outcomeKey === "standard_place" || outcomeKey === "extra_place";

  let explanation: string;
  switch (outcomeKey) {
    case "win":
      explanation = `Horse won - bookie win+place paid, both lays lost`;
      break;
    case "standard_place":
      explanation = `Finished in standard place (${position}) - place back paid, win lay won, place lay lost`;
      break;
    case "extra_place":
      explanation = `Extra place (${position} of ${bookiePlaces}) - place back paid, both lays won`;
      break;
    default:
      explanation = `Unplaced - both back parts lost, both lays won`;
  }

  explanation += ` · place odds ${placeOdds.toFixed(2)}`;

  const bookieSideWon = bookiePaidWin || bookiePaidPlace;
  return {
    status: bookieSideWon ? "won" : "lost",
    profit: pnl.total,
    explanation,
  };
}

export function settleRacingBet(
  bet: SettleableBet,
  result: RaceResult
): SettlementOutcome | null {
  const ewMeta = bet.ewMeta ?? null;

  switch (bet.market) {
    case "win": {
      const won = selectionWonRace(bet.selection, result);
      return settleFromOutcome(bet, won);
    }
    case "place": {
      const placed = selectionPlaced(bet.selection, result);
      return settleFromOutcome(bet, placed);
    }
    case "each_way":
    case "extra_place": {
      if (ewMeta) {
        return settleDualLayEachWay(bet, result, ewMeta);
      }
      const won = selectionWonRace(bet.selection, result);
      const placed = selectionPlaced(bet.selection, result);
      const paid = won || placed;
      return settleFromOutcome(bet, won, paid);
    }
    default:
      return null;
  }
}

/** Parse EW meta from notes when building settleable bets from DB rows. */
export function ewMetaFromNotes(notes: string | null | undefined): EachWayBetMeta | null {
  return parseEwMeta(notes);
}

export function provisionalRacingProfit(
  bet: SettleableBet,
  result: RaceResult
): number | null {
  const settled = settleRacingBet(bet, result);
  return settled?.profit ?? null;
}
