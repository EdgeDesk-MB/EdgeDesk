import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, bets } from "@/lib/db";
import {
  listInbox,
  markAllRead,
  markRead,
  markReadByDedupe,
  markReadByDedupePrefix,
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
  });

  it("skips alerts without a key or title", () => {
    const n = recordAlerts([
      { key: "", kind: "x", title: "no key" },
      { key: "test:no-title", kind: "x", title: "" },
    ]);
    expect(n).toBe(0);
  });

  it("marks read by dedupe key (Intentional mute)", () => {
    const before = unreadCount();
    recordAlerts(
      [{ key: "naked_exposure:97", kind: "naked_exposure", title: "Unhedged back bet" }],
      T0
    );
    expect(unreadCount()).toBe(before + 1);
    expect(markReadByDedupe("naked_exposure:97", T0 + 1000)).toBe(1);
    expect(unreadCount()).toBe(before);
    const row = listInbox().find((r) => r.dedupe === "naked_exposure:97");
    expect(row?.readAt).toBe(T0 + 1000);
  });

  it("marks offer_expiring rows read by prefix when an offer is deleted", () => {
    const before = unreadCount();
    recordAlerts(
      [
        {
          key: "offer_expiring:offer-5-place_qualifying:2026-07-13",
          kind: "offer_expiring",
          title: "Offer ends today",
        },
        {
          key: "offer_expiring:offer-50-place_qualifying:2026-07-13",
          kind: "offer_expiring",
          title: "Other offer",
        },
      ],
      T0
    );
    expect(unreadCount()).toBe(before + 2);
    expect(markReadByDedupePrefix("offer_expiring:offer-5-", T0 + 1000)).toBe(1);
    expect(unreadCount()).toBe(before + 1);
    expect(
      listInbox().find((r) => r.dedupe === "offer_expiring:offer-5-place_qualifying:2026-07-13")
        ?.readAt
    ).toBe(T0 + 1000);
    expect(
      listInbox().find((r) => r.dedupe === "offer_expiring:offer-50-place_qualifying:2026-07-13")
        ?.readAt
    ).toBeNull();
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
    expect(row?.body).toBe(`Qualifying · ${bet.label}`);
    expect(row?.updatedAt).toBeGreaterThanOrEqual(T0 + 5000);

    db.delete(bets).where(eq(bets.id, bet.id)).run();
  });
});
