import { describe, expect, it } from "vitest";
import { localCalendarDate } from "@/lib/events";
import {
  pickTwoupScoutFixtures,
  pickTwoupScoutWarmFixtures,
} from "./twoup-scout-fixtures";

function row(
  partial: Partial<Parameters<typeof pickTwoupScoutFixtures>[0][number]> = {}
) {
  return {
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startTime: Date.now() + 60 * 60 * 1000,
    status: "upcoming" as const,
    competition: "Premier League",
    leagueCountry: "England",
    ...partial,
  };
}

describe("pickTwoupScoutFixtures", () => {
  it("keeps upcoming matches in pinned competitions, capped and ordered", () => {
    const now = 1_700_000_000_000;
    const picked = pickTwoupScoutFixtures(
      [
        row({ homeTeam: "Later", startTime: now + 3_600_000 }),
        row({ homeTeam: "Soon", startTime: now + 1_800_000 }),
        row({
          homeTeam: "Cup",
          competition: "FA Cup",
          startTime: now + 600_000,
        }),
        row({ homeTeam: "Live", status: "live", startTime: now - 60_000 }),
        row({ homeTeam: "Past", startTime: now - 60_000 }),
      ],
      ["England::Premier League"],
      now,
      1
    );
    expect(picked.map((f) => f.homeTeam)).toEqual(["Soon"]);
  });

  it("can keep live matches when the date scout asks for them", () => {
    const now = 1_700_000_000_000;
    const picked = pickTwoupScoutFixtures(
      [
        row({ homeTeam: "Live", status: "live", startTime: now - 60_000 }),
        row({ homeTeam: "Soon", startTime: now + 1_800_000 }),
      ],
      ["England::Premier League"],
      now,
      null,
      true
    );
    expect(picked.map((f) => f.homeTeam)).toEqual(["Live", "Soon"]);
  });

  it("returns nothing without pins", () => {
    expect(pickTwoupScoutFixtures([row()], [])).toEqual([]);
  });

  it("warms every pinned match on today before later days", () => {
    const now = 1_700_000_000_000;
    const todayStart = now + 3_600_000;
    const tomorrowStart = now + 48 * 3_600_000;
    const picked = pickTwoupScoutWarmFixtures(
      [
        row({ homeTeam: "Tomorrow A", startTime: tomorrowStart }),
        row({ homeTeam: "Today B", startTime: todayStart + 1_000 }),
        row({ homeTeam: "Today A", startTime: todayStart }),
        row({ homeTeam: "Tomorrow B", startTime: tomorrowStart + 1_000 }),
      ],
      ["England::Premier League"],
      localCalendarDate(new Date(todayStart)),
      now,
      1
    );
    expect(picked.map((f) => f.homeTeam)).toEqual(["Today A", "Today B"]);
  });

  it("fills leftover warm cap from later days", () => {
    const now = 1_700_000_000_000;
    const todayStart = now + 3_600_000;
    const tomorrowStart = now + 48 * 3_600_000;
    const picked = pickTwoupScoutWarmFixtures(
      [
        row({ homeTeam: "Tomorrow A", startTime: tomorrowStart }),
        row({ homeTeam: "Today A", startTime: todayStart }),
        row({ homeTeam: "Tomorrow B", startTime: tomorrowStart + 1_000 }),
      ],
      ["England::Premier League"],
      localCalendarDate(new Date(todayStart)),
      now,
      2
    );
    expect(picked.map((f) => f.homeTeam)).toEqual(["Today A", "Tomorrow A"]);
  });

  it("does not cap when cap is null", () => {
    const now = 1_700_000_000_000;
    const picked = pickTwoupScoutFixtures(
      [
        row({ homeTeam: "A", startTime: now + 1_000 }),
        row({ homeTeam: "B", startTime: now + 2_000 }),
      ],
      ["England::Premier League"],
      now,
      null
    );
    expect(picked).toHaveLength(2);
  });
});
