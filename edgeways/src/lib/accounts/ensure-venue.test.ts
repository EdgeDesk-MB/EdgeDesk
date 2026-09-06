import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, exchanges } from "@/lib/db";
import { ensureBackVenueAccount, ensureVenueAccount } from "./ensure-venue";

describe("ensureVenueAccount", () => {
  beforeEach(() => {
    const rows = db.select().from(accounts).all();
    for (const a of rows) {
      if (a.name.startsWith("TestVenue")) {
        db.delete(accounts).where(eq(accounts.id, a.id)).run();
      }
    }
    const exRows = db.select().from(exchanges).all();
    for (const e of exRows) {
      if (e.name.startsWith("TestVenue")) {
        db.delete(exchanges).where(eq(exchanges.id, e.id)).run();
      }
    }
  });

  it("creates a bookie wallet", () => {
    const r = ensureVenueAccount("TestVenue Bookie", "bookie");
    expect(r.created).toBe(true);
    expect(r.account.type).toBe("bookie");
    expect(r.account.name).toBe("TestVenue Bookie");
    expect(r.exchange).toBeNull();

    const again = ensureVenueAccount("TestVenue Bookie", "bookie");
    expect(again.created).toBe(false);
    expect(again.account.id).toBe(r.account.id);
  });

  it("creates an exchange row + wallet", () => {
    const r = ensureVenueAccount("TestVenue Exchange", "exchange");
    expect(r.created).toBe(true);
    expect(r.account.type).toBe("exchange");
    expect(r.exchange?.name).toBe("TestVenue Exchange");
    expect(r.account.exchangeId).toBe(r.exchange!.id);

    const ex = db
      .select()
      .from(exchanges)
      .all()
      .find((e) => e.name === "TestVenue Exchange");
    expect(ex).toBeTruthy();
  });

  it("uses the existing exchange wallet for an exchange-as-back name", () => {
    const created = ensureVenueAccount("TestVenue Betdaq", "exchange");
    const resolved = ensureBackVenueAccount("TestVenue Betdaq");
    expect(resolved.created).toBe(false);
    expect(resolved.account.id).toBe(created.account.id);
    expect(resolved.account.type).toBe("exchange");
    const bookies = db
      .select()
      .from(accounts)
      .all()
      .filter((a) => a.name === "TestVenue Betdaq" && a.type === "bookie");
    expect(bookies).toHaveLength(0);
  });

  it("creates a bookie when the back name is not an exchange", () => {
    const r = ensureBackVenueAccount("TestVenue Sky Bet");
    expect(r.account.type).toBe("bookie");
    expect(r.created).toBe(true);
  });
});
