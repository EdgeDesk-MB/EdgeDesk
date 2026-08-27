import { describe, expect, it } from "vitest";
import {
  compareTrailingWindows,
  cumulativeSeries,
  dailyCountsFromEpochs,
  dailySumsFromEpochValues,
  formatPeriodDelta,
  formatUtcDayLabel,
  lastDays,
  rankShare,
  shareSlices,
  utcDayKeyFromMs,
} from "@/lib/admin/series";

const now = new Date("2026-08-26T12:00:00Z");

function utcNoon(day: string): number {
  return Date.parse(`${day}T12:00:00Z`);
}

describe("utcDayKeyFromMs", () => {
  it("returns a UTC calendar day", () => {
    expect(utcDayKeyFromMs(utcNoon("2026-08-25"))).toBe("2026-08-25");
  });

  it("rejects empty timestamps", () => {
    expect(utcDayKeyFromMs(0)).toBeNull();
    expect(utcDayKeyFromMs(Number.NaN)).toBeNull();
  });
});

describe("dailyCountsFromEpochs", () => {
  it("fills quiet days and counts two events on the same day", () => {
    const series = dailyCountsFromEpochs(
      [utcNoon("2026-08-25"), utcNoon("2026-08-25"), utcNoon("2026-08-24")],
      3,
      now
    );
    expect(series).toEqual([
      { day: "2026-08-24", used: 1 },
      { day: "2026-08-25", used: 2 },
      { day: "2026-08-26", used: 0 },
    ]);
  });
});

describe("dailySumsFromEpochValues", () => {
  it("sums values per UTC day", () => {
    const series = dailySumsFromEpochValues(
      [
        { at: utcNoon("2026-08-25"), value: 250 },
        { at: utcNoon("2026-08-25"), value: 150 },
      ],
      2,
      now
    );
    expect(series).toEqual([
      { day: "2026-08-25", used: 400 },
      { day: "2026-08-26", used: 0 },
    ]);
  });
});

describe("compareTrailingWindows", () => {
  it("compares the last seven days with the seven before", () => {
    const series = [
      ...Array.from({ length: 7 }, (_, i) => ({
        day: `2026-08-${String(i + 13).padStart(2, "0")}`,
        used: 2,
      })),
      ...Array.from({ length: 7 }, (_, i) => ({
        day: `2026-08-${String(i + 20).padStart(2, "0")}`,
        used: 4,
      })),
    ];
    expect(compareTrailingWindows(series, 7)).toEqual({
      current: 28,
      previous: 14,
      delta: 14,
      pct: 100,
    });
  });

  it("uses a null percent when the previous window is empty", () => {
    const series = [
      { day: "2026-08-19", used: 0 },
      { day: "2026-08-26", used: 3 },
    ];
    expect(compareTrailingWindows(series, 1)).toEqual({
      current: 3,
      previous: 0,
      delta: 3,
      pct: null,
    });
  });
});

describe("cumulativeSeries", () => {
  it("accumulates oldest-first", () => {
    expect(
      cumulativeSeries([
        { day: "2026-08-24", used: 1 },
        { day: "2026-08-25", used: 2 },
        { day: "2026-08-26", used: 0 },
      ])
    ).toEqual([
      { day: "2026-08-24", used: 1 },
      { day: "2026-08-25", used: 3 },
      { day: "2026-08-26", used: 3 },
    ]);
  });
});

describe("formatPeriodDelta", () => {
  it("names the week and month windows", () => {
    expect(
      formatPeriodDelta(
        { current: 4, previous: 2, delta: 2, pct: 100 },
        "week"
      )
    ).toBe("Up 100% vs last week");
    expect(
      formatPeriodDelta(
        { current: 1, previous: 2, delta: -1, pct: -50 },
        "month"
      )
    ).toBe("Down 50% vs last month");
  });

  it("handles an empty previous window", () => {
    expect(
      formatPeriodDelta({ current: 2, previous: 0, delta: 2, pct: null }, "week")
    ).toBe("Up from none");
  });

  it("stays quiet when both windows are empty", () => {
    expect(
      formatPeriodDelta({ current: 0, previous: 0, delta: 0, pct: 0 }, "week")
    ).toBe("Level vs last week");
  });
});

describe("rankShare", () => {
  it("keeps the top slice and rolls the rest into Other", () => {
    const slices = rankShare(
      [
        { key: "a", label: "A", value: 10 },
        { key: "b", label: "B", value: 4 },
        { key: "c", label: "C", value: 3 },
        { key: "d", label: "D", value: 1 },
      ],
      ["brand", "edge"],
      2
    );
    expect(slices).toEqual([
      { key: "a", label: "A", value: 10, tone: "brand" },
      { key: "b", label: "B", value: 4, tone: "edge" },
      { key: "other", label: "Other", value: 4, tone: "muted" },
    ]);
  });
});

describe("shareSlices / lastDays / formatUtcDayLabel", () => {
  it("clamps negative values and slices the tail", () => {
    expect(shareSlices([{ key: "x", label: "X", value: -3, tone: "brand" }])).toEqual([
      { key: "x", label: "X", value: 0, tone: "brand" },
    ]);
    expect(
      lastDays(
        [
          { day: "a", used: 1 },
          { day: "b", used: 2 },
          { day: "c", used: 3 },
        ],
        2
      )
    ).toEqual([
      { day: "b", used: 2 },
      { day: "c", used: 3 },
    ]);
  });

  it("formats a UTC day without shifting the calendar", () => {
    expect(formatUtcDayLabel("2026-08-01")).toBe("1 Aug");
  });
});
