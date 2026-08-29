import { describe, expect, it } from "vitest";
import { fillDailySeries } from "@/lib/admin/feed-monitor";
import {
  buildActivityCharts,
  activityEventsFromStamps,
  buildActivityTimeline,
  buildFlagShare,
  filterActivityEvents,
  scopeActivityView,
  weeklyCountsByUser,
} from "@/lib/admin/activity-charts";
import { emptyActivityMix } from "@/lib/admin/activity-mix";

const now = new Date("2026-08-26T12:00:00Z");

describe("weeklyCountsByUser", () => {
  const NOW_MS = now.getTime();
  const DAY = 24 * 60 * 60 * 1000;

  it("counts rows from the last 7 days per desk across all kinds", () => {
    const counts = weeklyCountsByUser(
      {
        bets: [
          { at: NOW_MS - DAY, clerkUserId: "user_a" },
          { at: NOW_MS - 2 * DAY, clerkUserId: "user_a" },
          { at: NOW_MS - DAY, clerkUserId: "user_b" },
        ],
        offers: [{ at: NOW_MS - 3 * DAY, clerkUserId: "user_a" }],
        casino: [{ at: NOW_MS - DAY, clerkUserId: "user_a" }],
      },
      NOW_MS
    );
    expect(counts.get("user_a")).toBe(4);
    expect(counts.get("user_b")).toBe(1);
  });

  it("ignores rows older than 7 days", () => {
    const counts = weeklyCountsByUser(
      {
        bets: [{ at: NOW_MS - 8 * DAY, clerkUserId: "user_a" }],
        offers: [],
        casino: [],
      },
      NOW_MS
    );
    expect(counts.get("user_a")).toBeUndefined();
  });
});

describe("buildActivityCharts", () => {
  it("mixes kinds, ranks desks, and compares the last week", () => {
    const daily = {
      bets: fillDailySeries(
        [
          { day: "2026-08-25", used: 4 },
          { day: "2026-08-18", used: 2 },
        ],
        60,
        now
      ),
      offers: fillDailySeries([{ day: "2026-08-25", used: 1 }], 60, now),
      casino: fillDailySeries([], 60, now),
    };
    const charts = buildActivityCharts(
      [
        {
          clerkUserId: "user_a",
          email: "a@example.com",
          bets: 10,
          offers: 2,
          casino: 1,
        },
        {
          clerkUserId: "user_b",
          email: null,
          bets: 1,
          offers: 0,
          casino: 0,
        },
      ],
      daily
    );

    expect(charts.kindShare.map((slice) => slice.value)).toEqual([11, 2, 1]);
    expect(charts.deskShare[0]).toMatchObject({
      label: "a@example.com",
      value: 13,
    });
    expect(charts.week.bets.current).toBe(4);
    expect(charts.week.bets.previous).toBe(2);
  });
});

describe("scopeActivityView", () => {
  it("drops admin desks and their daily stamps", () => {
    const scoped = scopeActivityView(
      {
        rows: [
          {
            clerkUserId: "admin_1",
            email: "ops@example.com",
            admin: true,
            bets: 9,
            offers: 0,
            casino: 0,
          },
          {
            clerkUserId: "user_a",
            email: "a@example.com",
            admin: false,
            bets: 2,
            offers: 1,
            casino: 0,
          },
        ],
        stamps: {
          bets: [
            { at: Date.parse("2026-08-25T12:00:00Z"), clerkUserId: "admin_1" },
            { at: Date.parse("2026-08-25T12:00:00Z"), clerkUserId: "user_a" },
          ],
          offers: [],
          casino: [],
        },
        mix: {
          ...emptyActivityMix(),
          betTypes: [
            { clerkUserId: "admin_1", key: "qualifying", n: 9 },
            { clerkUserId: "user_a", key: "free_snr", n: 2 },
          ],
        },
      },
      true,
      now
    );
    expect(scoped.rows).toHaveLength(1);
    expect(scoped.rows[0]?.clerkUserId).toBe("user_a");
    expect(scoped.mix.betTypes).toEqual([
      { clerkUserId: "user_a", key: "free_snr", n: 2 },
    ]);
    expect(scoped.daily.bets.find((point) => point.day === "2026-08-25")?.used).toBe(
      1
    );
    expect(scoped.stamps.bets).toEqual([
      { at: Date.parse("2026-08-25T12:00:00Z"), clerkUserId: "user_a" },
    ]);
  });

  it("drops excluded test desks and their daily stamps", () => {
    const scoped = scopeActivityView(
      {
        rows: [
          {
            clerkUserId: "test_1",
            email: "test@example.com",
            admin: false,
            bets: 9,
            offers: 0,
            casino: 0,
          },
          {
            clerkUserId: "user_a",
            email: "a@example.com",
            admin: false,
            bets: 2,
            offers: 1,
            casino: 0,
          },
        ],
        stamps: {
          bets: [
            { at: Date.parse("2026-08-25T12:00:00Z"), clerkUserId: "test_1" },
            { at: Date.parse("2026-08-25T12:00:00Z"), clerkUserId: "user_a" },
          ],
          offers: [],
          casino: [],
        },
      },
      false,
      now,
      ["test_1"]
    );
    expect(scoped.rows).toHaveLength(1);
    expect(scoped.rows[0]?.clerkUserId).toBe("user_a");
    expect(scoped.daily.bets.find((point) => point.day === "2026-08-25")?.used).toBe(
      1
    );
    expect(scoped.stamps.bets).toEqual([
      { at: Date.parse("2026-08-25T12:00:00Z"), clerkUserId: "user_a" },
    ]);
  });
});

describe("activityEventsFromStamps", () => {
  it("sorts mixed kinds and labels the desk email", () => {
    const events = activityEventsFromStamps(
      {
        bets: [{ at: Date.parse("2026-08-25T13:00:00Z"), clerkUserId: "user_a" }],
        offers: [{ at: Date.parse("2026-08-25T12:00:00Z"), clerkUserId: "user_a" }],
        casino: [{ at: Date.parse("2026-08-25T14:00:00Z"), clerkUserId: "user_b" }],
      },
      new Map([
        ["user_a", "a@example.com"],
        ["user_b", null],
      ])
    );
    expect(events.map((event) => event.kind)).toEqual(["offers", "bets", "casino"]);
    expect(events[0]?.email).toBe("a@example.com");
    expect(filterActivityEvents(events, "bets")).toHaveLength(1);
  });
});

describe("buildActivityTimeline", () => {
  it("steps the running count and sits the first marker on zero", () => {
    const events = activityEventsFromStamps(
      {
        bets: [
          { at: Date.parse("2026-08-25T12:00:00Z"), clerkUserId: "user_a" },
          { at: Date.parse("2026-08-25T13:00:00Z"), clerkUserId: "user_a" },
        ],
        offers: [],
        casino: [],
      },
      new Map([["user_a", "a@example.com"]])
    );
    const nowSec = Date.parse("2026-08-26T12:00:00Z") / 1000;
    const timeline = buildActivityTimeline(events, nowSec);
    expect(timeline.points[0]).toMatchObject({ value: 0 });
    expect(timeline.points.some((point) => point.value === 2)).toBe(true);
    expect(timeline.markers[0]).toMatchObject({
      cumulativeValue: 0,
      eventTimeSec: Date.parse("2026-08-25T12:00:00Z") / 1000,
    });
    expect(timeline.markers[1]?.cumulativeValue).toBe(1);
    expect(timeline.kindsById[events[0]!.id]).toBe("bets");
  });
});

describe("buildFlagShare", () => {
  it("splits flags that are on and off", () => {
    expect(buildFlagShare(3, 1).map((slice) => [slice.label, slice.value])).toEqual([
      ["On", 3],
      ["Off", 1],
    ]);
  });
});
