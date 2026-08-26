import { describe, expect, it } from "vitest";
import {
  canonicalizeTeam,
  footballTeamMatchScore,
  footballTeamsMatch,
  isBttsYesRunner,
  isDrawRunner,
  isOver25Runner,
  normalizeFootballTeam,
  parseFootballEventSides,
  scoreFootballEvent,
} from "./football-match";

describe("normalizeFootballTeam", () => {
  it("strips accents, ampersands and FC suffixes", () => {
    expect(normalizeFootballTeam("Atlético Madrid")).toBe("atletico madrid");
    expect(normalizeFootballTeam("Brighton & Hove Albion")).toBe("brighton and hove albion");
    expect(normalizeFootballTeam("AFC Bournemouth")).toBe("bournemouth");
  });
});

describe("canonicalizeTeam", () => {
  it("maps Betfair shorts onto API-Football names", () => {
    expect(canonicalizeTeam("Man Utd")).toBe(canonicalizeTeam("Manchester United"));
    expect(canonicalizeTeam("Nottm Forest")).toBe(canonicalizeTeam("Nottingham Forest"));
    expect(canonicalizeTeam("Spurs")).toBe(canonicalizeTeam("Tottenham Hotspur"));
    expect(canonicalizeTeam("Wolves")).toBe(canonicalizeTeam("Wolverhampton Wanderers"));
  });
});

describe("footballTeamMatchScore", () => {
  it("does not treat United as a match on its own", () => {
    expect(footballTeamsMatch("United", "Manchester United")).toBe(false);
    expect(footballTeamsMatch("United", "Newcastle United")).toBe(false);
  });

  it("does not confuse Villa with Villarreal", () => {
    expect(footballTeamMatchScore("Villa", "Villarreal")).toBe(0);
    expect(footballTeamsMatch("Aston Villa", "Villa")).toBe(true);
  });
});

describe("scoreFootballEvent", () => {
  it("matches Everton v Crystal Palace in either name style", () => {
    expect(scoreFootballEvent("Everton v Crystal Palace", "Everton", "Crystal Palace")).toBeGreaterThanOrEqual(
      120
    );
    expect(scoreFootballEvent("Everton vs Crystal Palace", "Everton", "Palace")).toBeGreaterThanOrEqual(120);
  });

  it("matches Man Utd v Nottm Forest against full names", () => {
    expect(
      scoreFootballEvent("Man Utd v Nottm Forest", "Manchester United", "Nottingham Forest")
    ).toBeGreaterThanOrEqual(120);
  });

  it("rejects a different away side", () => {
    expect(scoreFootballEvent("Everton v Liverpool", "Everton", "Crystal Palace")).toBe(0);
  });

  it("still scores a swapped home/away listing", () => {
    expect(scoreFootballEvent("Crystal Palace v Everton", "Everton", "Crystal Palace")).toBeGreaterThanOrEqual(
      120
    );
  });
});

describe("parseFootballEventSides", () => {
  it("splits v and vs", () => {
    expect(parseFootballEventSides("Everton v Crystal Palace")).toEqual({
      left: "Everton",
      right: "Crystal Palace",
    });
    expect(parseFootballEventSides("Everton vs. Crystal Palace")).toEqual({
      left: "Everton",
      right: "Crystal Palace",
    });
  });
});

describe("runner helpers", () => {
  it("recognises draw, Over 2.5 and BTTS Yes", () => {
    expect(isDrawRunner("The Draw")).toBe(true);
    expect(isOver25Runner("Over 2.5 Goals")).toBe(true);
    expect(isOver25Runner("Under 2.5 Goals")).toBe(false);
    expect(isBttsYesRunner("Yes")).toBe(true);
    expect(isBttsYesRunner("No")).toBe(false);
  });
});
