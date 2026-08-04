/**
 * Targets & pace (G1) - factual pace against a monthly profit target.
 * Deliberately unexciting: no streaks, no celebration states, just where the
 * month stands against a straight-line expectation.
 */

export interface MonthPace {
  target: number;
  achieved: number;
  /** £ still needed this month (0 when target met) */
  remaining: number;
  /** Straight-line expectation for today (target × day fraction elapsed) */
  expectedByNow: number;
  /** achieved − expectedByNow; ≥ 0 means on pace */
  delta: number;
  onPace: boolean;
  /** Days left in the month including today */
  daysLeft: number;
  /** £/day needed over the remaining days (0 when target met) */
  dailyNeeded: number;
}

export function computeMonthPace(input: {
  /** Settled profit for the CURRENT calendar month */
  achieved: number;
  target: number | null | undefined;
  now?: number;
}): MonthPace | null {
  const { achieved } = input;
  const target = input.target ?? 0;
  if (!(target > 0)) return null;

  const now = new Date(input.now ?? Date.now());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = daysInMonth - dayOfMonth + 1;

  const expectedByNow = (target * dayOfMonth) / daysInMonth;
  const remaining = Math.max(0, target - achieved);
  const delta = achieved - expectedByNow;

  return {
    target,
    achieved,
    remaining,
    expectedByNow,
    delta,
    // A penny of tolerance so float dust never flips the label
    onPace: delta >= -0.01,
    daysLeft,
    dailyNeeded: remaining > 0 ? remaining / daysLeft : 0,
  };
}

/** Settled profit for the current calendar month from monthly P&L rows. */
export function currentMonthAchieved(
  rows: Array<{ key: string; profit: number }>,
  now = Date.now()
): number {
  const d = new Date(now);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return rows.find((r) => r.key === key)?.profit ?? 0;
}

/** "£162 of £250 · on pace" / "£12.50/day needed" - factual, no confetti. */
export function paceLabel(pace: MonthPace): string {
  const base = `£${pace.achieved.toFixed(0)} of £${pace.target.toFixed(0)}`;
  if (pace.remaining <= 0) return `${base} · target met`;
  if (pace.onPace) return `${base} · on pace`;
  return `${base} · £${pace.dailyNeeded.toFixed(2)}/day needed`;
}
