import { describe, expect, it } from "vitest";
import {
  alignSideBackMarksToFixture,
  eventHasAnyUserBack,
  eventSideBackMark,
  eventSideHasUserBack,
  type TwoupBackBet,
} from "./twoup-backed";

const event = { id: 8, homeTeam: "Wolves", awayTeam: "Blackburn" };

function bet(partial: Partial<TwoupBackBet> & Pick<TwoupBackBet, "selection">): TwoupBackBet {
  return {
    eventId: 8,
    status: "open",
    backStake: 10,
    betType: "qualifying",
    label: "Wolves",
    notes: null,
    legs: null,
    ...partial,
  };
}

describe("eventSideHasUserBack", () => {
  it("is false when the fixture is tracked with no bet", () => {
    expect(eventSideHasUserBack(event, "home", [])).toBe(false);
  });

  it("is true when the two-ahead side was backed", () => {
    expect(eventSideHasUserBack(event, "home", [bet({ selection: "home" })])).toBe(true);
    expect(eventSideHasUserBack(event, "home", [bet({ selection: "Wolves" })])).toBe(true);
  });

  it("is false when the back is on the other side", () => {
    expect(eventSideHasUserBack(event, "home", [bet({ selection: "away" })])).toBe(false);
    expect(eventSideHasUserBack(event, "away", [bet({ selection: "Wolves" })])).toBe(false);
  });

  it("is false for a lay-only or lock-in close", () => {
    expect(
      eventSideHasUserBack(event, "home", [
        bet({ selection: "home", betType: "lay_only", backStake: 0 }),
      ])
    ).toBe(false);
    expect(
      eventSideHasUserBack(event, "home", [
        bet({ selection: "home", label: "Lock-in back · Blackburn" }),
      ])
    ).toBe(false);
  });

  it("is false for a voided back", () => {
    expect(
      eventSideHasUserBack(event, "home", [bet({ selection: "home", status: "void" })])
    ).toBe(false);
  });

  it("reads a dutch leg on the two-ahead side", () => {
    expect(
      eventSideHasUserBack(event, "away", [
        bet({
          selection: "",
          backStake: 0,
          betType: "dutch",
          legs: JSON.stringify([
            { selection: "home", stake: 40 },
            { selection: "away", stake: 35 },
          ]),
        }),
      ])
    ).toBe(true);
    expect(
      eventSideHasUserBack(event, "away", [
        bet({
          selection: "",
          backStake: 0,
          betType: "dutch",
          legs: JSON.stringify([{ selection: "home", stake: 40 }]),
        }),
      ])
    ).toBe(false);
  });

  it("eventHasAnyUserBack is true for a racing runner back", () => {
    expect(
      eventHasAnyUserBack(
        { id: 8, homeTeam: "Ascot", awayTeam: "3:00", sport: "horse_racing" },
        [bet({ selection: "Constitution Hill" })]
      )
    ).toBe(true);
    expect(
      eventHasAnyUserBack(
        { id: 8, homeTeam: "Ascot", awayTeam: "3:00", sport: "horse_racing" },
        [bet({ selection: "Constitution Hill", betType: "lay_only", backStake: 0 })]
      )
    ).toBe(false);
  });

  it("ignores bets on another fixture", () => {
    expect(
      eventSideHasUserBack(event, "home", [bet({ eventId: 99, selection: "home" })])
    ).toBe(false);
  });
});

describe("eventSideBackMark", () => {
  it("counts open backs and prefers open over settled", () => {
    expect(eventSideBackMark(event, "home", [bet({ selection: "Wolves" })])).toEqual({
      kind: "open",
      betCount: 1,
    });
    expect(
      eventSideBackMark(event, "home", [
        bet({ selection: "Wolves", status: "won" }),
        bet({ selection: "home" }),
        bet({ selection: "Wolves", status: "lost" }),
      ])
    ).toEqual({ kind: "open", betCount: 1 });
  });

  it("counts settled backs when nothing is still open", () => {
    expect(
      eventSideBackMark(event, "away", [
        bet({ selection: "Blackburn", status: "won" }),
        bet({ selection: "away", status: "lost" }),
      ])
    ).toEqual({ kind: "settled", betCount: 2 });
  });

  it("follows an edited selection over leftover dutch legs", () => {
    const edited = bet({
      selection: "away",
      backStake: 0,
      betType: "dutch",
      legs: JSON.stringify([
        { selection: "home", stake: 40 },
        { selection: "away", stake: 35 },
      ]),
    });
    expect(eventSideBackMark(event, "home", [edited])).toBeNull();
    expect(eventSideBackMark(event, "away", [edited])).toEqual({
      kind: "open",
      betCount: 1,
    });
  });

  it("follows a team-name selection after the pick changes", () => {
    expect(
      eventSideBackMark(event, "home", [bet({ selection: "Blackburn" })])
    ).toBeNull();
    expect(
      eventSideBackMark(event, "away", [bet({ selection: "Blackburn" })])
    ).toEqual({ kind: "open", betCount: 1 });
  });
});

describe("alignSideBackMarksToFixture", () => {
  it("swaps marks when the fixture lists the clubs the other way", () => {
    const homeMark = { kind: "open" as const, betCount: 1 };
    expect(
      alignSideBackMarksToFixture(
        event,
        { homeTeam: "Blackburn", awayTeam: "Wolves" },
        { home: homeMark, away: null }
      )
    ).toEqual({ home: null, away: homeMark });
  });

  it("keeps marks when fixture and event sides agree", () => {
    const homeMark = { kind: "open" as const, betCount: 1 };
    expect(
      alignSideBackMarksToFixture(
        event,
        { homeTeam: "Wolves", awayTeam: "Blackburn" },
        { home: homeMark, away: null }
      )
    ).toEqual({ home: homeMark, away: null });
  });
});
