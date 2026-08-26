import { describe, expect, it } from "vitest";
import {
  findRewardEventMatch,
  inferRewardEventSport,
  parseRewardEventTeams,
  rewardTeamsMatch,
} from "./reward-event-scope";

describe("parseRewardEventTeams", () => {
  it("splits Hull City vs Manchester United", () => {
    expect(parseRewardEventTeams("Hull City vs Manchester United")).toEqual({
      homeTeam: "Hull City",
      awayTeam: "Manchester United",
    });
  });

  it("accepts vs. and short names", () => {
    expect(parseRewardEventTeams("Hull vs. Man Utd")).toEqual({
      homeTeam: "Hull",
      awayTeam: "Man Utd",
    });
  });

  it("returns null without a vs pair", () => {
    expect(parseRewardEventTeams("Any sports event")).toBeNull();
    expect(parseRewardEventTeams("")).toBeNull();
  });
});

describe("rewardTeamsMatch", () => {
  it("matches Man Utd to Manchester United", () => {
    expect(rewardTeamsMatch("Man Utd", "Manchester United")).toBe(true);
    expect(rewardTeamsMatch("Hull", "Hull City")).toBe(true);
    expect(rewardTeamsMatch("PSG", "Paris Saint Germain")).toBe(true);
  });

  it("does not match unrelated sides", () => {
    expect(rewardTeamsMatch("Hull City", "Manchester United")).toBe(false);
  });
});

describe("inferRewardEventSport", () => {
  it("uses football for a vs pair on a general campaign", () => {
    expect(inferRewardEventSport("Hull City vs Man Utd", "general")).toBe("football");
    expect(inferRewardEventSport("Hull City vs Man Utd", null)).toBe("football");
  });

  it("keeps a named non-racing sport", () => {
    expect(inferRewardEventSport("Djokovic vs Alcaraz", "tennis")).toBe("tennis");
  });

  it("prefers football over a racing campaign sport when the free bet names a match", () => {
    expect(inferRewardEventSport("Hull vs Man Utd", "horse_racing")).toBe("football");
  });

  it("returns null when the free bet is not event-scoped", () => {
    expect(inferRewardEventSport(null, "general")).toBeNull();
    expect(inferRewardEventSport("", "football")).toBeNull();
  });
});

describe("findRewardEventMatch", () => {
  it("finds a fixture with promo shortenings", () => {
    const hit = findRewardEventMatch(
      [
        {
          homeTeam: "Hull City",
          awayTeam: "Manchester United",
          sport: "football",
          status: "upcoming",
        },
      ],
      "Hull",
      "Man Utd",
      "football"
    );
    expect(hit?.awayTeam).toBe("Manchester United");
  });

  it("skips finished fixtures", () => {
    expect(
      findRewardEventMatch(
        [
          {
            homeTeam: "Hull City",
            awayTeam: "Manchester United",
            sport: "football",
            status: "finished",
          },
        ],
        "Hull City",
        "Manchester United",
        "football"
      )
    ).toBeUndefined();
  });
});
