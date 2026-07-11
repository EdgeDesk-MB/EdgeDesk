import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, exchanges } from "@/lib/db";
import { ensureVenueAccount } from "./ensure-venue";

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
});
