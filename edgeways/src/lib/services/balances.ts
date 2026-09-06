/**
 * Bankroll ledger: accounts, top-ups, and automatic bet stake / settlement flows.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import "server-only";
import {
  accounts,
  balanceTransactions,
  bets,
  casinoOffers,
  db,
  exchanges,
  history,
  type AccountRow,
  type BetRow,
  type CasinoOfferRow,
} from "@/lib/db";

/** Stable history dedupe for a completed casino campaign. */
export function casinoSettlementDedupe(casinoOfferId: number): string {
  return `casino:${casinoOfferId}`;
}
import { ensureBackVenueAccount, ensureVenueAccount } from "@/lib/accounts/ensure-venue";
import { findVenueBalanceAccount, isBackPlacementDebit } from "@/lib/accounts/resolve-venue";
import {
  freeBetUsageNote,
  selectFreeBetLotForUsage,
  sumFreeBetLotBalance,
} from "@/lib/accounts/free-bet-lot-balance";
import { applyWageringRequirement } from "@/lib/accounts/wagering";
import { roundPence } from "@/lib/calc/money";
import type { DutchLegRecord } from "@/lib/calc/settlement";
import {
  EARLY_FREE_BET_AWARD_REASON,
  unconditionalFreeBetEffect,
} from "@/lib/offers/early-free-bet-award";
import { promoAwardsFromTransactions } from "@/lib/accounts/promo-awards";
import { historyNoteFromManualTx } from "@/lib/services/balances-manual-note";

/** Bet ids whose promo free-bet credits belong to the same offer as `bet`. */
function preferBetIdsForFreeBetUsage(bet: Pick<BetRow, "id" | "offerId">): number[] {
  if (bet.offerId == null) return [bet.id];
  const ids = db
    .select({ id: bets.id })
    .from(bets)
    .where(eq(bets.offerId, bet.offerId))
    .all()
    .map((r) => r.id);
  return ids.length > 0 ? ids : [bet.id];
}

/** Debit a venue free-bet balance, targeting the best matching open lot. */
function ledgerFreeBetUsageDebit(
  accountId: number,
  stake: number,
  label: string,
  bet: Pick<BetRow, "id" | "offerId">
): void {
  const lot = selectFreeBetLotForUsage(accountId, {
    preferBetIds: preferBetIdsForFreeBetUsage(bet),
    stake,
  });
  // Only tag [[lot:N]] when one lot covers the full stake; otherwise FIFO
  // (untagged) can span multiple lots without silently dropping remainder.
  insertTx(accountId, -stake, "free_bet", freeBetUsageNote(label, lot?.id), bet.id);
}

/**
 * Void/push of a free bet: restore the lot by deleting the placement usage
 * debit instead of inserting a new "Void - stake returned" credit (those
 * orphaned as Do-next convert cards and were later spent by FIFO ahead of
 * fresh promo awards).
 */
function restoreFreeBetUsageOnVoid(bet: BetRow): boolean {
  const usage = db
    .select()
    .from(balanceTransactions)
    .where(and(eq(balanceTransactions.betId, bet.id), eq(balanceTransactions.category, "free_bet")))
    .all()
    .filter((t) => t.amount < 0)
    .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)[0];
  if (!usage) return false;
  db.delete(balanceTransactions).where(eq(balanceTransactions.id, usage.id)).run();
  return true;
}

export type { AccountBalance, BalanceSummary } from "@/lib/services/balances.types";
import type { AccountBalance, BalanceSummary } from "@/lib/services/balances.types";

function accountFreeBetBalance(accountId: number): number {
  return sumFreeBetLotBalance(accountId);
}

/**
 * When multiple lay bets cover different outcomes of the same market the
 * exchange only locks the worst-case net liability, not the sum of all
 * individual liabilities (only one outcome can win).
 *
 * Returns the excess that was debited vs what actually needs to be reserved,
 * so it can be added back to the displayed balance.
 *
 * Example: lay Norway @4.8 (liability 75.69) + lay England @1.88 (liability
 * 176.00) on the same match. Sum deducted = 251.69, worst case (England wins)
 * = -176.00 + 19.52 winnings = -156.08. Return = 95.61.
 */
function sharedLiabilityReturn(accountId: number): number {
  // Which bets had their liability ledgered to this account?
  const betIdRows = db
    .select({ betId: balanceTransactions.betId })
    .from(balanceTransactions)
    .where(
      and(
        eq(balanceTransactions.accountId, accountId),
        eq(balanceTransactions.category, "bet_stake"),
        isNotNull(balanceTransactions.betId)
      )
    )
    .all();

  if (betIdRows.length === 0) return 0;
  const betIds = betIdRows.map((r) => r.betId as number);

  // Among those bets, which are still open lay bets on a known event?
  const openLayBets = db
    .select()
    .from(bets)
    .where(inArray(bets.id, betIds))
    .all()
    .filter(
      (b) =>
        b.status === "open" &&
        b.balanceLedgered === 1 &&
        b.layStake > 0 &&
        b.layOdds > 1 &&
        b.eventId != null
    );

  // Group by event (= market)
  const byEvent = new Map<number, typeof openLayBets>();
  for (const bet of openLayBets) {
    const group = byEvent.get(bet.eventId!) ?? [];
    group.push(bet);
    byEvent.set(bet.eventId!, group);
  }

  let totalReturn = 0;

  for (const groupBets of byEvent.values()) {
    if (groupBets.length < 2) continue; // Single lay: no shared-liability benefit

    const totalLiability = groupBets.reduce(
      (sum, b) => sum + b.layStake * (b.layOdds - 1),
      0
    );

    // Simulate each scenario: one selection wins the market (that lay loses),
    // all others win.  Take the worst outcome.
    let worstCase = Infinity;
    for (const loser of groupBets) {
      const loserLiability = loser.layStake * (loser.layOdds - 1);
      const otherWinnings = groupBets
        .filter((b) => b.id !== loser.id)
        .reduce((sum, b) => sum + b.layStake * (1 - b.commission), 0);
      const netOutcome = -loserLiability + otherWinnings;
      if (netOutcome < worstCase) worstCase = netOutcome;
    }

    // Reserve only the worst-case loss (0 if all outcomes are profitable)
    const shouldReserve = worstCase < 0 ? -worstCase : 0;
    totalReturn += totalLiability - shouldReserve;
  }

  return Math.max(0, totalReturn);
}

function accountCashBalance(accountId: number): number {
  const raw = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.accountId, accountId))
    .all()
    .filter((t) => t.category !== "free_bet" && !t.pending)
    .reduce((s, t) => s + t.amount, 0);
  // Round to pence so IEEE dust from summing ledger rows never surfaces as
  // a tiny negative £0.00 (red) or a non-zero compare against exact 0.
  return roundPence(raw + sharedLiabilityReturn(accountId));
}

function accountPendingIn(accountId: number): number {
  return db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.accountId, accountId))
    .all()
    .filter((t) => t.pending && t.amount > 0)
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
    .map((a) => ({
      ...a,
      balance: accountBalance(a.id),
      freeBets: accountFreeBetBalance(a.id),
      pendingIn: accountPendingIn(a.id),
    }))
    .filter((a) => a.isActive || a.balance !== 0 || accountHasLedger(a.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Cash locked by a single open ledgered bet (back stake + lay liability). */
export function openBetInBetsAmount(
  bet: Pick<BetRow, "status" | "balanceLedgered" | "betType" | "backStake" | "layStake" | "layOdds">
): number {
  if (bet.status !== "open" || !bet.balanceLedgered) return 0;
  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";
  const backLocked = isFree || bet.backStake <= 0 ? 0 : bet.backStake;
  const liability =
    bet.layStake > 0 && bet.layOdds > 1 ? bet.layStake * (bet.layOdds - 1) : 0;
  return backLocked + liability;
}

/** Cash currently locked in open positions (Ultimatcher "In bets"). */
export function getOpenInBetsTotal(): number {
  const raw = db
    .select()
    .from(bets)
    .all()
    .reduce((sum, bet) => sum + openBetInBetsAmount(bet), 0);

  // Subtract the shared-liability return across all exchange accounts so that
  // bankroll (liquid + inBets) doesn't double-count the freed liability that
  // is already reflected in the corrected exchange balances.
  const sharedReturn = db
    .select()
    .from(accounts)
    .all()
    .filter((a) => a.type === "exchange")
    .reduce((sum, a) => sum + sharedLiabilityReturn(a.id), 0);

  return Math.max(0, raw - sharedReturn);
}

export function getBalanceSummary(): BalanceSummary {
  const allAccounts = db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1))
    .all()
    .sort((a, b) => {
      const order = { bank: 0, bookie: 1, exchange: 2 } as const;
      const ao = order[a.type as keyof typeof order] ?? 9;
      const bo = order[b.type as keyof typeof order] ?? 9;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });

  const withBalances: AccountBalance[] = allAccounts.map((a) => ({
    ...a,
    balance: accountBalance(a.id),
    freeBets: accountFreeBetBalance(a.id),
    pendingIn: accountPendingIn(a.id),
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
  const inBets = getOpenInBetsTotal();

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

/** Any active bookie or exchange wallet by name (dutch legs may be either). */
function findVenueAccountByName(name: string): AccountRow | undefined {
  return findVenueBalanceAccount(db.select().from(accounts).all(), name);
}

/** Wallet that already took this bet's back-stake debit (keeps settlement on that row). */
function resolveLedgeredBackAccount(bet: BetRow): AccountRow | undefined {
  if (!bet.balanceLedgered) return undefined;
  const txs = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.betId, bet.id))
    .all();
  const debit = txs.find(isBackPlacementDebit);
  if (!debit) return undefined;
  return db.select().from(accounts).where(eq(accounts.id, debit.accountId)).get();
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

/** Create exchange wallet from Settings exchange id when missing. */
export function ensureExchangeAccountForBet(
  exchangeId: number | null | undefined
): AccountRow | undefined {
  if (!exchangeId) return undefined;
  const existing = findExchangeAccount(exchangeId);
  if (existing) return existing;
  const ex = db.select().from(exchanges).where(eq(exchanges.id, exchangeId)).get();
  if (!ex) return undefined;
  return ensureVenueAccount(ex.name, "exchange").account;
}

function insertTx(
  accountId: number,
  amount: number,
  category: (typeof balanceTransactions.$inferInsert)["category"],
  note: string,
  betId?: number,
  opts?: {
    transferGroupId?: string;
    pending?: boolean;
    confirmedAt?: number | null;
    affectPnl?: boolean;
    casinoOfferId?: number;
  }
) {
  db.insert(balanceTransactions)
    .values({
      accountId,
      amount,
      category,
      betId,
      casinoOfferId: opts?.casinoOfferId ?? null,
      transferGroupId: opts?.transferGroupId ?? null,
      pending: opts?.pending ? 1 : 0,
      note,
      createdAt: Date.now(),
      confirmedAt: opts?.confirmedAt ?? null,
      affectPnl: opts?.affectPnl ? 1 : 0,
    })
    .run();
}

/** Drop wallet + history rows tied to a casino campaign (idempotent reverse). */
export function clearCasinoOfferBalance(casinoOfferId: number): void {
  db.delete(balanceTransactions)
    .where(eq(balanceTransactions.casinoOfferId, casinoOfferId))
    .run();
  db.delete(history)
    .where(eq(history.dedupe, casinoSettlementDedupe(casinoOfferId)))
    .run();
}

export type CasinoLedgerOffer = Pick<
  CasinoOfferRow,
  "id" | "casino" | "title" | "status" | "actualProfit" | "completedAt" | "createdAt"
>;

/**
 * Full casino ledger sync: bookie wallet + History/Home feed row.
 *
 * - Wallet: `casino_settlement` balance tx (`affectPnl: false`) so cash moves
 *   without double-counting through the manual-adjustment P&L path.
 * - P&L total: still sourced from `casino_offers.actualProfit` via pnl-buckets.
 * - Feed: `history.kind = casino_settlement` so History and Home show it.
 */
export function syncCasinoOfferBalance(offer: CasinoLedgerOffer): boolean {
  clearCasinoOfferBalance(offer.id);

  if (offer.status !== "completed") return false;
  if (offer.actualProfit == null) return false;

  const amount = roundPence(offer.actualProfit);
  const casino = offer.casino?.trim() || null;
  const when = offer.completedAt ?? offer.createdAt ?? Date.now();
  const detail = casino ? `${casino} · ${offer.title}` : offer.title;

  db.insert(history)
    .values({
      dedupe: casinoSettlementDedupe(offer.id),
      kind: "casino_settlement",
      title: "Casino settled",
      detail,
      amount,
      createdAt: when,
    })
    .run();

  // Zero net or missing venue: feed row still stands; wallet only moves when
  // there is both a named bookie and a non-zero amount.
  if (casino && amount !== 0) {
    const bookie = ensureVenueAccount(casino, "bookie").account;
    insertTx(
      bookie.id,
      amount,
      "casino_settlement",
      `Casino campaign - ${offer.title}`,
      undefined,
      { casinoOfferId: offer.id, affectPnl: false }
    );
  }
  return true;
}

/**
 * Repair completed campaigns missing wallet and/or history rows.
 * Safe on every list / state load - only fills gaps.
 */
export function backfillMissingCasinoOfferBalances(): number {
  const completed = db
    .select()
    .from(casinoOffers)
    .all()
    .filter((o) => o.status === "completed" && o.actualProfit != null);
  let n = 0;
  for (const offer of completed) {
    const hasWallet = db
      .select()
      .from(balanceTransactions)
      .where(eq(balanceTransactions.casinoOfferId, offer.id))
      .get();
    const hasHistory = db
      .select()
      .from(history)
      .where(eq(history.dedupe, casinoSettlementDedupe(offer.id)))
      .get();
    if (hasWallet && hasHistory) continue;
    if (syncCasinoOfferBalance(offer)) n += 1;
  }
  return n;
}

/** Record top-up, withdrawal, adjustment, or free-bet credit. */
export function recordManualTransaction(
  accountId: number,
  amount: number,
  category: "top_up" | "withdrawal" | "adjustment" | "free_bet",
  note?: string,
  opts?: { affectPnl?: boolean }
) {
  const now = Date.now();
  insertTx(accountId, amount, category, note ?? category.replace("_", " "), undefined, {
    affectPnl: opts?.affectPnl,
  });

  if (
    opts?.affectPnl &&
    amount !== 0 &&
    (category === "adjustment" || category === "top_up")
  ) {
    const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    const accountName = account?.name ?? "Account";
    const sign = amount > 0 ? "+" : "";
    const formattedAmount = `${sign}GBP ${Math.abs(amount).toFixed(2)}`;
    const isTopUp = category === "top_up";
    db.insert(history)
      .values({
        dedupe: `${isTopUp ? "topup" : "adj"}:${accountId}:${now}`,
        kind: "balance_adjustment",
        title: isTopUp ? "Top-up" : "Balance correction",
        detail: `${accountName} - ${formattedAmount}`,
        note: historyNoteFromManualTx(note, category),
        amount,
        createdAt: now,
      })
      .run();
  }
}

export type TransferDirection = "to_venue" | "to_bank";

/**
 * Move cash between a bank and a bookie/exchange.
 * Withdrawals to bank can leave the bank credit pending until statement confirmation.
 */
export function transferBetweenAccounts(input: {
  bankAccountId: number;
  venueAccountId: number;
  amount: number;
  /** to_venue = deposit into bookie/exchange; to_bank = withdraw to bank */
  direction: TransferDirection;
  fee?: number;
  note?: string;
  /** When withdrawing to bank, hold bank credit until confirmed (default true) */
  pendingBankCredit?: boolean;
}): { transferGroupId: string } {
  const amount = Math.abs(input.amount);
  if (!(amount > 0)) throw new Error("Amount must be positive");

  const bank = db.select().from(accounts).where(eq(accounts.id, input.bankAccountId)).get();
  const venue = db.select().from(accounts).where(eq(accounts.id, input.venueAccountId)).get();
  if (!bank || !bank.isActive || bank.type !== "bank") {
    throw new Error("Bank account not found");
  }
  if (!venue || !venue.isActive || (venue.type !== "bookie" && venue.type !== "exchange")) {
    throw new Error("Bookie/exchange account not found");
  }

  const fee = Math.max(0, input.fee ?? 0);
  if (fee >= amount && input.direction === "to_bank") {
    throw new Error("Fee must be less than withdrawal amount");
  }

  const groupId = `xfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const noteBase = input.note?.trim();

  if (input.direction === "to_venue") {
    // Bank → venue: bank loses amount (+ optional fee), venue gains amount
    insertTx(
      bank.id,
      -amount,
      "transfer",
      noteBase ?? `Deposit to ${venue.name}`,
      undefined,
      { transferGroupId: groupId }
    );
    if (fee > 0) {
      insertTx(bank.id, -fee, "fee", `Deposit fee`, undefined, {
        transferGroupId: groupId,
      });
    }
    insertTx(
      venue.id,
      amount,
      "transfer",
      noteBase ?? `Deposit from ${bank.name}`,
      undefined,
      { transferGroupId: groupId }
    );
  } else {
    // Venue → bank: venue loses amount; bank gains amount−fee (optionally pending)
    const pending = input.pendingBankCredit !== false;
    const net = amount - fee;
    insertTx(
      venue.id,
      -amount,
      "transfer",
      noteBase ?? `Withdraw to ${bank.name}`,
      undefined,
      { transferGroupId: groupId }
    );
    insertTx(
      bank.id,
      net,
      "transfer",
      noteBase
        ? `${noteBase}${fee > 0 ? ` (−£${fee.toFixed(2)} fee)` : ""}`
        : `Withdraw from ${venue.name}${fee > 0 ? ` (−£${fee.toFixed(2)} fee)` : ""}`,
      undefined,
      { transferGroupId: groupId, pending }
    );
  }

  return { transferGroupId: groupId };
}

/** Confirm a pending bank credit (statement date received). */
export function confirmPendingTransaction(txId: number): boolean {
  const tx = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.id, txId))
    .get();
  if (!tx || !tx.pending) return false;
  db.update(balanceTransactions)
    .set({ pending: 0, confirmedAt: Date.now() })
    .where(eq(balanceTransactions.id, txId))
    .run();
  return true;
}

export function listPendingTransactions(limit = 50) {
  return db
    .select()
    .from(balanceTransactions)
    .all()
    .filter((t) => t.pending)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

/**
 * Dutch bets hedge internally and aren't otherwise ledgered - but a leg
 * flagged as a free bet still needs to draw down that venue's tracked
 * free-bet balance, same as a normal free_snr/free_sr bet does.
 */
function ledgerDutchFreeLegs(bet: BetRow): boolean {
  if (!bet.legs) return false;
  const legs = JSON.parse(bet.legs) as DutchLegRecord[];
  let ledgered = false;
  for (const leg of legs) {
    if (!leg.freeBet || !leg.bookmaker?.trim() || !(leg.stake > 0)) continue;
    const account =
      findVenueAccountByName(leg.bookmaker) ?? ensureBackVenueAccount(leg.bookmaker).account;
    ledgerFreeBetUsageDebit(
      account.id,
      leg.stake,
      `${bet.label} (${leg.label})`,
      bet
    );
    ledgered = true;
  }
  db.update(bets).set({ balanceLedgered: 1 }).where(eq(bets.id, bet.id)).run();
  return ledgered;
}

/**
 * Re-sync a dutch bet's free-bet ledger entries after its legs are edited.
 * PATCH doesn't run `ledgerBetPlacement` (that's create-only), so without
 * this an edit that adds, removes or re-stakes a free-bet leg would leave
 * the venue's tracked free-bet balance silently out of sync.
 */
export function reledgerDutchFreeLegs(bet: BetRow): void {
  if (bet.betType !== "dutch") return;
  db.delete(balanceTransactions)
    .where(and(eq(balanceTransactions.betId, bet.id), eq(balanceTransactions.category, "free_bet")))
    .run();
  ledgerDutchFreeLegs(bet);
}

/**
 * Clear placement debits for an open bet (cash stake, free-bet used, lay
 * liability). Leaves promo free-bet credits (positive free_bet) untouched.
 */
function clearOpenBetPlacementDebits(betId: number): void {
  const txs = db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.betId, betId))
    .all();
  for (const t of txs) {
    const placementDebit =
      t.category === "bet_stake" || (t.category === "free_bet" && t.amount < 0);
    if (!placementDebit) continue;
    db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
  }
}

/**
 * Remove every ledger row for a bet that is being deleted, so stake /
 * settlement / free-bet lines cannot orphan on bookie balances.
 */
export function purgeLedgerForDeletedBet(betId: number): void {
  db.delete(balanceTransactions)
    .where(eq(balanceTransactions.betId, betId))
    .run();
}

/**
 * Re-sync placement ledger after an open bet is edited (stake, lay, bookie,
 * or cash ↔ free funding). Skips wagering-requirement updates: WR burn is not
 * stored per bet, so an inverse would guess wrong after the remaining hits 0.
 * Create-time `ledgerBetPlacement` still applies WR as before.
 */
export function reledgerOpenBetPlacement(_previous: BetRow, next: BetRow): void {
  if (next.status !== "open" || next.balanceSettled) return;
  if (next.betType === "dutch") {
    reledgerDutchFreeLegs(next);
    return;
  }

  clearOpenBetPlacementDebits(next.id);
  db.update(bets).set({ balanceLedgered: 0 }).where(eq(bets.id, next.id)).run();
  ledgerBetPlacement({ ...next, balanceLedgered: 0 }, { applyWagering: false });
}

/** Debit back stake and lay liability when a bet is saved. */
export function ledgerBetPlacement(
  bet: BetRow,
  opts?: { applyWagering?: boolean }
): boolean {
  if (bet.balanceLedgered) return false;
  if (bet.betType === "dutch") return ledgerDutchFreeLegs(bet);

  // First-use: create wallets so tracked bets always move money (Ultimatcher-style).
  const bookie = bet.bookmaker?.trim()
    ? ensureBackVenueAccount(bet.bookmaker).account
    : undefined;
  const exchange = ensureExchangeAccountForBet(bet.exchangeId);
  if (!bookie && !exchange) return false;

  const liability = bet.layStake * (bet.layOdds - 1);
  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";
  const applyWagering = opts?.applyWagering !== false;

  if (bookie && bet.backStake > 0 && isFree) {
    ledgerFreeBetUsageDebit(bookie.id, bet.backStake, bet.label, bet);
  }
  if (bookie && bet.backStake > 0 && !isFree) {
    insertTx(
      bookie.id,
      -bet.backStake,
      "bet_stake",
      `Back stake - ${bet.label}`,
      bet.id
    );
    if (applyWagering) applyWageringRequirement(bet, bookie.id);
  }
  if (exchange && liability > 0) {
    insertTx(
      exchange.id,
      -liability,
      "bet_stake",
      `Lay liability - ${bet.label}`,
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

  const bookie = resolveLedgeredBackAccount(bet) ??
    (bet.bookmaker?.trim()
      ? ensureBackVenueAccount(bet.bookmaker).account
      : findBookieAccount(bet.bookmaker));
  const exchange =
    ensureExchangeAccountForBet(bet.exchangeId) ?? findExchangeAccount(bet.exchangeId);
  if (!bookie && !exchange) return false;

  const liability = bet.layStake * (bet.layOdds - 1);
  const layWinnings = bet.layStake * (1 - bet.commission);
  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";

  if (bet.status === "void" || bet.status === "push") {
    if (bookie && bet.backStake > 0) {
      if (isFree) {
        // Restore by deleting the usage debit. If none remains (already
        // restored, or never debited), do not insert a free_bet credit —
        // that created orphan "Void - stake returned" lots and could
        // double-credit on reopen → re-void.
        restoreFreeBetUsageOnVoid(bet);
      } else {
        insertTx(
          bookie.id,
          bet.backStake,
          "bet_settlement",
          `${bet.status === "push" ? "Push" : "Void"} - stake returned - ${bet.label}`,
          bet.id
        );
      }
    }
    if (exchange && liability > 0) {
      insertTx(
        exchange.id,
        liability,
        "bet_settlement",
        `${bet.status === "push" ? "Push" : "Void"} - liability returned - ${bet.label}`,
        bet.id
      );
    }
    db.update(bets).set({ balanceSettled: 1 }).where(eq(bets.id, bet.id)).run();
    return true;
  }

  const early = bet.status === "early_payout";
  const half = bet.status === "half_win" || bet.status === "half_lose";
  const paid = bet.status === "won" || early;
  const bookieFactor = half ? 0.5 : paid ? 1 : 0;

  if (bookie && bookieFactor > 0) {
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
    payout *= bookieFactor;
    if (payout > 0) {
      const label = half
        ? bet.status === "half_win"
          ? "half win"
          : "half lose"
        : early
          ? "2UP"
          : "back won";
      insertTx(
        bookie.id,
        payout,
        "bet_settlement",
        `Bookie payout (${label}) - ${bet.label}`,
        bet.id
      );
    }
  }

  const layCreditFactor = half ? 0.5 : paid ? 0 : 1;
  if (exchange && layCreditFactor > 0 && bet.layStake > 0) {
    insertTx(
      exchange.id,
      (liability + layWinnings) * layCreditFactor,
      "bet_settlement",
      half ? `Lay half settled - ${bet.label}` : `Lay won - ${bet.label}`,
      bet.id
    );
  }

  db.update(bets).set({ balanceSettled: 1 }).where(eq(bets.id, bet.id)).run();
  return true;
}

/** Credit a promotional free-bet award to the bookie wallet. */
export function ledgerPromoAward(bet: BetRow, amount: number, reason: string): boolean {
  if (amount <= 0) return false;
  if (!bet.bookmaker?.trim()) return false;
  const bookie = ensureBackVenueAccount(bet.bookmaker).account;

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
    `Free bet promo - ${reason} (${bet.label})`,
    bet.id
  );
  return true;
}

/**
 * Credit an unconditional free bet before settlement (bookie released it on placement).
 * Idempotent: a later settlement pass will not credit again.
 */
export function awardUnconditionalFreeBetEarly(
  bet: BetRow,
  offerTitle?: string | null
): { ok: true; amount: number } | { ok: false; error: string } {
  if (bet.status === "void") {
    return { ok: false, error: "Void bets cannot award a free bet" };
  }
  if (bet.betType === "free_snr" || bet.betType === "free_sr") {
    return { ok: false, error: "Conversion bets cannot award a free bet" };
  }
  const effect = unconditionalFreeBetEffect(bet, offerTitle);
  if (!effect) {
    return { ok: false, error: "Bet has no unconditional free-bet reward" };
  }
  if (!bet.bookmaker?.trim()) {
    return { ok: false, error: "Bookmaker is required to credit the free bet" };
  }

  const credited = ledgerPromoAward(bet, effect.amount, EARLY_FREE_BET_AWARD_REASON);
  if (!credited) {
    return { ok: false, error: "Free bet already credited for this bet" };
  }
  return { ok: true, amount: effect.amount };
}

/** Apply ledger when a bet moves to a settled status. */
export function ledgerFromSettledBet(bet: BetRow): void {
  if (bet.status === "open" || bet.balanceSettled) return;
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
  return promoAwardsFromTransactions(db.select().from(balanceTransactions).all());
}
