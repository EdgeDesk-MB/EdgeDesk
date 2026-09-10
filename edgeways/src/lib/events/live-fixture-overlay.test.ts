import { describe, expect, it } from "vitest";
import { mergeLiveFixtureOverlay, preferFresherLiveScore } from "./live-fixture-overlay";

function row(
  partial: Partial<{
    externalId: string;
    status: "upcoming" | "live" | "finished";
    homeScore: number;
    awayScore: number;
    minute: number;
  }> = {}
) {
  return {
    externalId: "stuttgart-viking",
    status: "live" as const,
    homeScore: 0,
    awayScore: 0,
    minute: 7,
    ...partial,
  };
}

describe("preferFresherLiveScore", () => {
  it("keeps a 2-1 over a stale 0-0", () => {
    expect(
      preferFresherLiveScore(row({ homeScore: 0, awayScore: 0 }), row({ homeScore: 2, awayScore: 1 }))
    ).toMatchObject({ homeScore: 2, awayScore: 1 });
  });

  it("does not regress a finished score to live", () => {
    expect(
      preferFresherLiveScore(
        row({ status: "finished", homeScore: 2, awayScore: 1, minute: 90 }),
        row({ status: "live", homeScore: 2, awayScore: 1, minute: 88 })
      ).status
    ).toBe("finished");
  });

  it("reopens a posted FT when the API goes to extra time", () => {
    expect(
      preferFresherLiveScore(
        row({ status: "finished", homeScore: 1, awayScore: 1, minute: 90 }),
        { ...row({ status: "live", homeScore: 1, awayScore: 1, minute: 91 }), period: "ET" }
      ).status
    ).toBe("live");
  });
});

describe("mergeLiveFixtureOverlay", () => {
  it("writes the live poll score onto the matching day-card row", () => {
    const served = mergeLiveFixtureOverlay(
      [row({ homeScore: 0, awayScore: 0, minute: 7 }), row({ externalId: "other" })],
      [row({ homeScore: 2, awayScore: 1, minute: 28 })]
    );
    expect(served[0]).toMatchObject({
      homeScore: 2,
      awayScore: 1,
      minute: 28,
      status: "live",
    });
    expect(served[1]?.homeScore).toBe(0);
  });
});
