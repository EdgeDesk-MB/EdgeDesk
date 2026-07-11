/**
 * Accumulator / full-cover bet maths - back returns and layered lay stakes.
 */

export type AccaStructureType =
  | "double"
  | "treble"
  | "four_fold"
  | "trixie"
  | "patent"
  | "yankee"
  | "lucky_15"
  | "lucky_31"
  | "lucky_63";

export interface AccaLeg {
  label: string;
  backOdds: number;
  layOdds?: number;
}

export interface AccaCombination {
  /** Leg indexes included in this bet */
  legs: number[];
  combinedBackOdds: number;
  return: number;
}

export interface AccaStructure {
  type: AccaStructureType;
  label: string;
  /** Number of constituent bets */
  betCount: number;
  combinations: AccaCombination[];
  totalStake: number;
  /** Return if every leg wins (sum of winning combination returns) */
  returnIfAllWin: number;
  profitIfAllWin: number;
}

export interface AccaLayerLay {
  legIndex: number;
  label: string;
  layStake: number;
  liability: number;
}

export interface AccaMatchedResult {
  structure: AccaStructure;
  layerLays: AccaLayerLay[];
  totalLayStake: number;
  totalLiability: number;
  /** Scenarios when using layered lays on a single multi (double/treble/4-fold) */
  scenarios?: Array<{ label: string; profit: number }>;
  worstCase: number;
}

function combinationsOfSize(n: number, size: number): number[][] {
  const out: number[][] = [];
  function walk(start: number, combo: number[]) {
    if (combo.length === size) {
      out.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) walk(i + 1, [...combo, i]);
  }
  walk(0, []);
  return out;
}

function comboSizes(type: AccaStructureType, legCount: number): number[] {
  switch (type) {
    case "double":
      return legCount === 2 ? [2] : [];
    case "treble":
      return legCount === 3 ? [3] : [];
    case "four_fold":
      return legCount === 4 ? [4] : [];
    case "trixie":
      return legCount === 3 ? [2, 3] : [];
    case "patent":
      return legCount === 3 ? [1, 2, 3] : [];
    case "yankee":
      return legCount === 4 ? [2, 3, 4] : [];
    case "lucky_15":
      return legCount === 4 ? [1, 2, 3, 4] : [];
    case "lucky_31":
      return legCount === 5 ? [1, 2, 3, 4, 5] : [];
    case "lucky_63":
      return legCount === 6 ? [1, 2, 3, 4, 5, 6] : [];
    default:
      return [];
  }
}

const TYPE_LABELS: Record<AccaStructureType, string> = {
  double: "Double",
  treble: "Treble",
  four_fold: "Four-fold",
  trixie: "Trixie",
  patent: "Patent",
  yankee: "Yankee",
  lucky_15: "Lucky 15",
  lucky_31: "Lucky 31",
  lucky_63: "Lucky 63",
};

export function requiredLegCount(type: AccaStructureType): number {
  switch (type) {
    case "double":
      return 2;
    case "treble":
    case "trixie":
    case "patent":
      return 3;
    case "four_fold":
    case "yankee":
    case "lucky_15":
      return 4;
    case "lucky_31":
      return 5;
    case "lucky_63":
      return 6;
  }
}

export function accaStructure(
  type: AccaStructureType,
  unitStake: number,
  legs: AccaLeg[]
): AccaStructure | null {
  const n = legs.length;
  if (n !== requiredLegCount(type) || unitStake <= 0) return null;
  if (legs.some((l) => !(l.backOdds > 1))) return null;

  const sizes = comboSizes(type, n);
  const combos: AccaCombination[] = [];
  for (const size of sizes) {
    for (const idxs of combinationsOfSize(n, size)) {
      const combinedBackOdds = idxs.reduce((p, i) => p * legs[i].backOdds, 1);
      combos.push({
        legs: idxs,
        combinedBackOdds,
        return: unitStake * combinedBackOdds,
      });
    }
  }
  if (combos.length === 0) return null;

  const totalStake = unitStake * combos.length;
  const returnIfAllWin = combos.reduce((a, c) => a + c.return, 0);

  return {
    type,
    label: TYPE_LABELS[type],
    betCount: combos.length,
    combinations: combos,
    totalStake,
    returnIfAllWin,
    profitIfAllWin: returnIfAllWin - totalStake,
  };
}

/** Layered lay stakes for a single multi covering all legs (double / treble / four-fold). */
export function accaLayerLays(
  backStake: number,
  legs: AccaLeg[],
  commission: number
): AccaLayerLay[] | null {
  if (backStake <= 0 || legs.length < 2) return null;
  if (legs.some((l) => !(l.backOdds > 1) || !(l.layOdds != null && l.layOdds > 1))) return null;

  const lays: AccaLayerLay[] = [];
  for (let i = 0; i < legs.length; i++) {
    let product = 1;
    for (let j = i; j < legs.length; j++) product *= legs[j].backOdds;
    const layOdds = legs[i].layOdds!;
    const layStake = (backStake * product) / (layOdds - commission);
    lays.push({
      legIndex: i,
      label: legs[i].label,
      layStake,
      liability: layStake * (layOdds - 1),
    });
  }
  return lays;
}

function productOdds(legs: AccaLeg[], from: number): number {
  let p = 1;
  for (let i = from; i < legs.length; i++) p *= legs[i].backOdds;
  return p;
}

/** P&L scenarios for layered lays on a single accumulator. */
export function accaLayerScenarios(
  backStake: number,
  legs: AccaLeg[],
  lays: AccaLayerLay[],
  commission: number
): Array<{ label: string; profit: number }> {
  const combinedOdds = productOdds(legs, 0);
  const backWinReturn = backStake * combinedOdds;
  const scenarios: Array<{ label: string; profit: number }> = [];

  scenarios.push({
    label: "All legs win",
    profit:
      backWinReturn -
      backStake -
      lays.reduce((a, l) => a + l.liability, 0),
  });

  for (let failAt = 0; failAt < legs.length; failAt++) {
    let backProfit = -backStake;
    let exchangeProfit = 0;
    for (let i = 0; i < lays.length; i++) {
      const lay = lays[i];
      const layWins = i <= failAt;
      exchangeProfit += layWins
        ? lay.layStake * (1 - commission)
        : -lay.liability;
    }
    scenarios.push({
      label: `${legs[failAt].label} loses first`,
      profit: backProfit + exchangeProfit,
    });
  }

  return scenarios;
}

const FULL_COVER_TYPES: AccaStructureType[] = [
  "trixie",
  "patent",
  "yankee",
  "lucky_15",
  "lucky_31",
  "lucky_63",
];

export function isFullCoverType(type: AccaStructureType): boolean {
  return FULL_COVER_TYPES.includes(type);
}

export function isLuckyLayMatrixType(type: AccaStructureType): boolean {
  return type === "lucky_31" || type === "lucky_63";
}

export interface LuckyLayLeg {
  legIndex: number;
  label: string;
  layStake: number;
  liability: number;
}

export interface LuckyLayMatrixRow {
  /** Human-readable outcome, e.g. "A ✓ · B ✗ · C ✓" */
  label: string;
  legWins: boolean[];
  profit: number;
}

/** Per-leg lay stakes and outcome matrix for Lucky 31/63 full-cover lays. */
export function luckyLayMatrix(
  type: AccaStructureType,
  unitStake: number,
  legs: AccaLeg[],
  commission: number
): { lays: LuckyLayLeg[]; matrix: LuckyLayMatrixRow[] } | null {
  if (!isLuckyLayMatrixType(type)) return null;
  const structure = accaStructure(type, unitStake, legs);
  if (!structure) return null;
  if (legs.some((l) => !(l.layOdds != null && l.layOdds > 1))) return null;

  const lays: LuckyLayLeg[] = legs.map((leg, i) => {
    const exposure = structure.combinations
      .filter((c) => c.legs.includes(i))
      .reduce((sum, c) => sum + c.return, 0);
    const layOdds = leg.layOdds!;
    const layStake = exposure / (layOdds - commission);
    return {
      legIndex: i,
      label: leg.label,
      layStake,
      liability: layStake * (layOdds - 1),
    };
  });

  const n = legs.length;
  const matrix: LuckyLayMatrixRow[] = [];
  const totalCombinations = 1 << n;

  for (let mask = 0; mask < totalCombinations; mask++) {
    const legWins = Array.from({ length: n }, (_, i) => (mask & (1 << i)) !== 0);

    let backReturn = 0;
    for (const combo of structure.combinations) {
      if (combo.legs.every((i) => legWins[i])) {
        backReturn += combo.return;
      }
    }
    const backProfit = backReturn - structure.totalStake;

    let exchangeProfit = 0;
    for (const lay of lays) {
      const layOdds = legs[lay.legIndex].layOdds!;
      if (legWins[lay.legIndex]) {
        exchangeProfit -= lay.liability;
      } else {
        exchangeProfit += lay.layStake * (1 - commission);
      }
    }

    const label = legWins
      .map((win, i) => `${legs[i].label} ${win ? "✓" : "✗"}`)
      .join(" · ");

    matrix.push({
      label,
      legWins,
      profit: backProfit + exchangeProfit,
    });
  }

  matrix.sort((a, b) => b.profit - a.profit);
  return { lays, matrix };
}

export function accaMatched(
  type: AccaStructureType,
  unitStake: number,
  legs: AccaLeg[],
  commission: number
): AccaMatchedResult | null {
  const structure = accaStructure(type, unitStake, legs);
  if (!structure) return null;

  const isSingleMulti = type === "double" || type === "treble" || type === "four_fold";
  if (!isSingleMulti) {
    return {
      structure,
      layerLays: [],
      totalLayStake: 0,
      totalLiability: 0,
      worstCase: structure.profitIfAllWin,
    };
  }

  const lays = accaLayerLays(unitStake, legs, commission);
  if (!lays) {
    return {
      structure,
      layerLays: [],
      totalLayStake: 0,
      totalLiability: 0,
      worstCase: structure.profitIfAllWin,
    };
  }

  const totalLayStake = lays.reduce((a, l) => a + l.layStake, 0);
  const totalLiability = lays.reduce((a, l) => a + l.liability, 0);
  const scenarios = accaLayerScenarios(unitStake, legs, lays, commission);

  return {
    structure,
    layerLays: lays,
    totalLayStake,
    totalLiability,
    scenarios,
    worstCase: Math.min(...scenarios.map((s) => s.profit)),
  };
}
