import { describe, expect, it } from "vitest";
import {
  activityDayLabel,
  isActivityYmd,
  isFutureActivityDay,
  londonDayRangeMs,
  londonYmd,
  resolveActivityMixDay,
  shiftActivityYmd,
} from "@/lib/admin/activity-day";

describe("activity mix day", () => {
  it("accepts real calendar days only", () => {
    expect(isActivityYmd("2026-09-07")).toBe(true);
    expect(isActivityYmd("2026-02-29")).toBe(false);
    expect(isActivityYmd("2026-13-01")).toBe(false);
    expect(isActivityYmd("today")).toBe(false);
  });

  it("shifts across month ends without a fixed 24h step", () => {
    expect(shiftActivityYmd("2026-09-01", -1)).toBe("2026-08-31");
    expect(shiftActivityYmd("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("labels today and yesterday in London, else a short date", () => {
    const now = new Date("2026-09-07T12:00:00+01:00");
    expect(londonYmd(now)).toBe("2026-09-07");
    expect(activityDayLabel("2026-09-07", now)).toBe("Today");
    expect(activityDayLabel("2026-09-06", now)).toBe("Yesterday");
    expect(activityDayLabel("2026-09-01", now)).toBe("1 Sep");
    expect(activityDayLabel("2025-09-01", now)).toBe("1 Sep 2025");
  });

  it("treats dates after London today as future", () => {
    const now = new Date("2026-09-07T12:00:00+01:00");
    expect(isFutureActivityDay("2026-09-07", now)).toBe(false);
    expect(isFutureActivityDay("2026-09-08", now)).toBe(true);
  });

  it("clamps missing, invalid, and future days to today", () => {
    const now = new Date("2026-09-07T12:00:00+01:00");
    expect(resolveActivityMixDay(undefined, now)).toBe("2026-09-07");
    expect(resolveActivityMixDay("nope", now)).toBe("2026-09-07");
    expect(resolveActivityMixDay("2026-09-08", now)).toBe("2026-09-07");
    expect(resolveActivityMixDay("2026-09-01", now)).toBe("2026-09-01");
  });

  it("bounds a London summer day in UTC", () => {
    const range = londonDayRangeMs("2026-09-07");
    expect(range).toEqual({
      start: Date.parse("2026-09-06T23:00:00.000Z"),
      endExclusive: Date.parse("2026-09-07T23:00:00.000Z"),
    });
  });

  it("bounds a London winter day in UTC", () => {
    const range = londonDayRangeMs("2026-01-15");
    expect(range).toEqual({
      start: Date.parse("2026-01-15T00:00:00.000Z"),
      endExclusive: Date.parse("2026-01-16T00:00:00.000Z"),
    });
  });
});
