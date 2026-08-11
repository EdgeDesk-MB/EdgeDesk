import { beforeEach, describe, expect, it } from "vitest";
import { db, alertsInbox, appSettings, offers } from "@/lib/db";
import { localDayKey, maybeSendDailyTasksDigest } from "./daily-tasks-digest";

const DAY_MS = 86_400_000;
// 2026-08-06 10:00 local — after the 09:00 gate.
const AFTER_NINE = new Date(2026, 7, 6, 10, 0).getTime();
const BEFORE_NINE = new Date(2026, 7, 6, 8, 0).getTime();

function setSetting(key: string, value: string): void {
  db.insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } })
    .run();
}

beforeEach(() => {
  db.delete(alertsInbox).run();
  db.delete(offers).run();
  db.delete(appSettings).run();
});

describe("localDayKey", () => {
  it("formats local calendar day", () => {
    expect(localDayKey(new Date(2026, 7, 6, 10, 0))).toBe("2026-08-06");
  });
});

describe("maybeSendDailyTasksDigest", () => {
  it("does nothing when offer reminders are off", () => {
    setSetting("offerRemindersEnabled", "false");
    db.insert(offers)
      .values({
        title: "Bet £10 get £10",
        status: "active",
        bookmaker: "Betfair Sportsbook",
        expiresAt: AFTER_NINE + DAY_MS,
        createdAt: AFTER_NINE,
      })
      .run();
    expect(maybeSendDailyTasksDigest(AFTER_NINE)).toBe(false);
    expect(db.select().from(alertsInbox).all()).toHaveLength(0);
  });

  it("is not due before 09:00", () => {
    db.insert(offers)
      .values({
        title: "Bet £10 get £10",
        status: "active",
        bookmaker: "Betfair Sportsbook",
        expiresAt: BEFORE_NINE + DAY_MS,
        createdAt: BEFORE_NINE,
      })
      .run();
    expect(maybeSendDailyTasksDigest(BEFORE_NINE)).toBe(false);
    expect(db.select().from(alertsInbox).all()).toHaveLength(0);
  });

  it("sends one briefing after 09:00 and latches the day", () => {
    setSetting("offerReminderDays", JSON.stringify([3, 1]));
    db.insert(offers)
      .values({
        title: "Bet £10 get £10",
        status: "active",
        bookmaker: "Betfair Sportsbook",
        expiresAt: AFTER_NINE + DAY_MS,
        createdAt: AFTER_NINE,
      })
      .run();

    expect(maybeSendDailyTasksDigest(AFTER_NINE)).toBe(true);
    const rows = db.select().from(alertsInbox).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("daily_tasks");
    expect(rows[0]?.title).toMatch(/^Your tasks today/);
    expect(rows[0]?.href).toBe("/desk");
    expect(rows[0]?.dedupe).toBe(`daily_tasks:${localDayKey(new Date(AFTER_NINE))}`);

    expect(maybeSendDailyTasksDigest(AFTER_NINE + 60_000)).toBe(false);
    expect(db.select().from(alertsInbox).all()).toHaveLength(1);
  });

  it("latches a quiet morning without writing an inbox row", () => {
    expect(maybeSendDailyTasksDigest(AFTER_NINE)).toBe(false);
    expect(db.select().from(alertsInbox).all()).toHaveLength(0);
    // Latched - still quiet on a later poll.
    expect(maybeSendDailyTasksDigest(AFTER_NINE + 3_600_000)).toBe(false);
  });
});
