import { noVig } from "@/lib/calc/ev";

export interface RunnerFairOdds {
  /** No-vig fair decimal odds for this runner. */
  fair: number;
  /**
   * How much the bookie price deviates from fair, as a percentage.
   * Positive = bookie offering above fair (value). Negative = below fair (margin taken).
   * Formula: (bookieOdds - fairOdds) / fairOdds * 100
   */
  overPct: number;
}

/**
 * Compute per-runner fair odds from the bookie market.
 *
 * Returns null when fewer than 80% of the non-runner field has bookie prices
 * (partial markets produce nonsense overrounds).
 */
export function raceFairOdds(
  runners: Array<{ horseId: string; bookieDecimal?: number | null; nonRunner?: boolean }>
): Map<string, RunnerFairOdds> | null {
  const eligible = runners.filter((r) => !r.nonRunner);
  const priced = eligible.filter((r) => r.bookieDecimal != null && r.bookieDecimal > 1);

  if (eligible.length === 0 || priced.length / eligible.length < 0.8) return null;

  const { fairOdds } = noVig(priced.map((r) => r.bookieDecimal!));

  const result = new Map<string, RunnerFairOdds>();
  priced.forEach((runner, i) => {
    const fair = fairOdds[i];
    const bookie = runner.bookieDecimal!;
    result.set(runner.horseId, {
      fair,
      overPct: ((bookie - fair) / fair) * 100,
    });
  });

  return result;
}
