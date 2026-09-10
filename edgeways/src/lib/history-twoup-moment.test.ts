import { describe, expect, it } from "vitest";
import {
  earlyPayoutOccurredAt,
  settlementOccurredAt,
  twoUpLeadMinute,
  twoUpOccurredAt,
} from "./history-twoup-moment";

const KICKOFF = Date.parse("2026-09-09T19:00:00+01:00");

const tape = JSON.stringify([
  { kind: "goal", minute: 12, side: "home", player: "Palmer" },
  { kind: "goal", minute: 38, side: "home", player: "Jackson" },
  { kind: "goal", minute: 51, side: "away", player: "Bamford" },
  { kind: "goal", minute: 56, side: "away", player: "Rodon" },
]);

const chelsea = {
  id: 8,
  homeTeam: "Chelsea",
  awayTeam: "Leeds",
  startTime: KICKOFF,
  goals: tape,
  homeLed2: 1,
  awayLed2: 0,
};

describe("twoUpLeadMinute", () => {
  it("uses the kick that first puts a side two ahead: 2-0 at 38', not 1-0 or later", () => {
    expect(twoUpLeadMinute(tape, "home")).toBe(38);
    expect(twoUpLeadMinute(tape, "away")).toBeNull();
  });

  it("fires away on the first −2 lead, not a later 3-1", () => {
    const awayTape = JSON.stringify([
      { kind: "goal", minute: 9, side: "away" },
      { kind: "goal", minute: 22, side: "home" },
      { kind: "goal", minute: 61, side: "away" },
      { kind: "goal", minute: 70, side: "away" },
    ]);
    expect(twoUpLeadMinute(awayTape, "away")).toBe(70);
    expect(twoUpLeadMinute(awayTape, "home")).toBeNull();
  });
});

describe("earlyPayoutOccurredAt", () => {
  it("stamps Chelsea 2UP at the 2-0, not the settle poll", () => {
    const at = earlyPayoutOccurredAt(
      {
        eventId: 8,
        selection: "home",
        status: "early_payout",
        backStake: 10,
        betType: "qualifying",
        label: "2UP Chelsea",
      },
      chelsea
    );
    expect(at).toBe(twoUpOccurredAt(KICKOFF, 38));
  });

  it("returns null when the tape never shows a two-goal lead", () => {
    expect(
      earlyPayoutOccurredAt(
        {
          eventId: 8,
          selection: "home",
          status: "early_payout",
          backStake: 10,
          betType: "qualifying",
          label: "Chelsea",
        },
        { ...chelsea, goals: JSON.stringify([{ kind: "goal", minute: 12, side: "home" }]) }
      )
    ).toBeNull();
  });
});

describe("settlementOccurredAt", () => {
  it("uses the 2-up kick for early_payout, Date.now only as fallback", () => {
    const now = Date.parse("2026-09-10T08:04:00+01:00");
    expect(
      settlementOccurredAt({
        status: "early_payout",
        now,
        event: chelsea,
        bet: {
          eventId: 8,
          selection: "Chelsea",
          status: "early_payout",
          backStake: 10,
          betType: "qualifying",
          label: "2UP Chelsea",
        },
      })
    ).toBe(twoUpOccurredAt(KICKOFF, 38));
    expect(
      settlementOccurredAt({
        status: "won",
        now,
        event: chelsea,
        bet: {
          eventId: 8,
          selection: "home",
          status: "won",
          backStake: 10,
          betType: "qualifying",
          label: "Chelsea",
        },
      })
    ).toBe(now);
  });
});
