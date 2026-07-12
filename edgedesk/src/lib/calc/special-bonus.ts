/**
 * Ultimatcher-style special bonuses on the bookie (back) side of a matched bet.
 * Adjusts bookie win/lose returns so the lay stake equalises both outcomes.
 *
 * Refund-IF is already covered by `risk_free` + the Refund-If calculator.
 */

export type SpecialBonusKind =
  | "none"
  | "double_winnings"
  | "double_return"
  | "free_bet_on_win"
  | "free_bet_on_lose"
  | "bonus_cash_on_win"
  | "bonus_cash_on_lose";

export interface SpecialBonus {
  kind: SpecialBonusKind;
  /** Double offers: max stake that qualifies (defaults to full back stake) */
  maxStake?: number;
  /** Double offers: max extra payout (omit = uncapped) */
  maxReturn?: number;
  /** Free-bet face value or cash bonus £ */
  amount?: number;
  /** Awarded free bet SNR vs SR (informational; value uses retention) */
  freeBetType?: "snr" | "sr";
  /** Perceived cash value of an awarded free bet (0–1). Default 0.7 */
  freeBetRetention?: number;
}

export const SPECIAL_BONUS_LABELS: Record<SpecialBonusKind, string> = {
  none: "None",
  double_winnings: "Double winnings",
  double_return: "Double return",
  free_bet_on_win: "Free bet on win",
  free_bet_on_lose: "Free bet on lose",
  bonus_cash_on_win: "Bonus £ on win",
  bonus_cash_on_lose: "Bonus £ on lose",
};

export const SPECIAL_BONUS_HINTS: Record<SpecialBonusKind, string> = {
  none: "Standard matched bet - no bookie-side bonus.",
  double_winnings: "Bookie doubles your winnings (not stake) up to a cap.",
  double_return: "Bookie doubles the full return (stake + winnings) up to a cap.",
  free_bet_on_win: "Win → free bet awarded. Lay sized so both sides include FB value.",
  free_bet_on_lose: "Lose → free bet awarded (e.g. money-back as FB). Uses retention %.",
  bonus_cash_on_win: "Win → cash bonus credited (not a free bet).",
  bonus_cash_on_lose: "Lose → cash bonus / refund credited.",
};

function clampExtra(raw: number, maxReturn?: number): number {
  if (!(raw > 0)) return 0;
  if (maxReturn != null && Number.isFinite(maxReturn) && maxReturn >= 0) {
    return Math.min(raw, maxReturn);
  }
  return raw;
}

/** Extra bookie credit from a special bonus, split by outcome. */
export function specialBonusExtras(
  backStake: number,
  backOdds: number,
  bonus: SpecialBonus | undefined
): { onWin: number; onLose: number } {
  if (!bonus || bonus.kind === "none") return { onWin: 0, onLose: 0 };

  const stake = Number.isFinite(backStake) && backStake > 0 ? backStake : 0;
  const odds = Number.isFinite(backOdds) && backOdds > 1 ? backOdds : 1;
  const eligible =
    bonus.maxStake != null && Number.isFinite(bonus.maxStake) && bonus.maxStake > 0
      ? Math.min(stake, bonus.maxStake)
      : stake;
  const amount = bonus.amount != null && Number.isFinite(bonus.amount) ? Math.max(0, bonus.amount) : 0;
  const retention = bonus.freeBetRetention ?? 0.7;

  switch (bonus.kind) {
    case "double_winnings": {
      // Extra = another set of winnings on the eligible stake
      const extra = clampExtra(eligible * (odds - 1), bonus.maxReturn);
      return { onWin: extra, onLose: 0 };
    }
    case "double_return": {
      // Extra = another full return (stake + winnings) on the eligible stake
      const extra = clampExtra(eligible * odds, bonus.maxReturn);
      return { onWin: extra, onLose: 0 };
    }
    case "free_bet_on_win":
      return { onWin: amount * retention, onLose: 0 };
    case "free_bet_on_lose":
      return { onWin: 0, onLose: amount * retention };
    case "bonus_cash_on_win":
      return { onWin: amount, onLose: 0 };
    case "bonus_cash_on_lose":
      return { onWin: 0, onLose: amount };
    default:
      return { onWin: 0, onLose: 0 };
  }
}

export function applySpecialBonus(
  win: number,
  lose: number,
  backStake: number,
  backOdds: number,
  bonus: SpecialBonus | undefined
): { win: number; lose: number } {
  const { onWin, onLose } = specialBonusExtras(backStake, backOdds, bonus);
  return { win: win + onWin, lose: lose + onLose };
}

export function isSpecialBonusActive(bonus: SpecialBonus | undefined): boolean {
  return !!bonus && bonus.kind !== "none";
}
