/**
 * Full-cover (Systems desk) returns from leg results.
 * Void: legs settle at odds 1.0, so a line reduces (treble → double →
 * single); only a fully-void line refunds its unit stake.
 * Each-way: win part + place part (place odds = 1 + (win − 1) × fraction).
 */

import {
  accaStructure,
  comboSizes as accaComboSizes,
  requiredLegCount,
  type AccaStructureType,
} from "@/lib/calc/accumulator";
import { placeOddsFromTerms } from "@/lib/calc/each-way-outcomes";
import { roundPence } from "@/lib/calc/money";

export type SystemStructureType =
  | "trixie"
  | "patent"
  | "yankee"
  | "canadian"
  | "heinz"
  | "super_heinz"
  | "goliath"
  | "lucky_15"
  | "lucky_31"
  | "lucky_63";

export const SYSTEM_STRUCTURES: SystemStructureType[] = [
  "trixie",
  "patent",
  "yankee",
  "canadian",
  "heinz",
  "super_heinz",
  "goliath",
  "lucky_15",
  "lucky_31",
  "lucky_63",
];

const STRUCTURE_LABELS: Record<SystemStructureType, string> = {
  trixie: "Trixie",
  patent: "Patent",
  yankee: "Yankee",
  canadian: "Canadian",
  heinz: "Heinz",
  super_heinz: "Super Heinz",
  goliath: "Goliath",
  lucky_15: "Lucky 15",
  lucky_31: "Lucky 31",
  lucky_63: "Lucky 63",
};

export type SystemLegResult = "pending" | "won" | "placed" | "lost" | "void";

export function systemStructureLabel(type: SystemStructureType): string {
  return STRUCTURE_LABELS[type];
}

export function isSystemStructure(value: string): value is SystemStructureType {
  return (SYSTEM_STRUCTURES as string[]).includes(value);
}

/**
 * Structure family for desk filters.
 * - lucky = full cover with singles (Patent, Lucky 15/31/63)
 * - cover = full cover without singles (Trixie → Goliath)
 * Unrelated to Add bet "No lay" (back-only mode).
 */
export function systemFamily(type: SystemStructureType): "lucky" | "cover" {
  return type.startsWith("lucky") || type === "patent" ? "lucky" : "cover";
}

export function systemRequiredLegs(type: SystemStructureType): number {
  return requiredLegCount(type as AccaStructureType);
}

export interface SystemLegInput {
  label: string;
  oddsDecimal: number;
  result?: SystemLegResult;
}

export interface SettleSystemOptions {
  eachWay?: boolean;
  /** e.g. 0.2 for 1/5, 0.25 for 1/4. Required when eachWay. */
  placeFraction?: number;
}

/** Preview structure (all legs treated as open for if-all-win). */
export function previewSystemStructure(
  structure: SystemStructureType,
  unitStake: number,
  legs: SystemLegInput[]
) {
  return accaStructure(
    structure as AccaStructureType,
    unitStake,
    legs.map((l) => ({
      label: l.label,
      backOdds: l.oddsDecimal > 1 ? l.oddsDecimal : 2,
    }))
  );
}

function winPartSurvives(result: SystemLegResult | undefined): boolean {
  return result === "won";
}

function placePartSurvives(result: SystemLegResult | undefined): boolean {
  return result === "won" || result === "placed";
}

/**
 * Per-line: void legs drop out at odds 1.0 (the line reduces); a fully-void
 * line refunds the unit stake; otherwise pay the product when every live
 * leg survives, else the stake is lost.
 */
function settlePart(
  combos: number[][],
  unitStake: number,
  effectiveOdds: number[],
  results: SystemLegResult[],
  survives: (result: SystemLegResult) => boolean
): { total: number; paying: number; refunded: number } {
  let total = 0;
  let paying = 0;
  let refunded = 0;
  for (const idxs of combos) {
    const live = idxs.filter((i) => results[i] !== "void");
    if (live.length === 0) {
      refunded += 1;
      total += unitStake;
      continue;
    }
    if (!live.every((i) => survives(results[i]!))) continue;
    paying += 1;
    total += unitStake * live.reduce((p, i) => p * effectiveOdds[i]!, 1);
  }
  return { total: roundPence(total), paying, refunded };
}

/**
 * Settle returns once every leg is won/placed/lost/void.
 * Void legs reduce their lines at odds 1.0; fully-void lines refund.
 * Each-way doubles stake and adds place-part returns at place odds.
 * Paying/refunded line counts feed free-bet (SNR/SR) profit derivation
 * in systems-desk.ts.
 */
export function settleSystemReturns(
  structure: SystemStructureType,
  unitStake: number,
  legs: SystemLegInput[],
  options: SettleSystemOptions = {}
): {
  returns: number;
  winReturns: number;
  placeReturns: number;
  profit: number;
  totalStake: number;
  lines: number;
  /** Lines whose win part paid (all live legs won). */
  winPayingLines: number;
  /** Lines whose place part paid (live legs won or placed). 0 unless each-way. */
  placePayingLines: number;
  /** Fully-void lines, refunded at unit stake per part. */
  refundedLines: number;
} | null {
  const n = systemRequiredLegs(structure);
  if (legs.length !== n || !(unitStake > 0)) return null;
  if (legs.some((l) => l.result === "pending" || l.result == null)) return null;

  const eachWay = Boolean(options.eachWay);
  const placeFraction = options.placeFraction;
  if (eachWay && !(placeFraction != null && placeFraction > 0 && placeFraction < 1)) {
    return null;
  }

  const sizes = accaComboSizes(structure as AccaStructureType, n);
  const combos: number[][] = [];
  for (const size of sizes) {
    for (const idxs of combinationsOfSize(n, size)) combos.push(idxs);
  }
  if (combos.length === 0) return null;

  const lines = combos.length;
  const totalStake = roundPence(unitStake * lines * (eachWay ? 2 : 1));
  const results = legs.map((l) => l.result!);

  if (results.every((r) => r === "void")) {
    return {
      returns: totalStake,
      winReturns: roundPence(unitStake * lines),
      placeReturns: eachWay ? roundPence(unitStake * lines) : 0,
      profit: 0,
      totalStake,
      lines,
      winPayingLines: 0,
      placePayingLines: 0,
      refundedLines: lines,
    };
  }

  const winOdds = legs.map((l) => {
    if (!(l.oddsDecimal > 1) && l.result !== "void") return null;
    return l.oddsDecimal > 1 ? l.oddsDecimal : 1;
  });
  if (winOdds.some((o, i) => o == null && results[i] !== "void")) return null;

  const winPart = settlePart(
    combos,
    unitStake,
    winOdds.map((o) => o ?? 1),
    results,
    winPartSurvives
  );
  const winReturns = winPart.total;

  let placeReturns = 0;
  let placePayingLines = 0;
  if (eachWay && placeFraction != null) {
    const placeOdds = legs.map((l) => {
      if (l.result === "void") return 1;
      if (!(l.oddsDecimal > 1)) return null;
      return placeOddsFromTerms(l.oddsDecimal, placeFraction);
    });
    if (placeOdds.some((o) => o == null)) return null;
    const placePart = settlePart(
      combos,
      unitStake,
      placeOdds as number[],
      results,
      placePartSurvives
    );
    placeReturns = placePart.total;
    placePayingLines = placePart.paying;
  }

  const returns = roundPence(winReturns + placeReturns);
  return {
    returns,
    winReturns,
    placeReturns,
    profit: roundPence(returns - totalStake),
    totalStake,
    lines,
    winPayingLines: winPart.paying,
    placePayingLines,
    refundedLines: winPart.refunded,
  };
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
