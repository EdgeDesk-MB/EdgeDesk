import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, balanceTransactions, history } from "@/lib/db";
import { recordManualTransaction } from "@/lib/services/balances";

function wipe() {
  for (const a of db.select().from(accounts).all()) {
    if (!a.name.startsWith("PnlTopUp")) continue;
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

describe("recordManualTransaction affectPnl", () => {
  beforeEach(() => wipe());

  it("writes a P&L history row for top-ups when affectPnl is set", () => {
    const account = db
      .insert(accounts)
      .values({
        name: "PnlTopUp Bookie",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    recordManualTransaction(account.id, 50, "top_up", "Bank transfer", { affectPnl: true });

    const tx = db
      .select()
      .from(balanceTransactions)
      .all()
      .find((t) => t.accountId === account.id && t.category === "top_up");
    expect(tx?.affectPnl).toBe(1);

    const row = db
      .select()
      .from(history)
      .all()
      .find((h) => h.kind === "balance_adjustment" && h.dedupe?.startsWith(`topup:${account.id}:`));
    expect(row?.title).toBe("Top-up");
    expect(row?.amount).toBe(50);
    expect(row?.detail).toContain("PnlTopUp Bookie");
    expect(row?.note).toBe("Bank transfer");
  });

  it("skips auto-generated adjustment notes on the history row", () => {
    const account = db
      .insert(accounts)
      .values({
        name: "PnlTopUp AutoNote",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    recordManualTransaction(account.id, 1.25, "adjustment", "Balance set to £10.00", {
      affectPnl: true,
    });

    const row = db
      .select()
      .from(history)
      .all()
      .find((h) => h.kind === "balance_adjustment" && h.dedupe?.startsWith(`adj:${account.id}:`));
    expect(row?.note).toBeNull();
  });

  it("does not write P&L history for top-ups without affectPnl", () => {
    const account = db
      .insert(accounts)
      .values({
        name: "PnlTopUp Quiet",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    recordManualTransaction(account.id, 25, "top_up", "Quiet top-up");

    const rows = db
      .select()
      .from(history)
      .all()
      .filter((h) => h.dedupe?.startsWith(`topup:${account.id}:`));
    expect(rows).toHaveLength(0);
  });
});
