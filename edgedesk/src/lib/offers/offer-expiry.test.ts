import { describe, expect, it } from "vitest";
import {
  effectiveOfferExpiryMs,
  formatOfferStatusDisplay,
  missedOfferLabel,
  offerIssueStatusLabel,
  parseScopeRaceOffTime,
  scopedEventDeadlineMs,
  ukDateTimeToUtcMs,
} from "./offer-expiry";

describe("parseScopeRaceOffTime", () => {
  // The Racing API prints UK off-times with no am/pm: the Goodwood card for
  // 2026-08-01 lists "1:50" for a race that goes off at 13:50. Reading those
  // literally put every afternoon race in the small hours, so a race-scoped
  // offer was already past its deadline the moment it was created.
  it("reads am/pm-less afternoon off-times as afternoon", () => {
    expect(parseScopeRaceOffTime("1:50 · Highclere Castle Gin Summer Handicap")).toEqual({
      hours: 13,
      minutes: 50,
    });
    expect(parseScopeRaceOffTime("3:00 · Betway Handicap")).toEqual({
      hours: 15,
      minutes: 0,
    });
    expect(parseScopeRaceOffTime("5:20 · Evening Sprint")).toEqual({
      hours: 17,
      minutes: 20,
    });
  });

  it("keeps late-morning and midday off-times as printed", () => {
    expect(parseScopeRaceOffTime("11:30 · Opener")).toEqual({ hours: 11, minutes: 30 });
    expect(parseScopeRaceOffTime("12:20 · Selling Handicap")).toEqual({
      hours: 12,
      minutes: 20,
    });
  });

  it("leaves explicit 24-hour labels untouched", () => {
    expect(parseScopeRaceOffTime("15:00 · Feature")).toEqual({ hours: 15, minutes: 0 });
    expect(parseScopeRaceOffTime("19:45 · Floodlit Sprint")).toEqual({
      hours: 19,
      minutes: 45,
    });
  });

  it("returns null without a leading clock time", () => {
    expect(parseScopeRaceOffTime("Betway Handicap")).toBeNull();
    expect(parseScopeRaceOffTime(null)).toBeNull();
  });
});

describe("scopedEventDeadlineMs", () => {
  it("uses race off-time on the event date (UK local)", () => {
    const ms = scopedEventDeadlineMs({
      eventDate: "2026-07-09",
      scopeRaceId: "rac_1",
      scopeRaceLabel: "15:00 · Betway Handicap (Heritage Handicap)",
    });
    expect(ms).toBe(ukDateTimeToUtcMs("2026-07-09", 15, 0));
  });

  it("uses end of day when only racing day is set", () => {
    const ms = scopedEventDeadlineMs({
      eventDate: "2026-07-09",
      scopeRaceId: null,
      scopeRaceLabel: null,
    });
    expect(ms).toBe(ukDateTimeToUtcMs("2026-07-09", 23, 59));
  });

  it("puts an am/pm-less afternoon race at its real off-time", () => {
    const ms = scopedEventDeadlineMs({
      eventDate: "2026-08-01",
      scopeRaceId: "rac_32293062958",
      scopeRaceLabel: "1:50 · Highclere Castle Gin Summer Handicap Stakes",
    });
    expect(ms).toBe(ukDateTimeToUtcMs("2026-08-01", 13, 50));
    expect(ms).not.toBe(ukDateTimeToUtcMs("2026-08-01", 1, 50));
  });
});

describe("effectiveOfferExpiryMs", () => {
  it("takes whichever comes first", () => {
    const raceMs = ukDateTimeToUtcMs("2026-07-09", 15, 0)!;
    const later = raceMs + 86_400_000;
    const earlier = raceMs - 3_600_000;

    expect(
      effectiveOfferExpiryMs({
        expiresAt: later,
        eventDate: "2026-07-09",
        scopeRaceId: "r1",
        scopeRaceLabel: "15:00 · Race",
        sport: "horse_racing",
        status: "active",
      })
    ).toBe(raceMs);

    expect(
      effectiveOfferExpiryMs({
        expiresAt: earlier,
        eventDate: "2026-07-09",
        scopeRaceId: "r1",
        scopeRaceLabel: "15:00 · Race",
        sport: "horse_racing",
        status: "active",
      })
    ).toBe(earlier);
  });

  // Regression: a Goodwood offer saved at 09:40 on the day, expiry 20:00 that
  // evening, scoped to the "1:50" (13:50) race. The deadline must be 13:50, so
  // the offer is still live at 09:40 rather than expired against 01:50.
  it("keeps an afternoon race-scoped offer live earlier the same morning", () => {
    const morning = ukDateTimeToUtcMs("2026-08-01", 9, 40)!;
    const deadline = effectiveOfferExpiryMs({
      expiresAt: ukDateTimeToUtcMs("2026-08-01", 20, 0),
      eventDate: "2026-08-01",
      scopeRaceId: "rac_32293062958",
      scopeRaceLabel: "1:50 · Highclere Castle Gin Summer Handicap Stakes",
      sport: "horse_racing",
      status: "active",
    });

    expect(deadline).toBe(ukDateTimeToUtcMs("2026-08-01", 13, 50));
    expect(deadline!).toBeGreaterThan(morning);
  });
});

describe("missed / status labels", () => {
  it("uses category wording", () => {
    expect(missedOfferLabel("horse_racing")).toBe("Missed race");
    expect(missedOfferLabel("football")).toBe("Missed match");
    expect(missedOfferLabel("sports")).toBe("Missed event");
  });

  it("shows Missed race for expired scoped racing offers", () => {
    expect(
      formatOfferStatusDisplay({
        status: "expired",
        sport: "horse_racing",
        eventDate: "2026-07-09",
        scopeRaceId: "rac_1",
        scopeRaceLabel: "3:00 · Betway",
      })
    ).toBe("Missed race");

    expect(
      formatOfferStatusDisplay({
        status: "expired",
        sport: null,
        eventDate: null,
        scopeRaceId: null,
        scopeRaceLabel: null,
      })
    ).toBe("Expired");
  });
});

describe("offerIssueStatusLabel", () => {
  it("returns null for active and completed offers", () => {
    expect(offerIssueStatusLabel({ status: "active", sport: null, eventDate: null, scopeRaceId: null, scopeRaceLabel: null })).toBeNull();
    expect(offerIssueStatusLabel({ status: "completed", sport: null, eventDate: null, scopeRaceId: null, scopeRaceLabel: null })).toBeNull();
    expect(offerIssueStatusLabel({ status: "planned", sport: null, eventDate: null, scopeRaceId: null, scopeRaceLabel: null })).toBeNull();
  });

  it("returns issue labels for expired offers", () => {
    expect(
      offerIssueStatusLabel({
        status: "expired",
        sport: "horse_racing",
        eventDate: "2026-07-09",
        scopeRaceId: "rac_1",
        scopeRaceLabel: "3:00 · Betway",
      })
    ).toBe("Missed race");
    expect(offerIssueStatusLabel({ status: "expired", sport: null, eventDate: null, scopeRaceId: null, scopeRaceLabel: null })).toBe("Expired");
  });
});
