import { describe, expect, it } from "vitest";
import {
  adjacentFixtureDays,
  formatFixtureListDayLabel,
  formatFixtureStepperLabel,
  groupByDisplayDay,
} from "@/lib/events/fixture-day-groups";

describe("formatFixtureListDayLabel", () => {
  const tz = "Europe/London";
  const now = Date.parse("2026-08-22T10:00:00+01:00");

  it("uses Campaigns labels", () => {
    expect(formatFixtureListDayLabel("2026-08-22", now, tz)).toBe("Today");
    expect(formatFixtureListDayLabel("2026-08-23", now, tz)).toBe("Tomorrow");
    expect(formatFixtureListDayLabel("2026-08-21", now, tz)).toBe("Yesterday");
    expect(formatFixtureListDayLabel("2026-08-24", now, tz)).toBe("Monday 24th August");
  });
});

describe("formatFixtureStepperLabel", () => {
  const tz = "Europe/London";
  const now = Date.parse("2026-08-22T10:00:00+01:00");

  it("keeps named days and shortens the rest", () => {
    expect(formatFixtureStepperLabel("2026-08-22", now, tz)).toBe("Today");
    expect(formatFixtureStepperLabel("2026-08-23", now, tz)).toBe("Tomorrow");
    expect(formatFixtureStepperLabel("2026-08-24", now, tz)).toBe("24 Aug");
    expect(formatFixtureStepperLabel("2025-08-24", now, tz)).toBe("24 Aug 2025");
  });
});

describe("adjacentFixtureDays", () => {
  it("returns yesterday and tomorrow inside the board window", () => {
    expect(adjacentFixtureDays("2026-08-22", "2026-08-16", "2026-08-23")).toEqual([
      "2026-08-21",
      "2026-08-23",
    ]);
  });

  it("drops neighbours outside min and max", () => {
    expect(adjacentFixtureDays("2026-08-23", "2026-08-16", "2026-08-23")).toEqual([
      "2026-08-22",
    ]);
    expect(adjacentFixtureDays("2026-08-16", "2026-08-16", "2026-08-23")).toEqual([
      "2026-08-17",
    ]);
  });
});

describe("groupByDisplayDay", () => {
  it("splits kickoffs onto calendar days in the display timezone", () => {
    const tz = "Europe/London";
    const now = Date.parse("2026-08-22T10:00:00+01:00");
    const groups = groupByDisplayDay(
      [
        { id: "a", startTime: Date.parse("2026-08-22T12:30:00+01:00") },
        { id: "b", startTime: Date.parse("2026-08-23T15:00:00+01:00") },
        { id: "c", startTime: Date.parse("2026-08-22T17:30:00+01:00") },
      ],
      now,
      tz
    );
    expect(groups.map((group) => group.label)).toEqual(["Today", "Tomorrow"]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["a", "c"]);
  });
});
