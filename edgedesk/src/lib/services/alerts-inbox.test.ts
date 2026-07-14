import { describe, expect, it } from "vitest";
import {
  listInbox,
  markAllRead,
  markRead,
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
});
