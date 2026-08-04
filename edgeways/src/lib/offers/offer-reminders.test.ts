import { describe, expect, it } from "vitest";
import {
  OFFER_REMINDER_BATCH_CAP,
  formatOfferReminderMessage,
  keepCurrentReminderOffers,
  offerReminderSeenKey,
  pickReminderThreshold,
  selectOfferExpiryReminders,
  type OfferReminderCandidate,
} from "./offer-reminders";

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 7, 3, 12); // 2026-08-03 12:00 UTC

function offer(
  partial: Partial<OfferReminderCandidate> & Pick<OfferReminderCandidate, "id" | "title">
): OfferReminderCandidate {
  return {
    bookmaker: "Betfair Sportsbook",
    status: "active",
    seriesId: null,
    instanceDate: null,
    expiresAt: NOW + 7 * DAY_MS,
    eventDate: null,
    scopeRaceLabel: null,
    scopeRaceId: null,
    sport: "football",
    ...partial,
  };
}

describe("keepCurrentReminderOffers", () => {
  it("keeps only the earliest instance of a series", () => {
    const kept = keepCurrentReminderOffers([
      offer({
        id: 11,
        title: "Bet £20 get £20",
        seriesId: 1,
        instanceDate: "2026-08-06",
        expiresAt: NOW + 3 * DAY_MS,
      }),
      offer({
        id: 10,
        title: "Bet £20 get £20",
        seriesId: 1,
        instanceDate: "2026-08-04",
        expiresAt: NOW + 1 * DAY_MS,
      }),
      offer({
        id: 12,
        title: "Bet £20 get £20",
        seriesId: 1,
        instanceDate: "2026-08-10",
        expiresAt: NOW + 7 * DAY_MS,
      }),
      offer({ id: 99, title: "One-off", seriesId: null, expiresAt: NOW + 2 * DAY_MS }),
    ]);

    expect(kept.map((o) => o.id).sort((a, b) => a - b)).toEqual([10, 99]);
  });
});

describe("pickReminderThreshold", () => {
  const days = [7, 3, 1];

  it("picks the smallest covering threshold", () => {
    expect(pickReminderThreshold(7, days)).toBe(7);
    expect(pickReminderThreshold(5, days)).toBe(7);
    expect(pickReminderThreshold(2, days)).toBe(3);
    expect(pickReminderThreshold(1, days)).toBe(1);
    expect(pickReminderThreshold(0, days)).toBe(1);
  });

  it("returns null when outside all windows", () => {
    expect(pickReminderThreshold(8, days)).toBeNull();
  });
});

describe("offerReminderSeenKey", () => {
  it("includes offer, threshold and local calendar day", () => {
    const key = offerReminderSeenKey(5, 3, NOW);
    expect(key).toMatch(/^offer_reminder:5:3:\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatOfferReminderMessage", () => {
  it("uses today copy inside the final day", () => {
    expect(formatOfferReminderMessage("Promo", 3 * 60 * 60_000, 1)).toBe(
      "Offer expires today: Promo"
    );
  });

  it("uses singular and plural day copy", () => {
    expect(formatOfferReminderMessage("Promo", 1.2 * DAY_MS, 2)).toBe(
      "Offer expires in 2 days: Promo"
    );
    expect(formatOfferReminderMessage("Promo", DAY_MS, 1)).toBe(
      "Offer expires in 1 day: Promo"
    );
  });
});

describe("selectOfferExpiryReminders", () => {
  it("collapses a series so only the current instance toasts", () => {
    const reminders = selectOfferExpiryReminders(
      [
        offer({
          id: 10,
          title: "Bet £20 get £20",
          seriesId: 1,
          instanceDate: "2026-08-04",
          status: "active",
          expiresAt: NOW + 1 * DAY_MS,
        }),
        offer({
          id: 11,
          title: "Bet £50 get £50",
          seriesId: 1,
          instanceDate: "2026-08-06",
          status: "planned",
          expiresAt: NOW + 3 * DAY_MS,
        }),
        offer({
          id: 12,
          title: "Bet £50 get £50 (later)",
          seriesId: 1,
          instanceDate: "2026-08-10",
          status: "planned",
          expiresAt: NOW + 7 * DAY_MS,
        }),
      ],
      [7, 3, 1],
      NOW
    );

    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.offerId).toBe(10);
    expect(reminders[0]?.threshold).toBe(1);
    expect(reminders[0]?.message).toContain("1 day");
  });

  it("escalates a short window into the nearest threshold", () => {
    const reminders = selectOfferExpiryReminders(
      [offer({ id: 1, title: "Short promo", expiresAt: NOW + 2 * DAY_MS })],
      [7, 3, 1],
      NOW
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.threshold).toBe(3);
    expect(reminders[0]?.daysLeft).toBe(2);
    expect(reminders[0]?.message).toBe("Offer expires in 2 days: Short promo");
  });

  it("skips offers still beyond the largest threshold", () => {
    const reminders = selectOfferExpiryReminders(
      [offer({ id: 1, title: "Far", expiresAt: NOW + 10 * DAY_MS })],
      [7, 3, 1],
      NOW
    );
    expect(reminders).toHaveLength(0);
  });

  it("honours seen keys and does not re-select", () => {
    const candidate = offer({ id: 1, title: "Promo", expiresAt: NOW + DAY_MS });
    const first = selectOfferExpiryReminders([candidate], [7, 3, 1], NOW);
    expect(first).toHaveLength(1);
    const seen = new Set([first[0]!.seenKey]);
    const second = selectOfferExpiryReminders([candidate], [7, 3, 1], NOW, { seen });
    expect(second).toHaveLength(0);
  });

  it("caps the batch and prefers soonest first", () => {
    const offers = [1, 2, 3, 4].map((n) =>
      offer({
        id: n,
        title: `Offer ${n}`,
        expiresAt: NOW + n * DAY_MS,
      })
    );
    const reminders = selectOfferExpiryReminders(offers, [7, 3, 1], NOW);
    expect(reminders).toHaveLength(OFFER_REMINDER_BATCH_CAP);
    expect(reminders.map((r) => r.offerId)).toEqual([1, 2, 3]);
  });

  it("ignores completed and expired statuses", () => {
    const reminders = selectOfferExpiryReminders(
      [
        offer({ id: 1, title: "Done", status: "completed", expiresAt: NOW + DAY_MS }),
        offer({ id: 2, title: "Gone", status: "expired", expiresAt: NOW + DAY_MS }),
      ],
      [7, 3, 1],
      NOW
    );
    expect(reminders).toHaveLength(0);
  });
});
