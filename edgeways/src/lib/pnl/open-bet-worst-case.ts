/**
 * Headline Prov is the worst outcome path of open positions.
 *
 * A lock-in lay/back logged as a sibling of the original single shares
 * event + market + selection, so the pair is valued together:
 * min(sum if selection wins, sum if selection loses).
 *
 * Live "if ended now" is a football display reading (sumEventIfEndedNow)
 * and the Home Live chart tip (sumLiveChartProvisional). It must not feed
 * headline Prov.
 */
import { settleFromOutcome, type BetType, type SettleableBet } from "@/lib/calc/settlement";
import { roundPence } from "@/lib/calc/money";
import { openBetExpectedProfit } from "@/lib/pnl/open-bet-valuation";
import type { BetRow } from "@/lib/db/schema";

const TWO_WAY_TYPES = new Set<string>([
  "qualifying",
  "boost",
  "free_snr",
  "free_sr",
  "risk_free",
  "back_only",
  "lay_only",
]);

const SPLIT_MARKETS = new Set<string>(["each_way", "extra_place"]);

export type WorstCaseBet = {
  id: number;
  status: string;
  eventId: number | null;
  market: string;
  selection: string;
  betType: string;
  backStake: number;
  backOdds: number;
  layStake: number;
  layOdds: number;
  commission: number;
  refundAmount: number | null;
  refundRetention: number | null;
  legs: string | null;
  expectedProfit: number | null;
};

function hasBack(bet: WorstCaseBet): boolean {
  return bet.backStake > 0 && bet.backOdds > 1;
}

function hasLay(bet: WorstCaseBet): boolean {
  return bet.layStake > 0 && bet.layOdds > 1;
}

function canTwoWaySettle(bet: WorstCaseBet): boolean {
  if (bet.status !== "open") return false;
  if (bet.legs) return false;
  if (SPLIT_MARKETS.has(bet.market)) return false;
  if (!TWO_WAY_TYPES.has(bet.betType)) return false;
  return hasBack(bet) || hasLay(bet);
}

function toSettleable(bet: WorstCaseBet): SettleableBet {
  return {
    market: bet.market as SettleableBet["market"],
    selection: bet.selection,
    betType: bet.betType as BetType,
    backStake: bet.backStake,
    backOdds: bet.backOdds,
    layStake: bet.layStake,
    layOdds: bet.layOdds,
    commission: bet.commission,
    refundAmount: bet.refundAmount ?? undefined,
    refundRetention: bet.refundRetention ?? undefined,
  };
}

function twoWayWorst(bet: WorstCaseBet): number {
  const row = toSettleable(bet);
  return Math.min(settleFromOutcome(row, true).profit, settleFromOutcome(row, false).profit);
}

function groupKey(bet: WorstCaseBet): string {
  const selection = bet.selection.trim().toLowerCase();
  if (bet.eventId == null || !bet.market || !selection) return `solo:${bet.id}`;
  return `${bet.eventId}|${bet.market}|${selection}`;
}

function pairWorstCase(group: WorstCaseBet[]): number | null {
  if (group.length === 0 || !group.every(canTwoWaySettle)) return null;
  const combined = group.length >= 2 || group.some((b) => hasBack(b) && hasLay(b));
  if (!combined) return null;

  let ifWin = 0;
  let ifLose = 0;
  for (const bet of group) {
    const row = toSettleable(bet);
    ifWin += settleFromOutcome(row, true).profit;
    ifLose += settleFromOutcome(row, false).profit;
  }
  return Math.min(ifWin, ifLose);
}

function fallbackWorstCase(bet: WorstCaseBet): number {
  const expected = openBetExpectedProfit({
    status: bet.status as BetRow["status"],
    expectedProfit: bet.expectedProfit,
  });
  if (expected != null) return expected;
  if (canTwoWaySettle(bet)) return twoWayWorst(bet);
  return 0;
}

/** Worst-case contribution of all open bets to headline Prov. */
export function sumOpenWorstCaseProfit(
  bets: WorstCaseBet[],
  opts?: { excludeBetIds?: Iterable<number> }
): number {
  const exclude = opts?.excludeBetIds ? new Set(opts.excludeBetIds) : null;
  const groups = new Map<string, WorstCaseBet[]>();

  for (const bet of bets) {
    if (bet.status !== "open") continue;
    if (exclude?.has(bet.id)) continue;
    const key = groupKey(bet);
    const list = groups.get(key);
    if (list) list.push(bet);
    else groups.set(key, [bet]);
  }

  let total = 0;
  for (const group of groups.values()) {
    const paired = pairWorstCase(group);
    if (paired != null) {
      total += paired;
      continue;
    }
    for (const bet of group) total += fallbackWorstCase(bet);
  }
  return roundPence(total);
}

export type IfEndedNowPosition = {
  eventId?: number;
  snapshotProvisional: number | null;
};

/** Match-level "if ended now" for Home → Live → Events (football only). */
export function sumEventIfEndedNow(
  positions: IfEndedNowPosition[],
  eventId: number
): number | null {
  let total = 0;
  let any = false;
  for (const position of positions) {
    if (position.eventId !== eventId) continue;
    if (position.snapshotProvisional == null || Number.isNaN(position.snapshotProvisional)) {
      continue;
    }
    total += position.snapshotProvisional;
    any = true;
  }
  return any ? roundPence(total) : null;
}

export type LiveChartPosition = {
  betId: number;
  kind?: string;
  snapshotProvisional: number | null;
};

/**
 * Open contribution for the Home Live chart: if-ended-now snapshots on
 * live tracker positions, worst-case on everything else.
 *
 * Desk campaign rows (acca / bet builder / systems) stay on
 * `extraProvisional` so their square is not double-counted.
 */
export function sumLiveChartProvisional(
  bets: WorstCaseBet[],
  livePositions: LiveChartPosition[],
  opts?: { excludeBetIds?: Iterable<number>; extraProvisional?: number }
): number {
  const exclude = new Set(opts?.excludeBetIds ?? []);
  const snapshots = new Map<number, number>();
  for (const position of livePositions) {
    if (position.kind && position.kind !== "bet") continue;
    if (exclude.has(position.betId)) continue;
    if (position.snapshotProvisional == null || Number.isNaN(position.snapshotProvisional)) {
      continue;
    }
    snapshots.set(position.betId, position.snapshotProvisional);
  }

  const rest = sumOpenWorstCaseProfit(bets, {
    excludeBetIds: [...exclude, ...snapshots.keys()],
  });
  let liveNow = 0;
  for (const value of snapshots.values()) liveNow += value;
  return roundPence(rest + liveNow + (opts?.extraProvisional ?? 0));
}
