import { describe, expect, it } from "vitest";
import {
  expandRecurrenceDates,
  formatRecurrenceLabel,
  instanceExpiresAt,
  localYmd,
  parseRecurrenceRule,
} from "./offer-recurrence-shared";

describe("expandRecurrenceDates", () => {
  it("expands daily occurrences across a week", () => {
    const dates = expandRecurrenceDates(
      { freq: "daily", interval: 1 },
      "2026-07-09",
      "2026-07-12"
    );
    expect(dates).toEqual(["2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"]);
  });

  it("respects weekly weekdays", () => {
    const dates = expandRecurrenceDates(
      { freq: "weekly", interval: 1, byWeekday: [0] },
      "2026-07-09",
      "2026-07-20"
    );
    expect(dates).toContain("2026-07-12");
    expect(dates.every((d) => new Date(d).getDay() === 0)).toBe(true);
  });

  it("skips a weekday that isn't due yet - first match is in the future", () => {
    // 2026-07-09 is a Thursday; asking for Wednesdays should skip straight to
    // the following Wednesday, not fire on the anchor day itself.
    const dates = expandRecurrenceDates(
      { freq: "weekly", interval: 1, byWeekday: [3] },
      "2026-07-09",
      "2026-07-20"
    );
    expect(dates[0]).toBe("2026-07-15");
  });

  it("expands monthly occurrences on the chosen day", () => {
    const dates = expandRecurrenceDates(
      { freq: "monthly", interval: 1, byMonthday: 1 },
      "2026-07-09",
      "2026-09-30"
    );
    expect(dates).toEqual(["2026-08-01", "2026-09-01"]);
  });

  it("clamps monthly day-of-month to the shorter month's last day", () => {
    const dates = expandRecurrenceDates(
      { freq: "monthly", interval: 1, byMonthday: 31 },
      "2026-01-01",
      "2026-02-28"
    );
    expect(dates).toEqual(["2026-01-31", "2026-02-28"]);
  });

  it("respects a monthly interval greater than 1", () => {
    const dates = expandRecurrenceDates(
      { freq: "monthly", interval: 2, byMonthday: 1 },
      "2026-01-01",
      "2026-04-30"
    );
    expect(dates).toEqual(["2026-01-01", "2026-03-01"]);
  });
});

describe("instanceExpiresAt", () => {
  it("shifts expiry clock time to instance day", () => {
    const template = new Date(2026, 6, 9, 23, 0, 0).getTime();
    const shifted = instanceExpiresAt(template, "2026-07-12");
    const d = new Date(shifted!);
    expect(d.getDate()).toBe(12);
    expect(d.getMonth()).toBe(6);
    expect(d.getHours()).toBe(23);
  });

  it("adds the offset before combining with instance day (expires N days after go-live)", () => {
    const template = new Date(2026, 6, 9, 23, 59, 0).getTime();
    // Betfair-style "starts Wed, valid for 7 days" - expires 6 days after go-live.
    const shifted = instanceExpiresAt(template, "2026-07-15", 6);
    const d = new Date(shifted!);
    expect(d.getDate()).toBe(21);
    expect(d.getMonth()).toBe(6);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });
});

describe("formatRecurrenceLabel", () => {
  it("labels daily offers", () => {
    expect(formatRecurrenceLabel({ freq: "daily", interval: 1 })).toBe("Daily");
  });

  it("labels monthly offers with an ordinal day", () => {
    expect(formatRecurrenceLabel({ freq: "monthly", interval: 1, byMonthday: 1 })).toBe(
      "Monthly (1st)"
    );
    expect(formatRecurrenceLabel({ freq: "monthly", interval: 2, byMonthday: 15 })).toBe(
      "Every 2 months (15th)"
    );
  });

  it("appends the expiry offset when set", () => {
    expect(
      formatRecurrenceLabel({ freq: "weekly", interval: 1, byWeekday: [3], expiryOffsetDays: 6 })
    ).toBe("Weekly (Wed) · expires after 7d");
  });
});

describe("parseRecurrenceRule", () => {
  it("parses daily JSON", () => {
    expect(parseRecurrenceRule(JSON.stringify({ freq: "daily", interval: 1 }))).toEqual({
      freq: "daily",
      interval: 1,
    });
  });

  it("parses monthly JSON with byMonthday and expiryOffsetDays", () => {
    expect(
      parseRecurrenceRule(
        JSON.stringify({ freq: "monthly", interval: 1, byMonthday: 15, expiryOffsetDays: 3 })
      )
    ).toEqual({ freq: "monthly", interval: 1, byMonthday: 15, expiryOffsetDays: 3 });
  });

  it("rejects an unknown freq", () => {
    expect(parseRecurrenceRule(JSON.stringify({ freq: "yearly", interval: 1 }))).toBeNull();
  });
});

describe("localYmd", () => {
  it("formats YYYY-MM-DD", () => {
    expect(localYmd(new Date(2026, 6, 9, 15, 30))).toBe("2026-07-09");
  });
});
