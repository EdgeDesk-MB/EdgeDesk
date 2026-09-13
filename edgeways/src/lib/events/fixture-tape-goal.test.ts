import { describe, expect, it } from "vitest";
import type { MatchTapeEvent } from "@/lib/events/match-tape";
import {
  bumpTapeGoalPreviewHome,
  exclusiveTapeGoal,
  lastStandingGoalMatchingScore,
  resolveTapeLastGoal,
  TAPE_GOAL_FLASH_MS,
  tapeGoalFromLastSideChange,
  tapeGoalFromLatestEvent,
  tapeGoalFromScoreDelta,
  tapeGoalPreviewRequested,
} from "./fixture-tape-goal";

function goal(
  side: "home" | "away",
  minute: number,
  extra?: number
): MatchTapeEvent {
  return extra ? { kind: "goal", side, minute: minute + extra, extra } : { kind: "goal", side, minute };
}

describe("tapeGoalFromScoreDelta", () => {
  it("does not flash the first score we see", () => {
    expect(tapeGoalFromScoreDelta(null, { home: 1, away: 0 })).toBeNull();
  });

  it("flashes the side that just scored", () => {
    expect(tapeGoalFromScoreDelta({ home: 0, away: 0 }, { home: 1, away: 0 })).toEqual({
      home: true,
      away: false,
    });
    expect(tapeGoalFromScoreDelta({ home: 1, away: 0 }, { home: 1, away: 1 })).toEqual({
      home: false,
      away: true,
    });
  });

  it("never flashes both sides when a poll skipped two goals", () => {
    expect(tapeGoalFromScoreDelta({ home: 0, away: 0 }, { home: 1, away: 1 })).toBeNull();
    expect(
      tapeGoalFromScoreDelta({ home: 1, away: 1 }, { home: 2, away: 2 }, "away")
    ).toEqual({
      home: false,
      away: true,
    });
    expect(
      tapeGoalFromScoreDelta({ home: 1, away: 1 }, { home: 2, away: 2 }, "home")
    ).toEqual({
      home: true,
      away: false,
    });
  });

  it("ignores a score correction or an unchanged tick", () => {
    expect(tapeGoalFromScoreDelta({ home: 2, away: 1 }, { home: 1, away: 1 })).toBeNull();
    expect(tapeGoalFromScoreDelta({ home: 1, away: 1 }, { home: 1, away: 1 })).toBeNull();
  });

  it("gates the live preview to localhost ?previewGoal=1", () => {
    expect(tapeGoalPreviewRequested("localhost", "?previewGoal=1")).toBe(true);
    expect(tapeGoalPreviewRequested("127.0.0.1", "?previewGoal=1")).toBe(true);
    expect(tapeGoalPreviewRequested("edgeways.app", "?previewGoal=1")).toBe(false);
    expect(tapeGoalPreviewRequested("localhost", "")).toBe(false);
  });

  it("holds the Goal window for 20 seconds", () => {
    expect(TAPE_GOAL_FLASH_MS).toBe(20_000);
  });

  it("bumps home for the preview tick", () => {
    expect(bumpTapeGoalPreviewHome({ homeScore: 1 }).homeScore).toBe(2);
    expect(bumpTapeGoalPreviewHome({ homeScore: null }).homeScore).toBe(1);
  });
});

describe("lastStandingGoalMatchingScore", () => {
  it("names the later of two same-minute goals once the tape matches the board", () => {
    expect(
      lastStandingGoalMatchingScore(
        [goal("home", 69), goal("away", 69)],
        { home: 1, away: 1 }
      )
    ).toEqual({ side: "away", minute: 69 });
    expect(
      lastStandingGoalMatchingScore(
        [goal("home", 64), goal("away", 66), goal("home", 69), goal("away", 69)],
        { home: 2, away: 2 }
      )
    ).toEqual({ side: "away", minute: 69 });
  });

  it("stays quiet when the tape is still short of the published score", () => {
    expect(
      lastStandingGoalMatchingScore([goal("home", 69)], { home: 2, away: 2 })
    ).toBeNull();
  });

  it("uses elapsed minutes so added-time goals still match the board clock", () => {
    expect(
      lastStandingGoalMatchingScore([goal("away", 90, 2)], { home: 0, away: 1 })
    ).toEqual({ side: "away", minute: 90 });
  });
});

describe("resolveTapeLastGoal", () => {
  it("prefers a matching tracked tape over the live-list hint", () => {
    expect(
      resolveTapeLastGoal(
        { home: 1, away: 1 },
        [goal("home", 12), goal("away", 40)],
        { lastGoalSide: "home", lastGoalMinute: 12 }
      )
    ).toEqual({ side: "away", minute: 40 });
  });

  it("falls back to the live-list hint when the tracked tape is missing", () => {
    expect(
      resolveTapeLastGoal(
        { home: 2, away: 2 },
        null,
        { lastGoalSide: "away", lastGoalMinute: 69 }
      )
    ).toEqual({ side: "away", minute: 69 });
  });
});

describe("tapeGoalFromLatestEvent", () => {
  it("flashes only the last same-minute goal on first paint", () => {
    expect(tapeGoalFromLatestEvent({ side: "away", minute: 69 }, 69)).toEqual(
      exclusiveTapeGoal("away")
    );
    expect(tapeGoalFromLatestEvent({ side: "home", minute: 64 }, 69)).toBeNull();
    expect(tapeGoalFromLatestEvent(null, 69)).toBeNull();
  });

  it("flashes when the tape later names the last scorer at this minute", () => {
    expect(
      tapeGoalFromLastSideChange(null, { side: "away", minute: 69 }, 69)
    ).toEqual(exclusiveTapeGoal("away"));
    expect(
      tapeGoalFromLastSideChange("home", { side: "away", minute: 69 }, 69)
    ).toEqual(exclusiveTapeGoal("away"));
    expect(
      tapeGoalFromLastSideChange("away", { side: "away", minute: 69 }, 69)
    ).toBeNull();
    expect(
      tapeGoalFromLastSideChange(null, { side: "away", minute: 64 }, 69)
    ).toBeNull();
  });
});
