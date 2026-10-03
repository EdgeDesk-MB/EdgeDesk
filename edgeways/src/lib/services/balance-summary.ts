/**
 * Pure bankroll summary over in-memory rows. The hosted (Neon) desk cannot
 * import services/balances.ts (it opens SQLite at module load), so the ledger
 * maths is mirrored here row-for-row: accountCashBalance, accountPendingIn,
 * sharedLiabilityReturn and getOpenInBetsTotal. Free-bet lots stay SQLite-only
 * until a caller passes `freeBetBalanceByAccount` (hosted derives it from
 * free_bet ledger rows).
 */
import { roundPence } from "@/lib/calc/money";
import {
  openLedgeredLays,
  sharedLiabilityReturn,
} from "@/lib/calc/shared-liability";
import type {
  AccountRow,
  BalanceTransactionRow,
  BetRow,
} from "@/lib/db/schema";
import type {
  AccountBalance,
  BalanceSummary,
} from "@/lib/services/balances.types";

/** Cash locked by a single open ledgered bet (back stake + lay liability). */
export function openBetInBetsAmountFromRow(
  bet: Pick<
    BetRow,
    "status" | "balanceLedgered" | "betType" | "backStake" | "layStake" | "layOdds"
  >
): number {
  if (bet.status !== "open" || !bet.balanceLedgered) return 0;
  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";
  const backLocked = isFree || bet.backStake <= 0 ? 0 : bet.backStake;
  const liability =
    bet.layStake > 0 && bet.layOdds > 1 ? bet.layStake * (bet.layOdds - 1) : 0;
  return backLocked + liability;
}

/**
 * When multiple lay bets cover different results of the same single-winner
 * market the exchange only locks the worst case, not the sum of the
 * individual liabilities. Returns the excess that was debited bet by bet, so
 * it can be added back to the displayed balance.
 *
 * The maths lives in `calc/shared-liability.ts`, shared with the SQLite desk
 * and the Add bet funding check so all three agree.
 */
function sharedLiabilityReturnFromRows(
  accountId: number,
  transactions: BalanceTransactionRow[],
  bets: BetRow[]
): number {
  const betIds = new Set(
    transactions
      .filter(
        (t) =>
          t.accountId === accountId &&
          t.category === "bet_stake" &&
          t.betId != null
      )
      .map((t) => t.betId as number)
  );
  if (betIds.size === 0) return 0;

  return sharedLiabilityReturn(
    openLedgeredLays(bets.filter((b) => betIds.has(b.id)))
  );
}

function accountCashBalanceFromRows(
  accountId: number,
  transactions: BalanceTransactionRow[],
  bets: BetRow[]
): number {
  const raw = transactions
    .filter(
      (t) => t.accountId === accountId && t.category !== "free_bet" && !t.pending
    )
    .reduce((s, t) => s + t.amount, 0);
  // Round to pence so IEEE dust from summing ledger rows never surfaces as
  // a tiny negative £0.00 (red) or a non-zero compare against exact 0.
  return roundPence(raw + sharedLiabilityReturnFromRows(accountId, transactions, bets));
}

function accountPendingInFromRows(
  accountId: number,
  transactions: BalanceTransactionRow[]
): number {
  return transactions
    .filter((t) => t.accountId === accountId && t.pending && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
}

/** Bookie wallets with cash now or any ledger history, including archived. */
export function settingsBookiesFromRows(
  accounts: AccountRow[],
  transactions: BalanceTransactionRow[],
  bets: BetRow[]
): AccountBalance[] {
  const hasLedger = new Set(transactions.map((t) => t.accountId));
  return accounts
    .filter((a) => a.type === "bookie")
    .map((a) => ({
      ...a,
      balance: accountCashBalanceFromRows(a.id, transactions, bets),
      freeBets: 0,
      pendingIn: accountPendingInFromRows(a.id, transactions),
    }))
    .filter((a) => a.isActive || a.balance !== 0 || hasLedger.has(a.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function balanceSummaryFromRows(
  accounts: AccountRow[],
  transactions: BalanceTransactionRow[],
  bets: BetRow[],
  freeBetBalanceByAccount: Record<number, number> = {}
): BalanceSummary {
  const allAccounts = accounts
    .filter((a) => a.isActive === 1)
    .sort((a, b) => {
      const order = { bank: 0, bookie: 1, exchange: 2 } as const;
      const ao = order[a.type as keyof typeof order] ?? 9;
      const bo = order[b.type as keyof typeof order] ?? 9;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });

  const withBalances: AccountBalance[] = allAccounts.map((a) => ({
    ...a,
    balance: accountCashBalanceFromRows(a.id, transactions, bets),
    freeBets: freeBetBalanceByAccount[a.id] ?? 0,
    pendingIn: accountPendingInFromRows(a.id, transactions),
  }));

  const bookies = withBalances
    .filter((a) => a.type === "bookie")
    .reduce((s, a) => s + a.balance, 0);
  const exchangesTotal = withBalances
    .filter((a) => a.type === "exchange")
    .reduce((s, a) => s + a.balance, 0);
  const banks = withBalances
    .filter((a) => a.type === "bank")
    .reduce((s, a) => s + a.balance, 0);
  const pendingBankCredits = withBalances
    .filter((a) => a.type === "bank")
    .reduce((s, a) => s + a.pendingIn, 0);

  const liquid = bookies + exchangesTotal + banks;

  const rawInBets = bets.reduce(
    (sum, bet) => sum + openBetInBetsAmountFromRow(bet),
    0
  );
  // Subtract the shared-liability return across all exchange accounts so that
  // bankroll (liquid + inBets) doesn't double-count the freed liability that
  // is already reflected in the corrected exchange balances.
  // Note: SQLite getOpenInBetsTotal sums over ALL exchange accounts; this
  // port sums active ones only (archived exchange with open lays is the only
  // divergence, and active-only is the more consistent reading).
  const sharedReturn = withBalances
    .filter((a) => a.type === "exchange")
    .reduce(
      (s, a) => s + sharedLiabilityReturnFromRows(a.id, transactions, bets),
      0
    );
  const inBets = Math.max(0, rawInBets - sharedReturn);

  return {
    total: liquid,
    bookies,
    exchanges: exchangesTotal,
    banks,
    pendingBankCredits,
    inBets: Math.round(inBets * 100) / 100,
    bankroll: Math.round((liquid + inBets) * 100) / 100,
    accounts: withBalances,
  };
}
