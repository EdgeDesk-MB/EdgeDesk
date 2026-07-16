/**
 * Boost & bet-builder checkers (J2) - manual-entry fair-price verdicts.
 * Builds on the tested ev.ts primitives: true probability is the exchange
 * back/lay midpoint; EV is the standard expectation at the offered price.
 * No odds are fetched anywhere - the user types what they see (D2 intact).
 */

import { expectedValue, trueProbabilityFromExchange } from "@/lib/calc/ev";
import { roundPence } from "@/lib/calc/money";

export type BoostCall = "take" | "marginal" | "skip";

export interface BoostVerdict {
  edgePct: number;
  evGbp: number;
  fairOdds: number;
  verdict: BoostCall;
}

/** Within ±1% edge the price is noise, not signal. */
const MARGINAL_EDGE_PCT = 1;

export function boostVerdict(input: {
  boostedOdds: number;
  exchangeBack: number;
  exchangeLay: number;
  stake: number;
}): BoostVerdict | null {
  const { boostedOdds, exchangeBack, exchangeLay, stake } = input;
  if (!(boostedOdds > 1) || !(exchangeBack > 1) || !(exchangeLay > 1)) return null;
  if (!(stake >= 0)) return null;

  const trueProb = trueProbabilityFromExchange(exchangeBack, exchangeLay);
  if (!(trueProb > 0 && trueProb < 1)) return null;

  const ev = expectedValue(boostedOdds, trueProb, stake);
  const verdict: BoostCall =
    ev.edgePct > MARGINAL_EDGE_PCT
      ? "take"
      : ev.edgePct >= -MARGINAL_EDGE_PCT
        ? "marginal"
        : "skip";

  return {
    edgePct: ev.edgePct,
    evGbp: roundPence(ev.evForStake),
    fairOdds: ev.fairOdds,
    verdict,
  };
}

/**
 * Naive independence multiplies leg fair odds; same-match legs are usually
 * POSITIVELY correlated, so the true fair price is shorter than the product.
 * The haircut is the user's judgment call (basis "estimated" once set;
 * the 0-default is "heuristic" - independence is an assumption, not a fact).
 */
export function betBuilderFairOdds(
  legs: Array<{ fairOdds: number }>,
  correlationHaircutPct: number
): number | null {
  if (legs.length === 0) return null;
  if (legs.some((l) => !(l.fairOdds > 1))) return null;
  const haircut = Math.min(95, Math.max(0, correlationHaircutPct));
  const naive = legs.reduce((product, l) => product * l.fairOdds, 1);
  return Math.max(1.01, naive * (1 - haircut / 100));
}
