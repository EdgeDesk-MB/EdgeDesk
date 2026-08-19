import { describe, expect, it } from "vitest";
import {
  addLocalDays,
  eventListDayBounds,
  eventListGroupDayMs,
  groupEventsByListDay,
} from "./list-groups";

function ev(id: number, startTime: number) {
  return { id, startTime };
}

describe("tracked event list day groups", () => {
  const now = new Date(2026, 7, 17, 18, 0, 0).getTime(); // 17 Aug 2026
  const today = new Date(2026, 7, 17).getTime();
  const tomorrow = new Date(2026, 7, 18).getTime();
  const yesterday = new Date(2026, 7, 16).getTime();
  const lastWeek = new Date(2026, 7, 10).getTime();

  it("buckets by local kick-off day", () => {
    expect(eventListGroupDayMs(ev(1, today + 15 * 3_600_000))).toBe(today);
    expect(eventListGroupDayMs(ev(2, tomorrow + 3_600_000))).toBe(tomorrow);
  });

  it("labels and orders All as today, then upcoming, then past", () => {
    const groups = groupEventsByListDay(
      [
        ev(1, lastWeek + 14 * 3_600_000),
        ev(2, tomorrow + 12 * 3_600_000),
        ev(3, today + 20 * 3_600_000),
        ev(4, yesterday + 16 * 3_600_000),
        ev(5, today + 10 * 3_600_000),
      ],
      { now, sort: "upcoming-then-past" }
    );
    expect(groups.map((g) => g.label)).toEqual([
      "Today",
      "Tomorrow",
      "Yesterday",
      "Monday 10th August",
    ]);
    expect(groups[0]?.events.map((e) => e.id)).toEqual([5, 3]);
  });

  it("filters to one day", () => {
    const groups = groupEventsByListDay(
      [ev(1, today + 3_600_000), ev(2, yesterday + 3_600_000)],
      { now, dayMs: yesterday }
    );
    expect(groups.map((g) => g.label)).toEqual(["Yesterday"]);
    expect(groups[0]?.events.map((e) => e.id)).toEqual([2]);
  });

  it("bounds Today / Upcoming / Past", () => {
    const events = [
      ev(1, yesterday + 3_600_000),
      ev(2, today + 3_600_000),
      ev(3, tomorrow + 3_600_000),
    ];
    expect(
      groupEventsByListDay(events, { now, ...eventListDayBounds("today", now) }).map(
        (g) => g.label
      )
    ).toEqual(["Today"]);
    expect(
      groupEventsByListDay(events, { now, ...eventListDayBounds("upcoming", now) }).map(
        (g) => g.label
      )
    ).toEqual(["Tomorrow"]);
    expect(
      groupEventsByListDay(events, { now, ...eventListDayBounds("past", now) }).map(
        (g) => g.label
      )
    ).toEqual(["Yesterday"]);
  });

  it("addLocalDays crosses a month without a fixed 24h step", () => {
    const endOfMarch = new Date(2026, 2, 29).getTime();
    expect(addLocalDays(endOfMarch, 1)).toBe(new Date(2026, 2, 30).getTime());
  });
});
