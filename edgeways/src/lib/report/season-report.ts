/**
 * Season summary (G3) - the year the way B8 tells the month. Per-month
 * expected vs realised with capture, commission drag and retention, plus the
 * year's best and worst bookmakers. Months before the first EV lock are
 * annotated as pre-capture history rather than shown as misleading 100%s.
 */

import type { BetRow } from "@/lib/db/schema";
import { commissionPaidOnSettledBet } from "@/lib/calc/commission-paid";
import { roundPence } from "@/lib/calc/money";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";

export interface SeasonMonthRow {
  /** YYYY-MM */
  month: string;
  /** Sum of locked EV for campaigns settled this month; null = no locks */
  expected: number | null;
  /** Realised campaign P&L against those locks; null = no locks */
  realized: number | null;
  captureRate: number | null;
  /** Settled bet profit for the month (all bets, not just campaigns) */
  profit: number;
  commissionDrag: number;
  retention: { rate: number; sampleSize: number } | null;
  settledBets: number;
  settledCampaigns: number;
}

export interface SeasonBookieRow {
  bookmaker: string;
  profit: number;
  settledBets: number;
}

export interface SeasonReport {
  year: number;
  months: SeasonMonthRow[];
  totals: {
    profit: number;
    expected: number;
    realized: number;
    captureRate: number | null;
    commissionDrag: number;
  };
  /** First month with an EV lock - capture data starts here */
  captureFrom: string | null;
  bestBookie: SeasonBookieRow | null;
  worstBookie: SeasonBookieRow | null;
}

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isSettled(b: BetRow): boolean {
  return b.settledAt != null && b.status !== "open" && b.status !== "void";
}

export function buildSeasonReport(input: {
  snapshots: EvSnapshotRow[];
  bets: BetRow[];
  year: number;
}): SeasonReport {
  const { snapshots, bets, year } = input;
  const inYear = (ms: number) => new Date(ms).getFullYear() === year;

  const yearBets = bets.filter((b) => isSettled(b) && inYear(b.settledAt!));
  const yearSnaps = snapshots.filter((s) => s.settledAt != null && inYear(s.settledAt));

  const monthsWithData = new Set<string>([
    ...yearBets.map((b) => monthKey(b.settledAt!)),
    ...yearSnaps.map((s) => monthKey(s.settledAt!)),
  ]);

  const months: SeasonMonthRow[] = [...monthsWithData].sort().map((month) => {
    const monthBets = yearBets.filter((b) => monthKey(b.settledAt!) === month);
    const monthSnaps = yearSnaps.filter((s) => monthKey(s.settledAt!) === month);

    const expected = monthSnaps.reduce((sum, s) => sum + s.expectedProfit, 0);
    const realized = monthSnaps.reduce((sum, s) => sum + (s.realizedProfit ?? 0), 0);
    const profit = roundPence(monthBets.reduce((sum, b) => sum + (b.actualProfit ?? 0), 0));
    const commissionDrag = roundPence(
      monthBets.reduce((sum, b) => sum + commissionPaidOnSettledBet(b), 0)
    );

    const conversions = monthBets.filter(
      (b) => (b.betType === "free_snr" || b.betType === "free_sr") && b.backStake > 0
    );
    const face = conversions.reduce((sum, b) => sum + b.backStake, 0);
    const retained = conversions.reduce((sum, b) => sum + (b.actualProfit ?? 0), 0);

    return {
      month,
      expected: monthSnaps.length > 0 ? roundPence(expected) : null,
      realized: monthSnaps.length > 0 ? roundPence(realized) : null,
      captureRate:
        monthSnaps.length > 0 && Math.abs(expected) > 0.01 ? realized / expected : null,
      profit,
      commissionDrag,
      retention:
        conversions.length > 0 && face > 0
          ? { rate: roundPence(retained / face), sampleSize: conversions.length }
          : null,
      settledBets: monthBets.length,
      settledCampaigns: monthSnaps.length,
    };
  });

  const totalExpected = roundPence(yearSnaps.reduce((sum, s) => sum + s.expectedProfit, 0));
  const totalRealized = roundPence(
    yearSnaps.reduce((sum, s) => sum + (s.realizedProfit ?? 0), 0)
  );

  const byBookie = new Map<string, SeasonBookieRow>();
  for (const b of yearBets) {
    if (!b.bookmaker) continue;
    const key = b.bookmaker.trim();
    const row = byBookie.get(key.toLowerCase()) ?? { bookmaker: key, profit: 0, settledBets: 0 };
    row.profit = roundPence(row.profit + (b.actualProfit ?? 0));
    row.settledBets += 1;
    byBookie.set(key.toLowerCase(), row);
  }
  const bookies = [...byBookie.values()].sort((a, b) => b.profit - a.profit);

  const lockedInYear = snapshots.filter((s) => inYear(s.lockedAt));
  const captureFrom =
    lockedInYear.length > 0
      ? monthKey(Math.min(...lockedInYear.map((s) => s.lockedAt)))
      : null;

  return {
    year,
    months,
    totals: {
      profit: roundPence(yearBets.reduce((sum, b) => sum + (b.actualProfit ?? 0), 0)),
      expected: totalExpected,
      realized: totalRealized,
      captureRate: Math.abs(totalExpected) > 0.01 ? totalRealized / totalExpected : null,
      commissionDrag: roundPence(
        yearBets.reduce((sum, b) => sum + commissionPaidOnSettledBet(b), 0)
      ),
    },
    captureFrom,
    bestBookie: bookies[0] ?? null,
    worstBookie: bookies.length > 1 ? bookies[bookies.length - 1]! : null,
  };
}

/** Years with any settled bet or campaign, newest first. */
export function seasonYears(snapshots: EvSnapshotRow[], bets: BetRow[]): number[] {
  const years = new Set<number>();
  for (const s of snapshots) if (s.settledAt != null) years.add(new Date(s.settledAt).getFullYear());
  for (const b of bets) if (isSettled(b)) years.add(new Date(b.settledAt!).getFullYear());
  return [...years].sort((a, b) => b - a);
}
