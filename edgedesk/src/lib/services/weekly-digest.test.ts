import { describe, expect, it, beforeEach } from "vitest";
import { db, alertsInbox, appSettings, bets, offers, offerEvSnapshots } from "@/lib/db";
import { maybeSendWeeklyDigest, isoWeekKey } from "./weekly-digest";

// Wed 15 Jul 2026 10:00 local. Current ISO week starts Mon 13 Jul; the
// digest window is the COMPLETED week Mon 6 Jul 00:00 → Mon 13 Jul 00:00.
const WEDNESDAY = new Date(2026, 6, 15, 10, 0).getTime();
const MONDAY_0800 = new Date(2026, 6, 13, 8, 0).getTime();
const MONDAY_0930 = new Date(2026, 6, 13, 9, 30).getTime();
const IN_LAST_WEEK = new Date(2026, 6, 8, 14, 0).getTime();

function setSetting(key: string, value: string): void {
  db.insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } })
    .run();
}

function seedSettledCampaign(): void {
  const offer = db
    .insert(offers)
    .values({ title: "Bet £10 get £10", status: "completed", createdAt: IN_LAST_WEEK })
    .returning()
    .get();
  db.insert(offerEvSnapshots)
    .values({
      offerId: offer.id,
      version: 1,
      lockedAt: IN_LAST_WEEK - 3_600_000,
      expectedProfit: 8,
      basis: "estimated",
      realizedProfit: 7.5,
      capturePct: 0.9375,
      settledAt: IN_LAST_WEEK,
    })
    .run();
}

beforeEach(() => {
  db.delete(alertsInbox).run();
  db.delete(offerEvSnapshots).run();
  db.delete(bets).run();
  db.delete(offers).run();
  db.delete(appSettings).run();
});

describe("isoWeekKey", () => {
  it("keys Mon 13 Jul 2026 and Sun 19 Jul 2026 to the same ISO week", () => {
    expect(isoWeekKey(new Date(2026, 6, 13))).toBe(isoWeekKey(new Date(2026, 6, 19)));
    expect(isoWeekKey(new Date(2026, 6, 13))).not.toBe(isoWeekKey(new Date(2026, 6, 12)));
  });
});

describe("maybeSendWeeklyDigest", () => {
  it("does nothing when the toggle is off (opt-in)", () => {
    seedSettledCampaign();
    expect(maybeSendWeeklyDigest(WEDNESDAY)).toBe(false);
    expect(db.select().from(alertsInbox).all()).toHaveLength(0);
  });

  it("not due before Monday 09:00", () => {
    setSetting("digestWeekly", "true");
    seedSettledCampaign();
    expect(maybeSendWeeklyDigest(MONDAY_0800)).toBe(false);
    expect(db.select().from(alertsInbox).all()).toHaveLength(0);
  });

  it("sends once after Monday 09:00: inbox row with the completed week's numbers", () => {
    setSetting("digestWeekly", "true");
    seedSettledCampaign();

    expect(maybeSendWeeklyDigest(MONDAY_0930)).toBe(true);
    const rows = db.select().from(alertsInbox).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("weekly_digest");
    // 7.50 / 8.00 = 94%
    expect(rows[0].title).toBe("Your week: +£7.50 captured (94%)");
    expect(rows[0].href).toBe("/report");
    expect(rows[0].dedupe).toBe(`digest:${isoWeekKey(new Date(MONDAY_0930))}`);
  });

  it("latches: a second poll the same week is a no-op", () => {
    setSetting("digestWeekly", "true");
    seedSettledCampaign();
    expect(maybeSendWeeklyDigest(MONDAY_0930)).toBe(true);
    expect(maybeSendWeeklyDigest(WEDNESDAY)).toBe(false);
    expect(db.select().from(alertsInbox).all()).toHaveLength(1);
  });

  it("an empty week latches without sending (never nag, no retry spin)", () => {
    setSetting("digestWeekly", "true");
    expect(maybeSendWeeklyDigest(WEDNESDAY)).toBe(false);
    expect(db.select().from(alertsInbox).all()).toHaveLength(0);
    // Latch written: a later poll with data appearing mid-week still no-ops.
    seedSettledCampaign();
    expect(maybeSendWeeklyDigest(WEDNESDAY)).toBe(false);
  });

  it("campaigns settled THIS week are not in the completed-week window", () => {
    setSetting("digestWeekly", "true");
    const offer = db
      .insert(offers)
      .values({ title: "This week", status: "completed", createdAt: WEDNESDAY })
      .returning()
      .get();
    db.insert(offerEvSnapshots)
      .values({
        offerId: offer.id,
        version: 1,
        lockedAt: WEDNESDAY - 3_600_000,
        expectedProfit: 5,
        basis: "estimated",
        realizedProfit: 5,
        capturePct: 1,
        settledAt: WEDNESDAY - 60_000,
      })
      .run();
    expect(maybeSendWeeklyDigest(WEDNESDAY)).toBe(false);
    expect(db.select().from(alertsInbox).all()).toHaveLength(0);
  });
});
