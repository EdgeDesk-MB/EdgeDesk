import { describe, expect, it } from "vitest";
import {
  formatLivePositionTriggerNote,
  livePositionTriggerNoteShowsBolt,
} from "./live-position-note";
import type { TriggerContext } from "@/lib/calc";

const footballContext: TriggerContext = {
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  homeScore: 1,
  awayScore: 0,
  finished: false,
  goals: [{ minute: 12, side: "home", player: "Harry Kane" }],
};

describe("formatLivePositionTriggerNote", () => {
  it("shows wins IF only for parsed bet-win football triggers", () => {
    const note = formatLivePositionTriggerNote(
      {
        triggerText: "Harry Kane scores first",
        triggerRule: JSON.stringify({
          v: 2,
          betWin: { kind: "first_goalscorer", player: "Harry Kane" },
          effects: [],
        }),
        label: "Qualify · Bet365",
      },
      { kind: "first_goalscorer", player: "Harry Kane" },
      footballContext
    );
    expect(note).toMatch(/^wins IF Harry Kane scores first/);
    expect(livePositionTriggerNoteShowsBolt(note)).toBe(true);
  });

  it("omits unconditional bet X get X offer text", () => {
    const note = formatLivePositionTriggerNote(
      {
        triggerText: "Bet £10 get £10 free bet",
        triggerRule: JSON.stringify({
          v: 2,
          betWin: null,
          effects: [{ kind: "free_bet_award", amount: 10, positions: [] }],
        }),
        label: "Qualify · Ladbrokes",
      },
      null,
      footballContext
    );
    expect(note).toBeNull();
    expect(livePositionTriggerNoteShowsBolt(note)).toBe(false);
  });

  it("describes place-based free bets without wins IF wording", () => {
    const note = formatLivePositionTriggerNote(
      {
        triggerText: "Bet £50 get £50 FB if 2nd, 3rd, 4th",
        triggerRule: JSON.stringify({
          v: 2,
          betWin: null,
          effects: [{ kind: "free_bet_award", amount: 50, positions: [2, 3, 4] }],
        }),
        label: "Qualify · Bet365",
      },
      null,
      footballContext
    );
    expect(note).toBe("£50.00 free bet if selection finishes 2nd, 3rd or 4th");
    expect(livePositionTriggerNoteShowsBolt(note)).toBe(false);
  });
});
