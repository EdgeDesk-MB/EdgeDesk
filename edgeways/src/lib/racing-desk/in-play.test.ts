import { describe, expect, it } from "vitest";
import {
  RACE_OFF_COUNTDOWN_MS,
  RACE_OFF_INTERSTITIAL_GRACE_MS,
  formatRaceOffClock,
  isDeskRaceInPlay,
  isWithinRaceOffCountdown,
  isWithinRaceOffGrace,
  needsRaceOffFineClock,
  normalizeRaceApiStatus,
} from "./in-play";

const NOW = Date.parse("2026-08-07T15:00:00.000Z");

describe("normalizeRaceApiStatus", () => {
  it("collapses spacing and case", () => {
    expect(normalizeRaceApiStatus("Weighed In")).toBe("WEIGHEDIN");
    expect(normalizeRaceApiStatus("going-down")).toBe("GOINGDOWN");
    expect(normalizeRaceApiStatus("")).toBe("");
    expect(normalizeRaceApiStatus(null)).toBe("");
  });
});

describe("formatRaceOffClock", () => {
  it("counts down before advertised off", () => {
    expect(formatRaceOffClock(NOW + 125_000, NOW)).toEqual({
      phase: "countdown",
      clock: "2:05",
      signed: "\u22122:05",
    });
  });

  it("counts up after advertised off", () => {
    expect(formatRaceOffClock(NOW - 72_000, NOW)).toEqual({
      phase: "elapsed",
      clock: "1:12",
      signed: "+1:12",
    });
  });

  it("includes hours when needed", () => {
    expect(formatRaceOffClock(NOW - 3_661_000, NOW).clock).toBe("1:01:01");
  });
});

describe("race off countdown window", () => {
  const coarseMs = 30_000;

  it("shows Off in at exactly five minutes", () => {
    expect(isWithinRaceOffCountdown(NOW + RACE_OFF_COUNTDOWN_MS, NOW)).toBe(true);
    expect(isWithinRaceOffCountdown(NOW + RACE_OFF_COUNTDOWN_MS + 1, NOW)).toBe(
      false
    );
  });

  it("hides Off in once advertised off is reached", () => {
    expect(isWithinRaceOffCountdown(NOW, NOW)).toBe(false);
  });

  it("enables the 1s tick at the Off in boundary (not only after it)", () => {
    // Former bug: display used <= 5:00 while fine-clock used < 5:00, so
    // "Off in 5:00" painted from the 30s coarse clock and stuck.
    expect(
      needsRaceOffFineClock(NOW + RACE_OFF_COUNTDOWN_MS, NOW, coarseMs)
    ).toBe(true);
  });

  it("enables the 1s tick one coarse bucket before Off in appears", () => {
    expect(
      needsRaceOffFineClock(
        NOW + RACE_OFF_COUNTDOWN_MS + coarseMs,
        NOW,
        coarseMs
      )
    ).toBe(true);
    expect(
      needsRaceOffFineClock(
        NOW + RACE_OFF_COUNTDOWN_MS + coarseMs + 1,
        NOW,
        coarseMs
      )
    ).toBe(false);
  });
});

describe("isWithinRaceOffGrace", () => {
  it("is true in the first minute after advertised off", () => {
    expect(isWithinRaceOffGrace(NOW, NOW + 30_000)).toBe(true);
    expect(isWithinRaceOffGrace(NOW, NOW + RACE_OFF_INTERSTITIAL_GRACE_MS)).toBe(false);
    expect(isWithinRaceOffGrace(NOW, NOW - 1)).toBe(false);
  });
});

describe("isDeskRaceInPlay", () => {
  it("is false before advertised off", () => {
    expect(
      isDeskRaceInPlay(
        { status: "upcoming", startTime: NOW + 60_000 },
        NOW
      )
    ).toBe(false);
  });

  it("is false during the post-off grace window", () => {
    expect(
      isDeskRaceInPlay(
        { status: "live", startTime: NOW - 30_000 },
        NOW
      )
    ).toBe(false);
  });

  it("is true after the grace window with no result", () => {
    expect(
      isDeskRaceInPlay(
        { status: "live", startTime: NOW - RACE_OFF_INTERSTITIAL_GRACE_MS - 1 },
        NOW
      )
    ).toBe(true);
  });

  it("is false when a winner is known", () => {
    expect(
      isDeskRaceInPlay(
        {
          status: "finished",
          startTime: NOW - 120_000,
          winner: "Constitution Hill",
        },
        NOW
      )
    ).toBe(false);
  });

  it("is false when a finishing position is present", () => {
    expect(
      isDeskRaceInPlay(
        {
          status: "live",
          startTime: NOW - 120_000,
          runners: [{ finishingPosition: 1 }],
        },
        NOW
      )
    ).toBe(false);
  });

  it("is false when abandoned", () => {
    expect(
      isDeskRaceInPlay(
        {
          status: "live",
          startTime: NOW - 120_000,
          abandoned: true,
        },
        NOW
      )
    ).toBe(false);
  });

  it("skips interstitial when provider says DELAYED", () => {
    expect(
      isDeskRaceInPlay(
        {
          status: "live",
          startTime: NOW - 120_000,
          raceStatus: "Delayed",
        },
        NOW
      )
    ).toBe(false);
  });

  it("treats provider OFF as in-play even during grace", () => {
    expect(
      isDeskRaceInPlay(
        {
          status: "upcoming",
          startTime: NOW + 60_000,
          raceStatus: "OFF",
        },
        NOW
      )
    ).toBe(true);
    expect(
      isDeskRaceInPlay(
        {
          status: "live",
          startTime: NOW - 15_000,
          raceStatus: "OFF",
        },
        NOW
      )
    ).toBe(true);
  });

  it("skips interstitial for post-race provider statuses", () => {
    expect(
      isDeskRaceInPlay(
        {
          status: "live",
          startTime: NOW - 120_000,
          raceStatus: "Weighed In",
        },
        NOW
      )
    ).toBe(false);
  });

  it("uses the clock when Racing API status is declared", () => {
    expect(
      isDeskRaceInPlay(
        {
          status: "live",
          startTime: NOW - 30_000,
          raceStatus: "declared",
        },
        NOW
      )
    ).toBe(false);
    expect(
      isDeskRaceInPlay(
        {
          status: "live",
          startTime: NOW - RACE_OFF_INTERSTITIAL_GRACE_MS - 1,
          raceStatus: "declared",
        },
        NOW
      )
    ).toBe(true);
    expect(
      isDeskRaceInPlay(
        {
          status: "upcoming",
          startTime: NOW + 60_000,
          raceStatus: "declared",
        },
        NOW
      )
    ).toBe(false);
  });

  it("skips interstitial when Racing API status is result", () => {
    expect(
      isDeskRaceInPlay(
        {
          status: "live",
          startTime: NOW - 120_000,
          raceStatus: "result",
        },
        NOW
      )
    ).toBe(false);
  });
});
