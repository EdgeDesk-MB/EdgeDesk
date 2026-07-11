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
});

describe("formatRecurrenceLabel", () => {
  it("labels daily offers", () => {
    expect(formatRecurrenceLabel({ freq: "daily", interval: 1 })).toBe("Daily");
  });
});

describe("parseRecurrenceRule", () => {
  it("parses daily JSON", () => {
    expect(parseRecurrenceRule(JSON.stringify({ freq: "daily", interval: 1 }))).toEqual({
      freq: "daily",
      interval: 1,
    });
  });
});

describe("localYmd", () => {
  it("formats YYYY-MM-DD", () => {
    expect(localYmd(new Date(2026, 6, 9, 15, 30))).toBe("2026-07-09");
  });
});
