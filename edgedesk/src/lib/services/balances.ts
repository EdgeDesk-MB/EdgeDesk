/**
 * Bankroll ledger: accounts, top-ups, and automatic bet stake / settlement flows.
 */
import { eq, sql } from "drizzle-orm";
import {
  accounts,
  balanceTransactions,
  bets,
  db,
  type AccountRow,
  type BetRow,
} from "@/lib/db";

export interface AccountBalance extends AccountRow {
  balance: number;
  freeBets: number;
}

export interface BalanceSummary {
  total: number;
  bookies: number;
  exchanges: number;
  accounts: AccountBalance[];
}

function accountFreeBetBalance(accountId: number): number {
  return db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.accountId, accountId))
    .all()
    .filter((t) => t.category === "free_bet")
    .reduce((s, t) => s + t.amount, 0);
}

function accountCashBalance(accountId: number): number {
  return db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.accountId, accountId))
    .all()
    .filter((t) => t.category !== "free_bet")
    .reduce((s, t) => s + t.amount, 0);
}

function accountBalance(accountId: number): number {
  return accountCashBalance(accountId);
}

function accountHasLedger(accountId: number): boolean {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(balanceTransactions)
    .where(eq(balanceTransactions.accountId, accountId))
    .get();
  return (row?.n ?? 0) > 0;
}

/** Bookie wallets with balance now or any ledger history (incl. archived). */
export function getSettingsBookies(): AccountBalance[] {
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.type, "bookie"))
    .all()
    .map((a) => ({ ...a, balance: accountBalance(a.id), freeBets: accountFreeBetBalance(a.id) }))
    .filter((a) => a.isActive || a.balance !== 0 || accountHasLedger(a.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getBalanceSummary(): BalanceSummary {
  const allAccounts = db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1))
    .all()
    .sort((a, b) => a.name.localeCompare(b.name));

  const withBalances: AccountBalance[] = allAccounts.map((a) => ({
    ...a,
    balance: accountBalance(a.id),
    freeBets: accountFreeBetBalance(a.id),
  }));

  const bookies = withBalances
    .filter((a) => a.type === "bookie")
    .reduce((s, a) => s + a.balance, 0);
  const exchanges = withBalances
    .filter((a) => a.type === "exchange")
    .reduce((s, a) => s + a.balance, 0);

  return {
    total: bookies + exchanges,
    bookies,
    exchanges,
    accounts: withBalances,
  };
}

export function findBookieAccount(name: string | null | undefined): AccountRow | undefined {
  if (!name?.trim()) return undefined;
  const q = name.trim().toLowerCase();
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1))
    .all()
    .find((a) => a.type === "bookie" && a.name.toLowerCase() === q);
}

export function findExchangeAccount(exchangeId: number | null | undefined): AccountRow | undefined {
  if (!exchangeId) return undefined;
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1))
    .all()
    .find((a) => a.type === "exchange" && a.exchangeId === exchangeId);
}

function insertTx(
  accountId: number,
  amount: number,
  category: (typeof balanceTransactions.$inferInsert)["category"],
  note: string,
  betId?: number
) {
  db.insert(balanceTransactions)
    .values({
      accountId,
      amount,
      category,
      betId,
      note,
      createdAt: Date.now(),
    })
    .run();
}

/** Record top-up, withdrawal, adjustment, or free-bet credit. */
export function recordManualTransaction(
  accountId: number,
  amount: number,
  category: "top_up" | "withdrawal" | "adjustment" | "free_bet",
  note?: string
) {
  insertTx(accountId, amount, category, note ?? category.replace("_", " "));
}

/** Debit back stake and lay liability when a bet is saved. */
export function ledgerBetPlacement(bet: BetRow): boolean {
  if (bet.balanceLedgered) return false;

  const bookie = findBookieAccount(bet.bookmaker);
  const exchange = findExchangeAccount(bet.exchangeId);
  if (!bookie && !exchange) return false;

  const liability = bet.layStake * (bet.layOdds - 1);
  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";

  if (bookie && bet.backStake > 0 && isFree) {
    insertTx(
      bookie.id,
      -bet.backStake,
      "free_bet",
      `Free bet used — ${bet.label}`,
      bet.id
    );
  }
  if (bookie && bet.backStake > 0 && !isFree) {
    insertTx(
      bookie.id,
      -bet.backStake,
      "bet_stake",
      `Back stake — ${bet.label}`,
      bet.id
    );
  }
  if (exchange && liability > 0) {
    insertTx(
      exchange.id,
      -liability,
      "bet_stake",
      `Lay liability — ${bet.label}`,
      bet.id
    );
  }

  db.update(bets).set({ balanceLedgered: 1 }).where(eq(bets.id, bet.id)).run();
  return true;
}

/**
 * Credit settlement payouts to bookie and exchange accounts.
 * Assumes stake debits were recorded at placement.
 */
export function ledgerBetSettlement(bet: BetRow): boolean {
  if (bet.balanceSettled || !bet.balanceLedgered) return false;
  if (bet.status === "void") {
    db.update(bets).set({ balanceSettled: 1 }).where(eq(bets.id, bet.id)).run();
    return false;
  }

  const bookie = findBookieAccount(bet.bookmaker);
  const exchange = findExchangeAccount(bet.exchangeId);
  if (!bookie && !exchange) return false;

  const liability = bet.layStake * (bet.layOdds - 1);
  const layWinnings = bet.layStake * (1 - bet.commission);

  const paid =
    bet.status === "won" || bet.status === "early_payout";
  const early = bet.status === "early_payout";
  const backWon = paid;
  const layLoses = backWon;

  if (bookie && paid) {
    let payout = 0;
    switch (bet.betType) {
      case "free_snr":
        payout = bet.backStake * (bet.backOdds - 1);
        break;
      case "free_sr":
        payout = bet.backStake * bet.backOdds;
        break;
      default:
        payout = bet.backStake * bet.backOdds;
        break;
    }
    if (payout > 0) {
      insertTx(
        bookie.id,
        payout,
        "bet_settlement",
        `Bookie payout (${early ? "2UP" : "back won"}) — ${bet.label}`,
        bet.id
      );
    }
  }

  if (exchange && !layLoses && bet.layStake > 0) {
    insertTx(
      exchange.id,
      liability + layWinnings,
      "bet_settlement",
      `Lay won — ${bet.label}`,
      bet.id
    );
  }

  db.update(bets).set({ balanceSettled: 1 }).where(eq(bets.id, bet.id)).run();
  return true;
}

/** Credit a promotional free-bet award to the bookie wallet. */
export function ledgerPromoAward(bet: BetRow, amount: number, reason: string): boolean {
  if (amount <= 0) return false;
  const bookie = findBookieAccount(bet.bookmaker);
  if (!bookie) return false;

  const existing = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.betId, bet.id))
    .all()
    .some((t) => t.category === "free_bet" && t.amount > 0);
  if (existing) return false;

  insertTx(
    bookie.id,
    amount,
    "free_bet",
    `Free bet promo — ${reason} (${bet.label})`,
    bet.id
  );
  return true;
}

/** Apply ledger when a bet moves to a settled status. */
export function ledgerFromSettledBet(bet: BetRow): void {
  if (bet.status === "open" || bet.status === "void" || bet.balanceSettled) return;
  ledgerBetSettlement(bet);
}

export function getAccountTransactions(accountId: number, limit = 50) {
  return db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.accountId, accountId))
    .all()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

/** Free bet promo credits keyed by bet id (for tracker, events, dashboard). */
export function getPromoAwardsByBetId(): Record<number, { amount: number; reason: string }> {
  const map: Record<number, { amount: number; reason: string }> = {};
  for (const tx of db.select().from(balanceTransactions).all()) {
    if (tx.category !== "free_bet" || tx.betId == null || tx.amount <= 0) continue;
    if (map[tx.betId]) continue;
    const reasonMatch = tx.note?.match(/Free bet promo — (.+?) \(/);
    map[tx.betId] = {
      amount: tx.amount,
      reason: reasonMatch?.[1]?.trim() ?? "Free bet awarded",
    };
  }
  return map;
}
