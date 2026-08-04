/**
 * Derive the exchange commission actually paid on a settled bet, so gross P&L
 * (retained + commission) can be shown alongside retained P&L.
 *
 * Exact by construction: commission is charged only on winning lay legs at
 * `layStake × commission` — the same term the settlement engine nets off in
 * `layStake × (1 − commission)` (see settlement.ts / each-way-outcomes.ts).
 */

import { parseEwMeta } from "@/lib/bets/ew-meta";

export interface CommissionPaidInput {
  betType: string;
  market: string;
  status: string;
  layStake: number;
  commission: number;
  notes: string | null;
}

export function commissionPaidOnSettledBet(bet: CommissionPaidInput): number {
  if (bet.commission <= 0) return 0;
  if (bet.status === "open" || bet.status === "void" || bet.status === "push") return 0;
  // Back-only positions and dutch legs settle without an exchange lay.
  if (bet.betType === "back_only" || bet.betType === "dutch") return 0;

  // Each-way / extra-place dual lays: which lays won depends on the finish,
  // recorded in the settlement explanation appended to notes.
  const ewMeta =
    bet.market === "each_way" || bet.market === "extra_place"
      ? parseEwMeta(bet.notes)
      : null;
  if (ewMeta) {
    const bothLays = (ewMeta.layWin.stake + ewMeta.layPlace.stake) * bet.commission;
    if (bet.status === "lost") return bothLays; // unplaced: both lays won
    if (bet.status === "won") {
      const notes = bet.notes ?? "";
      if (notes.includes("Extra place")) return bothLays;
      if (notes.includes("standard place")) return ewMeta.layWin.stake * bet.commission;
      // "Horse won" (both lays lost) or manually settled with no marker: unknown → 0.
      return 0;
    }
    return 0;
  }

  if (bet.layStake <= 0) return 0;

  // Lay-only status reflects the bookie side inverted: "won" means the lay won.
  if (bet.betType === "lay_only") {
    if (bet.status === "won") return bet.layStake * bet.commission;
    if (bet.status === "half_win" || bet.status === "half_lose") {
      return (bet.layStake * bet.commission) / 2;
    }
    return 0;
  }

  switch (bet.status) {
    case "lost":
      return bet.layStake * bet.commission; // back lost, lay won
    case "early_payout":
      return bet.layStake * bet.commission; // bookie paid early, real result lost → lay won
    case "half_win":
    case "half_lose":
      // Dead-heat average of win (lay lost, £0) and lose (lay won, full commission).
      return (bet.layStake * bet.commission) / 2;
    case "won":
      // Normally the lay lost, but EW fallback (placed-not-won) pays the bookie
      // while the lay also wins - the settlement explanation records it.
      return bet.notes?.includes("lay side won") ? bet.layStake * bet.commission : 0;
    default:
      return 0;
  }
}
