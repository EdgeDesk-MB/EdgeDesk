import { describe, expect, it } from "vitest";
import { computeMonthPace, currentMonthAchieved, paceLabel } from "./pace";

// 14 July 2026, midday: day 14 of 31, 18 days left including today.
const JUL_14 = new Date(2026, 6, 14, 12, 0).getTime();

describe("computeMonthPace", () => {
  it("returns null with no target", () => {
    expect(computeMonthPace({ achieved: 100, target: null, now: JUL_14 })).toBeNull();
    expect(computeMonthPace({ achieved: 100, target: 0, now: JUL_14 })).toBeNull();
  });

  it("hand-worked: £162 of £250 on 14 July is ahead of straight-line pace", () => {
    // expectedByNow = 250 × 14/31 = 112.903...; delta = 162 − 112.90 = +49.10
    const pace = computeMonthPace({ achieved: 162, target: 250, now: JUL_14 })!;
    expect(pace.expectedByNow).toBeCloseTo(112.9032, 3);
    expect(pace.delta).toBeCloseTo(49.0968, 3);
    expect(pace.onPace).toBe(true);
    expect(pace.daysLeft).toBe(18);
    // remaining 88 over 18 days = 4.888.../day
    expect(pace.dailyNeeded).toBeCloseTo(4.8889, 3);
    expect(paceLabel(pace)).toBe("£162 of £250 · on pace");
  });

  it("behind pace shows the daily amount needed", () => {
    // £50 of £310 on 14 July: expected 140, behind; 260 remaining / 18 days
    const pace = computeMonthPace({ achieved: 50, target: 310, now: JUL_14 })!;
    expect(pace.onPace).toBe(false);
    expect(pace.dailyNeeded).toBeCloseTo(260 / 18, 10);
    expect(paceLabel(pace)).toBe("£50 of £310 · £14.44/day needed");
  });

  it("currentMonthAchieved reads the right row and defaults to zero", () => {
    const rows = [
      { key: "2026-07", profit: 162.5 },
      { key: "2026-06", profit: 90 },
    ];
    expect(currentMonthAchieved(rows, JUL_14)).toBe(162.5);
    expect(currentMonthAchieved([{ key: "2026-06", profit: 90 }], JUL_14)).toBe(0);
  });

  it("target met stops asking for more", () => {
    const pace = computeMonthPace({ achieved: 260, target: 250, now: JUL_14 })!;
    expect(pace.remaining).toBe(0);
    expect(pace.dailyNeeded).toBe(0);
    expect(paceLabel(pace)).toBe("£260 of £250 · target met");
  });
});
