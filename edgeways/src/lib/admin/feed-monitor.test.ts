import { describe, expect, it } from "vitest";
import {
  FEED_CRITICAL_RATIO,
  FEED_WARNING_RATIO,
  feedOperationLabel,
  feedThresholdState,
  fillDailySeries,
  groupFeedUsageBySource,
  projectDailyPace,
  type FeedUsageAttributionInput,
} from "@/lib/admin/feed-monitor";

describe("feedThresholdState", () => {
  it("is ok below the warning ratio", () => {
    expect(feedThresholdState(0, 100)).toBe("ok");
    expect(feedThresholdState(69, 100)).toBe("ok");
  });

  it("warns from 70% of the cap", () => {
    expect(feedThresholdState(70, 100)).toBe("warning");
    expect(feedThresholdState(89, 100)).toBe("warning");
  });

  it("is critical from 90% of the cap", () => {
    expect(feedThresholdState(90, 100)).toBe("critical");
    expect(feedThresholdState(100, 100)).toBe("critical");
    expect(feedThresholdState(150, 100)).toBe("critical");
  });

  it("treats a zero cap as critical", () => {
    expect(feedThresholdState(0, 0)).toBe("critical");
  });

  it("ratios line up with the exported constants", () => {
    expect(FEED_WARNING_RATIO).toBe(0.7);
    expect(FEED_CRITICAL_RATIO).toBe(0.9);
  });
});

describe("projectDailyPace", () => {
  // Noon UTC: half the day elapsed, past the 5% warm-up.
  const noon = new Date("2026-08-26T12:00:00Z");

  it("projects linearly from the day's usage rate", () => {
    const pace = projectDailyPace(50, 95, noon);
    expect(pace.projected).toBe(100);
  });

  it("estimates when the cap is reached at the current rate", () => {
    // 60 used by noon → 120/day → cap 95 hit after another 7/12 of half a day.
    const pace = projectDailyPace(60, 95, noon);
    expect(pace.projected).toBe(120);
    expect(pace.capReachedAt).not.toBeNull();
    const reached = new Date(pace.capReachedAt as number);
    expect(reached.toISOString().slice(0, 10)).toBe("2026-08-26");
    expect(reached.getTime()).toBeGreaterThan(noon.getTime());
  });

  it("reports no cap time when the pace stays under the cap", () => {
    const pace = projectDailyPace(40, 95, noon);
    expect(pace.projected).toBe(80);
    expect(pace.capReachedAt).toBeNull();
  });

  it("returns zero pace before any spend", () => {
    expect(projectDailyPace(0, 95, noon)).toEqual({
      projected: 0,
      capReachedAt: null,
    });
  });

  it("does not extrapolate absurd numbers in the first minutes of the day", () => {
    const early = new Date("2026-08-26T00:10:00Z");
    const pace = projectDailyPace(3, 95, early);
    expect(pace.projected).toBe(3);
    expect(pace.capReachedAt).toBeNull();
  });

  it("flags an already-exhausted cap as reached now", () => {
    const pace = projectDailyPace(95, 95, noon);
    expect(pace.capReachedAt).toBe(noon.getTime());
  });
});

describe("fillDailySeries", () => {
  const now = new Date("2026-08-26T12:00:00Z");

  it("fills quiet days with zero and ends today, oldest first", () => {
    const series = fillDailySeries([{ day: "2026-08-25", used: 12 }], 3, now);
    expect(series).toEqual([
      { day: "2026-08-24", used: 0 },
      { day: "2026-08-25", used: 12 },
      { day: "2026-08-26", used: 0 },
    ]);
  });

  it("returns the requested number of days", () => {
    expect(fillDailySeries([], 30, now)).toHaveLength(30);
  });
});

describe("groupFeedUsageBySource", () => {
  const row = (
    overrides: Partial<FeedUsageAttributionInput>
  ): FeedUsageAttributionInput => ({
    feed: "football",
    clerkUserId: null,
    email: null,
    operation: "fixtures-by-date",
    count: 1,
    ...overrides,
  });

  it("rolls operations up per user and labels them by email", () => {
    const sources = groupFeedUsageBySource([
      row({ clerkUserId: "user_a", email: "ada@example.com", count: 6 }),
      row({
        clerkUserId: "user_a",
        email: "ada@example.com",
        operation: "match-events",
        count: 2,
      }),
      row({ clerkUserId: "user_a", email: "ada@example.com", feed: "racing", operation: "odds", count: 3 }),
    ]);

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      key: "user_a",
      label: "ada@example.com",
      isSystem: false,
      total: 11,
      football: 8,
      racing: 3,
    });
    // Most-spent operation first.
    expect(sources[0].operations.map((op) => op.operation)).toEqual([
      "fixtures-by-date",
      "odds",
      "match-events",
    ]);
  });

  it("buckets null actors as system spend", () => {
    const sources = groupFeedUsageBySource([
      row({ operation: "live-fixtures", count: 4 }),
      row({ feed: "racing", operation: "racecards-free", count: 1 }),
    ]);

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      key: "system",
      label: "System / poller",
      isSystem: true,
      total: 5,
      football: 4,
      racing: 1,
    });
  });

  it("sorts highest spend first and system last on a tie", () => {
    const sources = groupFeedUsageBySource([
      row({ count: 2 }),
      row({ clerkUserId: "user_a", email: "ada@example.com", count: 2 }),
      row({ clerkUserId: "user_b", email: "bob@example.com", count: 9 }),
    ]);

    expect(sources.map((source) => source.label)).toEqual([
      "bob@example.com",
      "ada@example.com",
      "System / poller",
    ]);
  });

  it("falls back to a user id fragment when the email is missing", () => {
    const sources = groupFeedUsageBySource([
      row({ clerkUserId: "user_2xyz123456", count: 1 }),
    ]);
    expect(sources[0].label).toBe("User …123456");
  });
});

describe("feedOperationLabel", () => {
  it("labels known operations and falls back to Other", () => {
    expect(feedOperationLabel("fixtures-by-date")).toBe("Fixture browsing");
    expect(feedOperationLabel("racecards-free")).toBe("Racecards (free)");
    expect(feedOperationLabel("odds")).toBe("Odds");
    expect(feedOperationLabel("something-new")).toBe("Other");
  });
});
