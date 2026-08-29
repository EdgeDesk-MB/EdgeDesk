import "server-only";

import { listNeonDeskBets } from "@/lib/db/neon-desk";
import {
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
} from "@/lib/db/neon-desk-accounts";
import {
  balanceSummaryFromRows,
  settingsBookiesFromRows,
} from "@/lib/services/balance-summary";
import type { AccountBalance, BalanceSummary } from "@/lib/services/balances.types";

async function neonDeskLedgerRows() {
  return Promise.all([
    listNeonDeskAccounts(),
    listNeonDeskBalanceTransactions(),
    listNeonDeskBets(),
  ]);
}

export async function getNeonDeskBalanceSummary(): Promise<BalanceSummary> {
  const [accounts, transactions, bets] = await neonDeskLedgerRows();
  return balanceSummaryFromRows(accounts, transactions, bets);
}

export async function getNeonDeskSettingsBookies(): Promise<AccountBalance[]> {
  const [accounts, transactions, bets] = await neonDeskLedgerRows();
  return settingsBookiesFromRows(accounts, transactions, bets);
}
