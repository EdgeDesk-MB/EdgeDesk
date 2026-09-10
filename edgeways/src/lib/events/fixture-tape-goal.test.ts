import { describe, expect, it } from "vitest";
import {
  bumpTapeGoalPreviewHome,
  TAPE_GOAL_FLASH_MS,
  tapeGoalFromScoreDelta,
  tapeGoalPreviewRequested,
} from "./fixture-tape-goal";

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

  it("flashes both sides when a poll skipped two goals", () => {
    expect(tapeGoalFromScoreDelta({ home: 0, away: 0 }, { home: 1, away: 1 })).toEqual({
      home: true,
      away: true,
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
