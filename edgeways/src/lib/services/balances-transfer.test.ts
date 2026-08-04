import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, balanceTransactions } from "@/lib/db";
import {
  confirmPendingTransaction,
  getBalanceSummary,
  transferBetweenAccounts,
} from "@/lib/services/balances";

function wipeTestAccounts() {
  for (const a of db.select().from(accounts).all()) {
    if (a.name.startsWith("XferTest")) {
      for (const t of db
        .select()
        .from(balanceTransactions)
        .all()
        .filter((tx) => tx.accountId === a.id)) {
        db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
      }
      db.delete(accounts).where(eq(accounts.id, a.id)).run();
    }
  }
}

describe("transferBetweenAccounts", () => {
  beforeEach(() => wipeTestAccounts());

  it("deposits bank → bookie and withdraws with pending credit", () => {
    const bank = db
      .insert(accounts)
      .values({
        name: "XferTest Bank",
        type: "bank",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    const bookie = db
      .insert(accounts)
      .values({
        name: "XferTest Bookie",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    db.insert(balanceTransactions)
      .values({
        accountId: bank.id,
        amount: 200,
        category: "top_up",
        note: "Opening",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();

    transferBetweenAccounts({
      bankAccountId: bank.id,
      venueAccountId: bookie.id,
      amount: 50,
      direction: "to_venue",
      fee: 1,
    });

    let summary = getBalanceSummary();
    const bankBal = summary.accounts.find((a) => a.id === bank.id)!;
    const bookieBal = summary.accounts.find((a) => a.id === bookie.id)!;
    expect(bankBal.balance).toBeCloseTo(149); // 200 - 50 - 1 fee
    expect(bookieBal.balance).toBeCloseTo(50);

    transferBetweenAccounts({
      bankAccountId: bank.id,
      venueAccountId: bookie.id,
      amount: 20,
      direction: "to_bank",
      fee: 0.5,
      pendingBankCredit: true,
    });

    summary = getBalanceSummary();
    const bank2 = summary.accounts.find((a) => a.id === bank.id)!;
    const bookie2 = summary.accounts.find((a) => a.id === bookie.id)!;
    expect(bookie2.balance).toBeCloseTo(30);
    // Pending credit not in balance yet
    expect(bank2.balance).toBeCloseTo(149);
    expect(bank2.pendingIn).toBeCloseTo(19.5);
    expect(summary.pendingBankCredits).toBeCloseTo(19.5);

    const pendingTx = db
      .select()
      .from(balanceTransactions)
      .all()
      .find((t) => t.accountId === bank.id && t.pending);
    expect(pendingTx).toBeTruthy();
    confirmPendingTransaction(pendingTx!.id);

    summary = getBalanceSummary();
    const bank3 = summary.accounts.find((a) => a.id === bank.id)!;
    expect(bank3.balance).toBeCloseTo(168.5);
    expect(bank3.pendingIn).toBe(0);
  });
});
