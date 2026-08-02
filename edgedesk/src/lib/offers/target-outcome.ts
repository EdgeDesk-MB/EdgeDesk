/**
 * What real-world result an offer actually pays on.
 *
 * The app is result-centric: record the outcome, derive everything else. An offer
 * saying "get a free bet if your horse finishes 2nd, 3rd or 4th" is a statement
 * about finishing positions, so we model it as one rather than baking the rule
 * into a scoring heuristic.
 *
 * Other sports extend this by adding members to the union. Racing is the only
 * member today.
 */

import type { BetGetFreePlaceRules } from "@/lib/offers/racing-offer-rules";

export type TargetOutcome = {
  kind: "finish_positions";
  /** Finishing positions that trigger the offer, 1-indexed. */
  positions: number[];
  /** Place pays only when the race winner was the SP favourite. */
  winnerMustBeSpFavourite?: boolean;
};

/** The result a place-refund offer pays on, taken straight from its rules. */
export function offerTargetOutcome(rules: BetGetFreePlaceRules): TargetOutcome {
  const positions = [...new Set(rules.qualifyingPlaces)]
    .filter((p) => Number.isInteger(p) && p >= 1)
    .sort((a, b) => a - b);
  return {
    kind: "finish_positions",
    positions,
    ...(rules.winnerMustBeSpFavourite ? { winnerMustBeSpFavourite: true } : {}),
  };
}

function ordinal(position: number): string {
  const suffix =
    position % 100 >= 11 && position % 100 <= 13
      ? "th"
      : position % 10 === 1
        ? "st"
        : position % 10 === 2
          ? "nd"
          : position % 10 === 3
            ? "rd"
            : "th";
  return `${position}${suffix}`;
}

/** Plain-English description, e.g. "finishes 2nd, 3rd or 4th". */
export function describeTargetOutcome(target: TargetOutcome): string {
  const labels = target.positions.map(ordinal);
  if (labels.length === 0) return "no qualifying result";
  let base: string;
  if (labels.length === 1) base = `finishes ${labels[0]}`;
  else {
    const last = labels[labels.length - 1];
    base = `finishes ${labels.slice(0, -1).join(", ")} or ${last}`;
  }
  if (target.winnerMustBeSpFavourite) return `${base} to the SP favourite`;
  return base;
}

/** True when winning the race triggers the offer rather than missing it. */
export function targetIncludesWin(target: TargetOutcome): boolean {
  return target.positions.includes(1);
}

/** Deepest finishing position the offer cares about, used to size the model. */
export function maxTargetPosition(target: TargetOutcome): number {
  return target.positions.reduce((max, p) => Math.max(max, p), 0);
}
