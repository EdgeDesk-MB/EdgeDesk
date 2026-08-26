import { describe, expect, it } from "vitest";
import {
  betHighlightsBackRunner,
  liveBacksMoved,
  liveMatchBackTags,
  liveOddsFlash,
  mergeLiveMatchBackPoll,
  nextLiveMatchBackQuoteSeq,
  shortFootballTeamLabel,
} from "./live-match-backs";

describe("shortFootballTeamLabel", () => {
  it("shortens Hull City and Manchester United for tags", () => {
    expect(shortFootballTeamLabel("Hull City")).toBe("Hull");
    expect(shortFootballTeamLabel("Manchester United")).toBe("United");
  });

  it("title-cases an already-canonical short name", () => {
    expect(shortFootballTeamLabel("Brighton")).toBe("Brighton");
  });
});

describe("betHighlightsBackRunner", () => {
  it("matches home/away/draw tokens and team names", () => {
    expect(betHighlightsBackRunner("home", "home", "Hull City", "Manchester United")).toBe(
      true
    );
    expect(betHighlightsBackRunner("Hull City", "home", "Hull City", "Manchester United")).toBe(
      true
    );
    expect(betHighlightsBackRunner("the draw", "draw", "Hull City", "Manchester United")).toBe(
      true
    );
    expect(betHighlightsBackRunner("United", "away", "Hull City", "Manchester United")).toBe(
      true
    );
    expect(betHighlightsBackRunner("home", "away", "Hull City", "Manchester United")).toBe(
      false
    );
  });
});

describe("liveMatchBackTags", () => {
  it("builds Hull / Draw / United tags and highlights the open selection", () => {
    const tags = liveMatchBackTags({
      homeTeam: "Hull City",
      awayTeam: "Manchester United",
      odds: { homeBack: 1.32, drawBack: 5.8, awayBack: 12 },
      selections: ["home"],
    });
    expect(tags).toEqual([
      { runner: "home", label: "Hull", odds: 1.32, highlighted: true },
      { runner: "draw", label: "Draw", odds: 5.8, highlighted: false },
      { runner: "away", label: "United", odds: 12, highlighted: false },
    ]);
  });

  it("returns null when no backs are priced", () => {
    expect(
      liveMatchBackTags({
        homeTeam: "Hull City",
        awayTeam: "Manchester United",
        odds: {},
      })
    ).toBeNull();
  });

});

describe("liveOddsFlash", () => {
  it("flashes green when the back lengthens and red when it shortens", () => {
    expect(liveOddsFlash(1.32, 1.65)).toBe("up");
    expect(liveOddsFlash(6.2, 6)).toBe("down");
    expect(liveOddsFlash(undefined, 1.65)).toBeNull();
    expect(liveOddsFlash(1.65, 1.65)).toBeNull();
  });
});

describe("mergeLiveMatchBackPoll", () => {
  const live = { homeBack: 1.65, drawBack: 4.3, awayBack: 6 };

  it("holds the last backs and marks suspended", () => {
    expect(
      mergeLiveMatchBackPoll({ odds: live, suspended: false }, { kind: "suspended", odds: {} })
    ).toEqual({ odds: live, suspended: true });
  });

  it("keeps last backs when prices vanish after a live print", () => {
    expect(
      mergeLiveMatchBackPoll({ odds: live, suspended: false }, { kind: "empty", odds: {} })
    ).toEqual({ odds: live, suspended: true });
  });

  it("clears when the market is closed", () => {
    expect(
      mergeLiveMatchBackPoll({ odds: live, suspended: true }, { kind: "closed", odds: {} })
    ).toBeNull();
  });

  it("holds the previous row on a transport blip without claiming suspend", () => {
    expect(
      mergeLiveMatchBackPoll({ odds: live, suspended: false }, { kind: "hold", odds: {} })
    ).toEqual({ odds: live, suspended: false });
  });
});

describe("nextLiveMatchBackQuoteSeq", () => {
  const live = { homeBack: 1.65, drawBack: 4.3, awayBack: 6 };

  it("advances when a live book quote arrives", () => {
    expect(nextLiveMatchBackQuoteSeq(2, { kind: "live", odds: live })).toBe(3);
  });

  it("holds on suspend, empty, or transport blip", () => {
    expect(nextLiveMatchBackQuoteSeq(2, { kind: "suspended", odds: live })).toBe(2);
    expect(nextLiveMatchBackQuoteSeq(2, { kind: "empty", odds: {} })).toBe(2);
    expect(nextLiveMatchBackQuoteSeq(2, { kind: "hold", odds: {} })).toBe(2);
  });
});

describe("liveBacksMoved", () => {
  it("treats a displayed 0.01 tick as a move", () => {
    expect(liveBacksMoved(1.32, 1.31)).toBe(true);
    expect(liveBacksMoved(1.32, 1.32)).toBe(false);
  });
});
