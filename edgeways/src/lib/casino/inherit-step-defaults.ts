/**
 * Prefill a new casino campaign step from siblings already on the offer.
 * Ladder tiers reuse games, RTP and per-spin value; the user edits the
 * amounts that change per rung.
 */

import { parseEligibleGamesJson } from "@/lib/casino/eligible-games";

export type CasinoStepInheritSource = {
  amount: number | null;
  wageringMultiplier: number | null;
  rtp: number | null;
  contributionPct: number | null;
  spins: number | null;
  spinValue: number | null;
  chipCount: number | null;
  chipValue: number | null;
  cashbackPct: number | null;
  game: string | null;
  eligibleGamesJson?: string | null;
};

export type CasinoStepInheritDefaults = {
  amount: number | null;
  wageringMultiplier: number | null;
  rtp: number | null;
  contributionPct: number | null;
  spins: number | null;
  spinValue: number | null;
  chipCount: number | null;
  chipValue: number | null;
  cashbackPct: number | null;
  eligibleGameNames: string[];
};

function lastFinite(
  siblings: CasinoStepInheritSource[],
  pick: (row: CasinoStepInheritSource) => number | null
): number | null {
  for (let i = siblings.length - 1; i >= 0; i--) {
    const v = pick(siblings[i]!);
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

export function inheritCasinoStepDefaults(
  siblings: CasinoStepInheritSource[]
): CasinoStepInheritDefaults {
  let eligibleGameNames: string[] = [];
  for (const sibling of siblings) {
    const stored = parseEligibleGamesJson(sibling.eligibleGamesJson);
    if (stored.length > eligibleGameNames.length) eligibleGameNames = stored;
  }

  if (eligibleGameNames.length === 0) {
    const seen = new Set<string>();
    for (let i = siblings.length - 1; i >= 0; i--) {
      const name = siblings[i]!.game?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      eligibleGameNames.push(name);
    }
  }

  return {
    amount: lastFinite(siblings, (r) => r.amount),
    wageringMultiplier: lastFinite(siblings, (r) => r.wageringMultiplier),
    rtp: lastFinite(siblings, (r) => r.rtp),
    contributionPct: lastFinite(siblings, (r) => r.contributionPct),
    spins: lastFinite(siblings, (r) => r.spins),
    spinValue: lastFinite(siblings, (r) => r.spinValue),
    chipCount: lastFinite(siblings, (r) => r.chipCount),
    chipValue: lastFinite(siblings, (r) => r.chipValue),
    cashbackPct: lastFinite(siblings, (r) => r.cashbackPct),
    eligibleGameNames,
  };
}
