import type { BetRow, ExchangeRow } from "@/lib/db/schema";

export interface MonthlyPnLRow {
  key: string;
  label: string;
  profit: number;
  betCount: number;
}

export interface AccountPnLRow {
  name: string;
  kind: "bookmaker" | "exchange" | "unknown";
  profit: number;
  betCount: number;
}

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

export function computeMonthlyBreakdown(bets: BetRow[]): MonthlyPnLRow[] {
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

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, { profit, betCount }]) => ({
      key,
      label: monthLabel(key),
      profit,
      betCount,
    }));
}

export function computeAccountBreakdown(
  bets: BetRow[],
  exchanges: ExchangeRow[] = []
): AccountPnLRow[] {
  const exchangeById = new Map(exchanges.map((e) => [e.id, e.name]));
  const map = new Map<string, AccountPnLRow>();

  for (const bet of bets) {
    if (!isSettledBet(bet)) continue;

    let name: string;
    let kind: AccountPnLRow["kind"];

    if (bet.exchangeId != null && bet.layStake > 0) {
      name = exchangeById.get(bet.exchangeId) ?? `Exchange #${bet.exchangeId}`;
      kind = "exchange";
    } else if (bet.bookmaker?.trim()) {
      name = bet.bookmaker.trim();
      kind = "bookmaker";
    } else {
      name = "Unassigned";
      kind = "unknown";
    }

    const row = map.get(name) ?? { name, kind, profit: 0, betCount: 0 };
    row.profit += bet.actualProfit ?? 0;
    row.betCount += 1;
    map.set(name, row);
  }

  return [...map.values()].sort((a, b) => b.profit - a.profit);
}
