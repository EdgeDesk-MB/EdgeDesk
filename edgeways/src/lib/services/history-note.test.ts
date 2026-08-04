import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, balanceTransactions, history } from "@/lib/db";
import { recordManualTransaction } from "@/lib/services/balances";
import { updateHistoryNote } from "@/lib/services/history-feed";

function wipe() {
  for (const a of db.select().from(accounts).all()) {
    if (!a.name.startsWith("HistNote")) continue;
    for (const t of db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((tx) => tx.accountId === a.id)) {
      db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
    }
    for (const h of db
      .select()
      .from(history)
      .all()
      .filter((row) => row.dedupe?.includes(`:${a.id}:`))) {
      db.delete(history).where(eq(history.id, h.id)).run();
    }
    db.delete(accounts).where(eq(accounts.id, a.id)).run();
  }
}

describe("updateHistoryNote", () => {
  beforeEach(() => wipe());

  it("sets and clears a note on balance_adjustment rows", () => {
    const account = db
      .insert(accounts)
      .values({
        name: "HistNote Bookie",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    recordManualTransaction(account.id, 0.2, "adjustment", undefined, { affectPnl: true });
    const row = db
      .select()
      .from(history)
      .all()
      .find((h) => h.kind === "balance_adjustment" && h.dedupe?.startsWith(`adj:${account.id}:`));
    expect(row).toBeTruthy();

    const updated = updateHistoryNote(row!.id, "  Tote rebate  ");
    expect(updated?.note).toBe("Tote rebate");

    const cleared = updateHistoryNote(row!.id, "   ");
    expect(cleared?.note).toBeNull();
  });

  it("rejects notes on non-adjustment history kinds", () => {
    const inserted = db
      .insert(history)
      .values({
        dedupe: `histnote:settlement:${Date.now()}`,
        kind: "settlement",
        title: "Bet won",
        detail: null,
        note: null,
        amount: 5,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    expect(updateHistoryNote(inserted.id, "nope")).toBeNull();
    db.delete(history).where(eq(history.id, inserted.id)).run();
  });
});
