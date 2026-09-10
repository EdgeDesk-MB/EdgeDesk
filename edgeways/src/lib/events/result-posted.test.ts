import { describe, expect, it } from "vitest";
import {
  eventResultPostedAt,
  stampResultPostedAt,
  stillWatchingAfterWhistle,
} from "./result-posted";

const KO = Date.parse("2026-09-09T20:00:00+01:00");
const goals = JSON.stringify([
  { kind: "goal", minute: 48, side: "home" },
  { kind: "goal", minute: 94, side: "home" },
]);

describe("stampResultPostedAt", () => {
  it("uses the live poll that first sees FT, not 90' and not a morning catch-up", () => {
    const watched = stampResultPostedAt({
      previousStatus: "live",
      startTime: KO,
      goals,
      minute: 90,
      now: KO + 95 * 60 * 1000,
      incomingStatus: "finished",
    });
    expect(watched).toBe(KO + 95 * 60 * 1000);

    const catchUp = stampResultPostedAt({
      previousStatus: "upcoming",
      startTime: KO,
      goals,
      minute: 90,
      now: Date.parse("2026-09-10T08:04:00+01:00"),
      incomingStatus: "finished",
    });
    expect(catchUp).toBe(KO + 94 * 60 * 1000 + 1000);
  });

  it("clears the stamp when the API reopens the match for extra time", () => {
    expect(
      stampResultPostedAt({
        previousStatus: "finished",
        previousPostedAt: KO + 90 * 60 * 1000,
        startTime: KO,
        now: KO + 100 * 60 * 1000,
        incomingStatus: "live",
        incomingPeriod: "ET",
      })
    ).toBeNull();
  });
});

describe("eventResultPostedAt", () => {
  it("places the posted result after the last in-play kick", () => {
    expect(
      eventResultPostedAt({
        status: "finished",
        startTime: KO,
        goals,
        minute: 90,
      })
    ).toBe(KO + 94 * 60 * 1000 + 1000);
  });
});

describe("stillWatchingAfterWhistle", () => {
  it("watches a just-posted FT, then stops after AET", () => {
    expect(
      stillWatchingAfterWhistle(
        { status: "finished", matchEnding: "ft", resultPostedAt: KO + 90 * 60 * 1000, startTime: KO },
        KO + 95 * 60 * 1000
      )
    ).toBe(true);
    expect(
      stillWatchingAfterWhistle(
        { status: "finished", matchEnding: "aet", resultPostedAt: KO + 120 * 60 * 1000, startTime: KO },
        KO + 125 * 60 * 1000
      )
    ).toBe(false);
  });
});
