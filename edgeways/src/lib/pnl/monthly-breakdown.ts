import type { BetRow } from "@/lib/db/schema";

export interface MonthlyPnLRow {
  key: string;
  label: string;
  profit: number;
  betCount: number;
}

export interface AccountPnLRow {
  name: string;
  kind: "bookmaker" | "unknown";
  profit: number;
  betCount: number;
}

/**
 * Method roll-up for P&L Breakdown.
 * Seeded with Boost (bet type) and Casino; more methods can be added later.
 */
export interface MethodPnLRow {
  key: string;
  label: string;
  profit: number;
  betCount: number;
}

/** Lightweight casino P&L point for monthly totals (from AppState.casinoSettlements). */
export type MonthlyCasinoSettlement = {
  time: number;
  amount: number;
};

function isSettledBet(bet: BetRow): boolean {
  return bet.status !== "void" && bet.status !== "open" && bet.actualProfit != null;
}

function monthKeyFromTimestamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

export function computeMonthlyBreakdown(
  bets: BetRow[],
  casinoSettlements: MonthlyCasinoSettlement[] = []
): MonthlyPnLRow[] {
  const map = new Map<string, { profit: number; betCount: number }>();

  for (const bet of bets) {
    if (!isSettledBet(bet)) continue;
    const ts = bet.settledAt ?? bet.createdAt;
    const key = monthKeyFromTimestamp(ts);
    const row = map.get(key) ?? { profit: 0, betCount: 0 };
    row.profit += bet.actualProfit ?? 0;
    row.betCount += 1;
    map.set(key, row);
  }

  for (const c of casinoSettlements) {
    const key = monthKeyFromTimestamp(c.time);
    const row = map.get(key) ?? { profit: 0, betCount: 0 };
    row.profit += c.amount;
    row.betCount += 1;
    map.set(key, row);
  }

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, { profit, betCount }]) => ({
      key,
      label: monthLabel(key),
      profit,
      betCount,
    }));
}

/**
 * Settled profit by bookie account.
 * Matched bets still credit the bookmaker used for the back, never the lay exchange.
 */
export function computeAccountBreakdown(
  bets: BetRow[],
  casinoSettlements: { amount: number; casino: string | null }[] = []
): AccountPnLRow[] {
  const map = new Map<string, AccountPnLRow>();

  for (const bet of bets) {
    if (!isSettledBet(bet)) continue;

    const bookie = bet.bookmaker?.trim();
    const name = bookie || "Unassigned";
    const kind: AccountPnLRow["kind"] = bookie ? "bookmaker" : "unknown";

    const row = map.get(name) ?? { name, kind, profit: 0, betCount: 0 };
    row.profit += bet.actualProfit ?? 0;
    row.betCount += 1;
    map.set(name, row);
  }

  for (const c of casinoSettlements) {
    const name = c.casino?.trim() || "Casino";
    const row = map.get(name) ?? { name, kind: "bookmaker", profit: 0, betCount: 0 };
    row.profit += c.amount;
    row.betCount += 1;
    map.set(name, row);
  }

  return [...map.values()].sort((a, b) => b.profit - a.profit);
}

/**
 * Settled profit by method. Today: Boost bet type + Casino campaigns.
 * Other bet types are omitted until more method buckets are added.
 */
export function computeMethodBreakdown(
  bets: BetRow[],
  casinoSettlements: MonthlyCasinoSettlement[] = []
): MethodPnLRow[] {
  let boostProfit = 0;
  let boostCount = 0;
  for (const bet of bets) {
    if (!isSettledBet(bet)) continue;
    if (bet.betType !== "boost") continue;
    boostProfit += bet.actualProfit ?? 0;
    boostCount += 1;
  }

  let casinoProfit = 0;
  let casinoCount = 0;
  for (const c of casinoSettlements) {
    casinoProfit += c.amount;
    casinoCount += 1;
  }

  const rows: MethodPnLRow[] = [];
  if (boostCount > 0) {
    rows.push({
      key: "boost",
      label: "Bet type (Boost only)",
      profit: boostProfit,
      betCount: boostCount,
    });
  }
  if (casinoCount > 0) {
    rows.push({
      key: "casino",
      label: "Casino",
      profit: casinoProfit,
      betCount: casinoCount,
    });
  }
  return rows.sort((a, b) => b.profit - a.profit);
}
