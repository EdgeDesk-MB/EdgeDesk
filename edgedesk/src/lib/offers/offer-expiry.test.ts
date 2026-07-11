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
  it("parses 12h and 24h style labels", () => {
    expect(parseScopeRaceOffTime("3:00 · Betway Handicap")).toEqual({
      hours: 3,
      minutes: 0,
    });
    expect(parseScopeRaceOffTime("15:00 · Feature")).toEqual({
      hours: 15,
      minutes: 0,
    });
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
    expect(offerIssueStatusLabel({ status: "active", sport: null })).toBeNull();
    expect(offerIssueStatusLabel({ status: "completed", sport: null })).toBeNull();
    expect(offerIssueStatusLabel({ status: "planned", sport: null })).toBeNull();
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
    expect(offerIssueStatusLabel({ status: "expired", sport: null })).toBe("Expired");
  });
});
