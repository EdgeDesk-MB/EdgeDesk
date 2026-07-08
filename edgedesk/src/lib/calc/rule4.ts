/**
 * UK Rule 4 deduction: pence in the £1 of winnings (10p = 10% off winnings).
 * Effective odds after deduction: 1 + (odds - 1) × (1 - deduction/100).
 */

export interface Rule4Result {
  effectiveOdds: number;
  originalWinnings: number;
  adjustedWinnings: number;
  deductionPct: number;
}

export function rule4EffectiveOdds(odds: number, deductionPence: number): number {
  if (!(odds > 1) || deductionPence <= 0) return odds;
  const retention = Math.max(0, Math.min(100, 100 - deductionPence)) / 100;
  return 1 + (odds - 1) * retention;
}

export function rule4Adjust(
  stake: number,
  odds: number,
  deductionPence: number
): Rule4Result {
  const deductionPct = Math.max(0, Math.min(100, deductionPence));
  const originalWinnings = stake * (odds - 1);
  const adjustedWinnings = originalWinnings * (1 - deductionPct / 100);
  return {
    effectiveOdds: rule4EffectiveOdds(odds, deductionPence),
    originalWinnings,
    adjustedWinnings,
    deductionPct,
  };
}

/** Standard Tattersalls Rule 4 deduction table (pence in the £). */
export const RULE4_PRESETS = [
  { pence: 5, label: "5p" },
  { pence: 10, label: "10p" },
  { pence: 15, label: "15p" },
  { pence: 20, label: "20p" },
  { pence: 25, label: "25p" },
  { pence: 30, label: "30p" },
  { pence: 35, label: "35p" },
  { pence: 40, label: "40p" },
  { pence: 45, label: "45p" },
  { pence: 50, label: "50p" },
  { pence: 55, label: "55p" },
  { pence: 60, label: "60p" },
  { pence: 65, label: "65p" },
  { pence: 70, label: "70p" },
  { pence: 75, label: "75p" },
  { pence: 80, label: "80p" },
  { pence: 85, label: "85p" },
  { pence: 90, label: "90p" },
] as const;
