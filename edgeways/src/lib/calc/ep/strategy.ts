/**
 * Rank EP structures on a common stake basis so dutch vs lay is an honest comparison.
 *
 * Equalised dutch = covered match product (tidy ladder). It is NOT “max EV”.
 * EV of equalised dutch = Σ stake_i × edge_i - money on a −EV leg dilutes the soft one.
 * “Generous” / +EV price = bookie pays more than the model’s fair odds for that trigger.
 */
import {
  dutchDistMixed,
  equalizedStakes,
  layPlay,
  roundStake,
  type DutchDist,
  type DutchStakes,
  type EpProbs,
  type LayPlayResult,
  type Scenario,
  type StakeMode,
} from "./engine";

export type EpThreshold = 1 | 2;

export type EpStructureKind =
  | "dutch_2_2"
  | "dutch_1_1"
  | "dutch_2_1"
  | "dutch_1_2"
  | "lay_2_both"
  | "lay_1_both"
  | "lay_home_2"
  | "lay_away_2"
  | "lay_home_1"
  | "lay_away_1";

export interface EpStructureCandidate {
  kind: EpStructureKind;
  /** Short label for UI */
  label: string;
  /** One-line why this structure */
  rationale: string;
  /** Absolute £ EV at the desk stake scale */
  ev: number;
  /** EV per £1 of outlay (comparable across structures) */
  evPer1: number;
  /** Total cash outlay (backs + lay liability for lay plays) */
  outlay: number;
  sd: number;
  pProfit: number;
  worst: number;
  best: number;
  /** Dutch-only detail */
  dutch?: {
    homeThreshold: EpThreshold;
    awayThreshold: EpThreshold;
    oH: number;
    oA: number;
    oD: number;
    stakes: DutchStakes;
    dist: DutchDist;
  };
  /** Lay-only detail */
  lay?: {
    sides: Array<{ side: "H" | "A"; threshold: EpThreshold; result: LayPlayResult }>;
  };
}

export interface EpOfferEdge {
  key: string;
  label: string;
  book: string;
  odds: number;
  /** o·pEP − 1 */
  edge: number;
  fair: number;
}

export interface EpStrategyInput {
  scen: Scenario[];
  ep: EpProbs;
  oH2: number;
  oA2: number;
  oH1: number;
  oA1: number;
  oDraw: number;
  oLayH: number;
  oLayA: number;
  commission: number; // fraction, e.g. 0.02
  stakeMode: StakeMode;
  stakeAmt: number;
  rounding: number;
  homeName?: string;
  awayName?: string;
  /** Optional offer edges for dilution copy */
  offerEdges?: EpOfferEdge[];
  /**
   * Include 1UP dutch / lay structures. Default true so callers that omit
   * the flag still get the full stack. The 2UP Desk passes false unless
   * the user turns 1UP on.
   */
  include1Up?: boolean;
}

function mkDutch(
  input: EpStrategyInput,
  oH: number,
  oA: number,
  homeT: EpThreshold,
  awayT: EpThreshold
): EpStructureCandidate | null {
  if (!(oH > 1 && oA > 1 && input.oDraw > 1)) return null;
  const raw = equalizedStakes(oH, oA, input.oDraw, input.stakeMode, input.stakeAmt);
  const stakes = {
    SH: roundStake(raw.SH, input.rounding),
    SA: roundStake(raw.SA, input.rounding),
    SD: roundStake(raw.SD, input.rounding),
  };
  const dist = dutchDistMixed(
    input.scen,
    oH,
    oA,
    input.oDraw,
    stakes.SH,
    stakes.SA,
    stakes.SD,
    homeT,
    awayT
  );
  const kind: EpStructureKind =
    homeT === 2 && awayT === 2
      ? "dutch_2_2"
      : homeT === 1 && awayT === 1
        ? "dutch_1_1"
        : homeT === 2 && awayT === 1
          ? "dutch_2_1"
          : "dutch_1_2";

  const homeLabel = homeT === 2 ? "2UP" : "1UP";
  const awayLabel = awayT === 2 ? "2UP" : "1UP";
  const mixed = homeT !== awayT;
  const label = mixed
    ? `Dutch ${homeLabel}/${awayLabel}`
    : `Dutch ${homeLabel}`;

  let rationale: string;
  if (mixed) {
    const favIsHome = homeT === 2 && awayT === 1;
    rationale = favIsHome
      ? "Covered dutch: favourite on 2UP, outsider on 1UP (dogs rarely lead by two)."
      : "Covered dutch: outsider on 2UP, favourite on 1UP - check prices before playing.";
  } else if (homeT === 2) {
    rationale =
      "Covered dutch (equal stakes for equal returns). Good for a tidy ladder - not max EV if one leg is poor value.";
  } else {
    rationale =
      "Covered 1UP dutch. Triggers more often, prices usually tighter - often loses to 2UP dutch on EV.";
  }

  return {
    kind,
    label,
    rationale,
    ev: dist.EV,
    evPer1: dist.total > 0 ? dist.EV / dist.total : 0,
    outlay: dist.total,
    sd: dist.sd,
    pProfit: dist.pProfit,
    worst: dist.worst,
    best: dist.best,
    dutch: {
      homeThreshold: homeT,
      awayThreshold: awayT,
      oH,
      oA,
      oD: input.oDraw,
      stakes,
      dist,
    },
  };
}

function mkLaySide(
  input: EpStrategyInput,
  side: "H" | "A",
  threshold: EpThreshold,
  backStake: number
): { threshold: EpThreshold; result: LayPlayResult } | null {
  const oEP =
    side === "H"
      ? threshold === 2
        ? input.oH2
        : input.oH1
      : threshold === 2
        ? input.oA2
        : input.oA1;
  const X = side === "H" ? input.oLayH : input.oLayA;
  const pEP =
    side === "H"
      ? threshold === 2
        ? input.ep.pH2
        : input.ep.pH1
      : threshold === 2
        ? input.ep.pA2
        : input.ep.pA1;
  const tW = side === "H" ? input.ep.pWinH : input.ep.pWinA;
  if (!(oEP > 1 && X > 1 && backStake > 0)) return null;
  return {
    threshold,
    result: layPlay(backStake, oEP, X, input.commission, pEP, tW),
  };
}

function mkLayBoth(
  input: EpStrategyInput,
  threshold: EpThreshold,
  stakeH: number,
  stakeA: number
): EpStructureCandidate | null {
  const h = mkLaySide(input, "H", threshold, stakeH);
  const a = mkLaySide(input, "A", threshold, stakeA);
  if (!h || !a) return null;
  const ev = h.result.EV + a.result.EV;
  const outlay =
    h.result.b + a.result.b + h.result.liability + a.result.liability;
  const sd = Math.sqrt(h.result.sd ** 2 + a.result.sd ** 2);
  const label = threshold === 2 ? "Lay both · 2UP" : "Lay both · 1UP";
  return {
    kind: threshold === 2 ? "lay_2_both" : "lay_1_both",
    label,
    rationale:
      "Back EP and lay the exchange on both sides. EV is mostly the “led then didn’t win” bonus after commission.",
    ev,
    evPer1: outlay > 0 ? ev / outlay : 0,
    outlay,
    sd,
    pProfit: NaN,
    worst: Math.min(h.result.RN, a.result.RN) - Math.max(h.result.b, a.result.b) * 0,
    best: h.result.RG + a.result.RG,
    lay: { sides: [{ side: "H", ...h }, { side: "A", ...a }] },
  };
}

function mkLaySingle(
  input: EpStrategyInput,
  side: "H" | "A",
  threshold: EpThreshold,
  stake: number
): EpStructureCandidate | null {
  const one = mkLaySide(input, side, threshold, stake);
  if (!one) return null;
  const name =
    side === "H" ? input.homeName || "Home" : input.awayName || "Away";
  const kind: EpStructureKind =
    side === "H"
      ? threshold === 2
        ? "lay_home_2"
        : "lay_home_1"
      : threshold === 2
        ? "lay_away_2"
        : "lay_away_1";
  const r = one.result;
  return {
    kind,
    label: `Lay ${name} · ${threshold}UP`,
    rationale:
      "Single-side EP hedge. Cleanest when one book is soft and the other isn't worth playing.",
    ev: r.EV,
    evPer1: r.evPer1,
    outlay: r.b + r.liability,
    sd: r.sd,
    pProfit: r.pG + (r.RG > 0 ? 0 : 0),
    worst: Math.min(r.RW, r.RG, r.RN),
    best: Math.max(r.RW, r.RG, r.RN),
    lay: { sides: [{ side, ...one }] },
  };
}

/** Build and rank all viable structures. Higher `ev` first (absolute £ at desk stakes). */
export function rankEpStructures(input: EpStrategyInput): EpStructureCandidate[] {
  const include1Up = input.include1Up !== false;
  const candidates: EpStructureCandidate[] = [];

  const d22 = mkDutch(input, input.oH2, input.oA2, 2, 2);
  const d11 = include1Up ? mkDutch(input, input.oH1, input.oA1, 1, 1) : null;
  const d21 = include1Up ? mkDutch(input, input.oH2, input.oA1, 2, 1) : null;
  const d12 = include1Up ? mkDutch(input, input.oH1, input.oA2, 1, 2) : null;
  for (const d of [d22, d11, d21, d12]) if (d) candidates.push(d);

  // Lay stakes: use equalised dutch home/away stakes so outlay is comparable
  const stakeH2 = d22?.dutch?.stakes.SH ?? input.stakeAmt / 3;
  const stakeA2 = d22?.dutch?.stakes.SA ?? input.stakeAmt / 3;
  const stakeH1 = d11?.dutch?.stakes.SH ?? input.stakeAmt / 3;
  const stakeA1 = d11?.dutch?.stakes.SA ?? input.stakeAmt / 3;

  const lay2 = mkLayBoth(input, 2, stakeH2, stakeA2);
  if (lay2) candidates.push(lay2);
  if (include1Up) {
    const lay1 = mkLayBoth(input, 1, stakeH1, stakeA1);
    if (lay1) candidates.push(lay1);
  }

  const laySingles = [
    mkLaySingle(input, "H", 2, stakeH2),
    mkLaySingle(input, "A", 2, stakeA2),
    ...(include1Up
      ? [
          mkLaySingle(input, "H", 1, stakeH1),
          mkLaySingle(input, "A", 1, stakeA1),
        ]
      : []),
  ];
  for (const c of laySingles) {
    if (c) candidates.push(c);
  }

  return candidates.sort((a, b) => b.ev - a.ev || b.evPer1 - a.evPer1);
}

export function bestEpStructure(
  input: EpStrategyInput
): EpStructureCandidate | null {
  return rankEpStructures(input)[0] ?? null;
}

/** Human-readable honesty note when dutch loses to lay on EV. */
export function dutchVsLayNote(
  dutch: EpStructureCandidate | undefined,
  lay: EpStructureCandidate | undefined
): string | null {
  if (!dutch || !lay) return null;
  if (!dutch.kind.startsWith("dutch") || !lay.kind.startsWith("lay")) return null;
  const delta = lay.ev - dutch.ev;
  if (Math.abs(delta) < 0.25) {
    return "Dutch and lay are within pennies on EV - pick on variance and whether you can lay.";
  }
  if (delta > 0) {
    return `Lay beats this covered dutch by ${gbp(delta)} EV at the same back stakes. Keep dutch if you want the windfall ladder or can’t lay.`;
  }
  return `Covered dutch beats lay by ${gbp(-delta)} EV - the EP prices are generous enough that equalising three legs still wins.`;
}

/**
 * Explain the best single EP price vs equalised dutch.
 * “Generous” = bookie odds beat the model’s fair price for that trigger (+EV).
 */
export function generousOfferNote(
  bestOffer: EpOfferEdge | null | undefined,
  dutch: EpStructureCandidate | undefined,
  stakeAmt: number
): string | null {
  if (!bestOffer || !(stakeAmt > 0)) return null;
  const aloneEv = bestOffer.edge * stakeAmt;
  const parts: string[] = [];

  if (bestOffer.edge > 0.005) {
    parts.push(
      `${bestOffer.label} looks generous at ${bestOffer.odds.toFixed(2)} (model fair ~${bestOffer.fair.toFixed(2)}, about ${pct(bestOffer.edge)} edge). Alone on £${stakeAmt.toFixed(0)} that would be ~${gbp(aloneEv)} EV.`
    );
  } else if (bestOffer.edge > -0.02) {
    parts.push(
      `${bestOffer.label} is roughly fair at ${bestOffer.odds.toFixed(2)} (model ~${bestOffer.fair.toFixed(2)}).`
    );
  } else {
    parts.push(
      `Best single price is still short: ${bestOffer.label} at ${bestOffer.odds.toFixed(2)} vs fair ~${bestOffer.fair.toFixed(2)} (${pct(bestOffer.edge)}).`
    );
  }

  if (dutch?.kind.startsWith("dutch") && bestOffer.edge > 0.01) {
    const diluted = aloneEv - dutch.ev;
    if (diluted > 0.4) {
      parts.push(
        `Equalised dutch shows ${gbp(dutch.ev)} because it also funds weaker legs - that’s coverage, not the full edge of the generous price.`
      );
    }
  }

  return parts.join(" ");
}

function pct(x: number): string {
  const sign = x > 0 ? "+" : x < 0 ? "−" : "";
  return `${sign}${Math.abs(x * 100).toFixed(1)}%`;
}

function gbp(x: number): string {
  return `${x < 0 ? "−" : "+"}£${Math.abs(x).toFixed(2)}`;
}
