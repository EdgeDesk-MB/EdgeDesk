import { describe, expect, it } from "vitest";
import { pickTwoupScoutFixtures } from "./twoup-scout-fixtures";

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

  it("returns nothing without pins", () => {
    expect(pickTwoupScoutFixtures([row()], [])).toEqual([]);
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
