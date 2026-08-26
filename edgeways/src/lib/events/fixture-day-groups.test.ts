import { describe, expect, it } from "vitest";
import {
  formatFixtureListDayLabel,
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
