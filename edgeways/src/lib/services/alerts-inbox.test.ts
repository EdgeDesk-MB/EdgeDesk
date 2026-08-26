import { describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, alertsInbox, bets, offers } from "@/lib/db";
import {
  listInbox,
  listInboxDedupes,
  markAllRead,
  markRead,
  markReadByDedupe,
  markReadByDedupePrefix,
  pruneOrphanConditionAlerts,
  reconcileVoidedSettlementAlerts,
  recordAlerts,
  unreadCount,
} from "./alerts-inbox";

const T0 = new Date(2026, 6, 14, 9, 0).getTime();

describe("alerts inbox", () => {
  it("records, dedupes on re-fire, and preserves read state", () => {
    const before = unreadCount();
    recordAlerts(
      [
        { key: "test:offer:1", kind: "offer_expiring", title: "Offer ends today", href: "/offers" },
        { key: "test:naked:2", kind: "naked_exposure", title: "Unhedged back", body: "£50 riding" },
      ],
      T0
    );
    expect(unreadCount()).toBe(before + 2);

    // Re-fire updates the row, no duplicate
    recordAlerts(
      [{ key: "test:offer:1", kind: "offer_expiring", title: "Offer ends today (updated)" }],
      T0 + 1000
    );
    expect(unreadCount()).toBe(before + 2);
    const rows = listInbox();
    const updated = rows.find((r) => r.dedupe === "test:offer:1")!;
    expect(updated.title).toBe("Offer ends today (updated)");
    expect(updated.updatedAt).toBe(T0 + 1000);
    expect(updated.createdAt).toBe(T0);

    // Read one, then a re-fire keeps it read (same condition)
    markRead(updated.id, T0 + 2000);
    expect(unreadCount()).toBe(before + 1);
    recordAlerts([{ key: "test:offer:1", kind: "offer_expiring", title: "again" }], T0 + 3000);
    expect(unreadCount()).toBe(before + 1);

    // Mark all read clears the rest
    markAllRead(T0 + 4000);
    expect(unreadCount()).toBe(0);
    expect(listInboxDedupes()).toEqual(
      expect.arrayContaining(["test:offer:1", "test:naked:2"])
    );
  });

  it("skips alerts without a key or title", () => {
    const n = recordAlerts([
      { key: "", kind: "x", title: "no key" },
      { key: "test:no-title", kind: "x", title: "" },
    ]);
    expect(n).toBe(0);
  });

  it("marks read by dedupe key (Intentional mute)", () => {
    const bet = db
      .insert(bets)
      .values({
        label: "Unhedged back",
        market: "win",
        selection: "Home",
        betType: "qualifying",
        bookmaker: "Paddy Power",
        backStake: 10,
        backOdds: 2,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "open",
        createdAt: T0,
      })
      .returning()
      .get();
    const key = `naked_exposure:${bet.id}`;
    const before = unreadCount();
    recordAlerts([{ key, kind: "naked_exposure", title: "Unhedged back bet" }], T0);
    expect(unreadCount()).toBe(before + 1);
    expect(markReadByDedupe(key, T0 + 1000)).toBe(1);
    expect(unreadCount()).toBe(before);
    const row = listInbox().find((r) => r.dedupe === key);
    expect(row?.readAt).toBe(T0 + 1000);
    db.delete(alertsInbox).where(eq(alertsInbox.dedupe, key)).run();
    db.delete(bets).where(eq(bets.id, bet.id)).run();
  });

  it("drops condition alerts whose desk row is gone", () => {
    recordAlerts(
      [
        {
          key: "naked_exposure:40",
          kind: "naked_exposure",
          title: "⚠️ Lay missing · full stake exposed",
          body: "Qualifying · Acca insurance, 3-fold (Paddy Power)",
        },
        {
          key: "naked_exposure:80",
          kind: "naked_exposure",
          title: "⚠️ Lay missing · full stake exposed",
          body: "Qualifying · Yankee on the card (Coral)",
        },
        { key: "test:keep:1", kind: "daily_tasks", title: "Keep this" },
      ],
      T0
    );
    expect(pruneOrphanConditionAlerts()).toBe(2);
    const rows = listInbox();
    expect(rows.some((r) => r.dedupe.startsWith("naked_exposure:"))).toBe(false);
    expect(rows.some((r) => r.dedupe === "test:keep:1")).toBe(true);
  });

  it("does not persist inbox rows on the hosted neon stand-in", () => {
    const backend = process.env.EDGEWAYS_DESK_BACKEND;
    const databaseUrl = process.env.DATABASE_URL;
    process.env.EDGEWAYS_DESK_BACKEND = "neon";
    process.env.DATABASE_URL = "postgres://example";
    try {
      expect(
        recordAlerts([
          { key: "naked_exposure:40", kind: "naked_exposure", title: "Lay missing" },
        ])
      ).toBe(0);
      expect(listInbox()).toEqual([]);
      expect(unreadCount()).toBe(0);
    } finally {
      if (backend === undefined) delete process.env.EDGEWAYS_DESK_BACKEND;
      else process.env.EDGEWAYS_DESK_BACKEND = backend;
      if (databaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = databaseUrl;
    }
  });

  it("keeps a dismiss-before-record row read when the inbox write lands later", () => {
    const before = unreadCount();
    expect(markReadByDedupe("result_settled:99", T0)).toBe(1);
    expect(unreadCount()).toBe(before);
    recordAlerts(
      [
        {
          key: "result_settled:99",
          kind: "result_settled",
          title: "You just made £4.10",
          body: "Qualifying · Weekend accumulator",
        },
      ],
      T0 + 1000
    );
    expect(unreadCount()).toBe(before);
    const row = listInbox().find((r) => r.dedupe === "result_settled:99");
    expect(row?.title).toBe("You just made £4.10");
    expect(row?.body).toBe("Qualifying · Weekend accumulator");
    expect(row?.readAt).toBe(T0);
  });

  it("marks offer_expiring rows read by prefix when an offer is deleted", () => {
    const offerA = db
      .insert(offers)
      .values({ title: "Place qualifying", createdAt: T0 })
      .returning()
      .get();
    const offerB = db
      .insert(offers)
      .values({ title: "Other offer", createdAt: T0 })
      .returning()
      .get();
    const keyA = `offer_expiring:offer-${offerA.id}-place_qualifying:2026-07-13`;
    const keyB = `offer_expiring:offer-${offerB.id}-place_qualifying:2026-07-13`;
    const before = unreadCount();
    recordAlerts(
      [
        { key: keyA, kind: "offer_expiring", title: "Offer ends today" },
        { key: keyB, kind: "offer_expiring", title: "Other offer" },
      ],
      T0
    );
    expect(unreadCount()).toBe(before + 2);
    expect(markReadByDedupePrefix(`offer_expiring:offer-${offerA.id}-`, T0 + 1000)).toBe(1);
    expect(unreadCount()).toBe(before + 1);
    expect(listInbox().find((r) => r.dedupe === keyA)?.readAt).toBe(T0 + 1000);
    expect(listInbox().find((r) => r.dedupe === keyB)?.readAt).toBeNull();
    db.delete(alertsInbox).where(inArray(alertsInbox.dedupe, [keyA, keyB])).run();
    db.delete(offers).where(inArray(offers.id, [offerA.id, offerB.id])).run();
  });

  it("rewrites result_settled inbox rows when the bet is later voided", () => {
    const bet = db
      .insert(bets)
      .values({
        label: "Winner Regal Desire",
        market: "win",
        selection: "Regal Desire",
        betType: "qualifying",
        bookmaker: "Paddy Power",
        backStake: 10,
        backOdds: 3,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "void",
        actualProfit: 0,
        createdAt: T0,
        settledAt: T0,
      })
      .returning()
      .get();

    recordAlerts(
      [
        {
          key: `result_settled:${bet.id}`,
          kind: "result_settled",
          title: `🟢 +£6.52 settled`,
          body: `Qualifying · ${bet.label}`,
        },
      ],
      T0
    );

    expect(reconcileVoidedSettlementAlerts(T0 + 5000)).toBe(1);
    const row = listInbox().find((r) => r.dedupe === `result_settled:${bet.id}`);
    expect(row?.title).toBe("Void · stakes returned");
    expect(row?.body).toBe(`Qualifying · ${bet.label} (Paddy Power)`);
    expect(row?.updatedAt).toBeGreaterThanOrEqual(T0 + 5000);

    db.delete(bets).where(eq(bets.id, bet.id)).run();
  });
});
