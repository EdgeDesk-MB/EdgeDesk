/**
 * Core fields that make an offer runnable after paste / manual fill.
 * Used for the paste strip progress bar (not the same as paste-provenance ticks).
 */

export type OfferFormReadinessInput = {
  isRacing: boolean;
  title: string;
  bookmaker: string;
  expiresAtMs: number | null;
  minOdds: string;
  /** Non-racing qualifier stake (Important → Min stake). */
  minStake: string;
  /** Racing qualifier stake. */
  betStake: string;
  freeBetAmount: string;
};

export type OfferFormReadiness = {
  completed: number;
  total: number;
  /** 0–100 for progress bars. */
  percent: number;
};

function filled(value: string | number | null | undefined): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return value.trim() !== "";
}

/**
 * Essentials checklist for sports / racing offer forms.
 * Racing can omit a typed title when stake → free bet is set (auto title).
 */
export function computeOfferFormReadiness(
  input: OfferFormReadinessInput
): OfferFormReadiness {
  const titleOk =
    filled(input.title) ||
    (input.isRacing && filled(input.betStake) && filled(input.freeBetAmount));

  const qualifierOk = input.isRacing
    ? filled(input.betStake)
    : filled(input.minStake);

  const rewardOk = input.isRacing
    ? filled(input.freeBetAmount)
    : // Non-racing reward is usually encoded in the title; treat a clear
      // title + qualifier as enough, but still count freeBetAmount when set.
      filled(input.freeBetAmount) || filled(input.title);

  const checks = [
    titleOk,
    filled(input.bookmaker),
    input.expiresAtMs != null,
    qualifierOk,
    filled(input.minOdds),
    rewardOk,
  ];

  const completed = checks.filter(Boolean).length;
  const total = checks.length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export type CasinoFormReadinessInput = {
  casino: string;
  title: string;
  hasDraft: boolean;
};

export function computeCasinoFormReadiness(
  input: CasinoFormReadinessInput
): OfferFormReadiness {
  const checks = [filled(input.casino), filled(input.title), input.hasDraft];
  const completed = checks.filter(Boolean).length;
  const total = checks.length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
