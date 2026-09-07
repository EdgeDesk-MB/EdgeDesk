import { describe, expect, it } from "vitest";
import {
  formatYmdLocal,
  yearBoundsToYmdRange,
  ymdDaysFromToday,
} from "@/components/date-picker";

describe("ymdDaysFromToday", () => {
  it("returns tomorrow and +7 in local calendar terms", () => {
    const now = new Date(2026, 7, 5, 15, 30, 0); // 5 Aug 2026 local
    expect(ymdDaysFromToday(1, now)).toBe("2026-08-06");
    expect(ymdDaysFromToday(7, now)).toBe("2026-08-12");
  });

  it("crosses month boundaries without UTC shift", () => {
    const now = new Date(2026, 7, 28, 9, 0, 0); // 28 Aug
    expect(ymdDaysFromToday(7, now)).toBe("2026-09-04");
    expect(formatYmdLocal(now)).toBe("2026-08-28");
  });
});

describe("yearBoundsToYmdRange", () => {
  it("maps inclusive calendar years to native min/max", () => {
    expect(yearBoundsToYmdRange(2024, 2027)).toEqual({
      min: "2024-01-01",
      max: "2027-12-31",
    });
  });

  it("omits missing bounds", () => {
    expect(yearBoundsToYmdRange(undefined, 2027)).toEqual({
      min: undefined,
      max: "2027-12-31",
    });
  });
});
