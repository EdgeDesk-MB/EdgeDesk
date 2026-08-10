import { describe, expect, it, beforeEach } from "vitest";
import { db, userReminders, alertsInbox } from "@/lib/db";
import {
  cancelPendingRemindersForCasino,
  cancelPendingRemindersForOffer,
  cancelUserReminder,
  createUserReminder,
  fireDueUserReminders,
  formatUserReminderAlert,
  listPendingRemindersForCasino,
  listPendingRemindersForOffer,
} from "./user-reminders";

beforeEach(() => {
  db.delete(userReminders).run();
  db.delete(alertsInbox).run();
});

describe("user reminders", () => {
  it("creates a pending reminder linked to a casino offer", () => {
    const now = Date.UTC(2026, 7, 4, 12, 0, 0);
    const remindAt = now + 24 * 60 * 60 * 1000;
    const row = createUserReminder(
      {
        note: "Free spins credited",
        remindAt,
        casinoOfferId: 42,
        contextTitle: "Wager £5 get 5 spins",
      },
      now
    );
    expect(row.id).toBeGreaterThan(0);
    expect(listPendingRemindersForCasino(42)).toHaveLength(1);
    expect(listPendingRemindersForCasino(42)[0]?.note).toBe("Free spins credited");
  });

  it("rejects an empty note and a time in the past", () => {
    const now = Date.UTC(2026, 7, 4, 12, 0, 0);
    expect(() =>
      createUserReminder({ note: "   ", remindAt: now + 60_000 }, now)
    ).toThrow(/note/i);
    expect(() =>
      createUserReminder({ note: "Later", remindAt: now - 120_000 }, now)
    ).toThrow(/future/i);
  });

  it("formats bookie, offer title and note for the notification", () => {
    const alert = formatUserReminderAlert({
      id: 9,
      note: "Free spins credited - claim on Bigger Piggy Bank",
      venue: "Tote",
      offerTitle: "Wager £85 get 85 spins",
      href: "/casino",
    });
    expect(alert.title).toBe("Reminder · Tote · Wager £85 get 85 spins");
    expect(alert.body).toBe("Free spins credited - claim on Bigger Piggy Bank");
  });

  it("fires due reminders once into the inbox with bookie + offer + note", () => {
    const now = Date.UTC(2026, 7, 4, 12, 0, 0);
    createUserReminder(
      {
        note: "Claim spins",
        remindAt: now - 1_000,
        casinoOfferId: 7,
        contextTitle: "Wager £5 get 5 spins",
        contextVenue: "Tote",
      },
      now - 60_000
    );
    const first = fireDueUserReminders(now);
    expect(first).toHaveLength(1);
    expect(first[0]?.title).toBe("Reminder · Tote · Wager £5 get 5 spins");
    expect(first[0]?.body).toBe("Claim spins");
    expect(db.select().from(alertsInbox).all()).toHaveLength(1);

    const second = fireDueUserReminders(now + 1_000);
    expect(second).toHaveLength(0);
    expect(listPendingRemindersForCasino(7)).toHaveLength(0);
  });

  it("cancel stops a reminder from firing", () => {
    const now = Date.UTC(2026, 7, 4, 12, 0, 0);
    const row = createUserReminder(
      { note: "Skip me", remindAt: now + 1_000, casinoOfferId: 3 },
      now
    );
    expect(cancelUserReminder(row.id, now)).toBe(true);
    expect(fireDueUserReminders(now + 5_000)).toHaveLength(0);
  });

  it("completing a casino campaign cancels all its pending reminders", () => {
    const now = Date.UTC(2026, 7, 4, 12, 0, 0);
    createUserReminder(
      { note: "Spins day 1", remindAt: now + 1_000, casinoOfferId: 11 },
      now
    );
    createUserReminder(
      { note: "Spins day 2", remindAt: now + 2_000, casinoOfferId: 11 },
      now
    );
    createUserReminder(
      { note: "Other campaign", remindAt: now + 1_000, casinoOfferId: 99 },
      now
    );
    expect(cancelPendingRemindersForCasino(11, now)).toBe(2);
    expect(listPendingRemindersForCasino(11)).toHaveLength(0);
    expect(listPendingRemindersForCasino(99)).toHaveLength(1);

    const fired = fireDueUserReminders(now + 5_000);
    expect(fired).toHaveLength(1);
    expect(fired[0]?.body).toBe("Other campaign");
  });

  it("creates a pending reminder linked to a sports offer", () => {
    const now = Date.UTC(2026, 7, 4, 12, 0, 0);
    const remindAt = now + 24 * 60 * 60 * 1000;
    const row = createUserReminder(
      {
        note: "Free bet credited - convert tonight",
        remindAt,
        offerId: 21,
        contextTitle: "Bet £20 get £20 free bet",
        contextVenue: "Betfair Sportsbook",
      },
      now
    );
    expect(row.offerId).toBe(21);
    expect(listPendingRemindersForOffer(21)).toHaveLength(1);
    expect(listPendingRemindersForOffer(21)[0]?.note).toBe(
      "Free bet credited - convert tonight"
    );
  });

  it("completing a sports offer cancels all its pending reminders", () => {
    const now = Date.UTC(2026, 7, 4, 12, 0, 0);
    createUserReminder(
      { note: "Check free bet", remindAt: now + 1_000, offerId: 8 },
      now
    );
    createUserReminder(
      { note: "Convert before expiry", remindAt: now + 2_000, offerId: 8 },
      now
    );
    createUserReminder(
      { note: "Other offer", remindAt: now + 1_000, offerId: 9 },
      now
    );
    expect(cancelPendingRemindersForOffer(8, now)).toBe(2);
    expect(listPendingRemindersForOffer(8)).toHaveLength(0);
    expect(listPendingRemindersForOffer(9)).toHaveLength(1);

    const fired = fireDueUserReminders(now + 5_000);
    expect(fired).toHaveLength(1);
    expect(fired[0]?.body).toBe("Other offer");
    expect(fired[0]?.href).toBe("/offers");
  });
});
