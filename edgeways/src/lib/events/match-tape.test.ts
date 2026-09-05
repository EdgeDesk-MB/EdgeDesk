import { describe, expect, it } from "vitest";
import {
  formatTapeLine,
  parseMatchTape,
  tapeGoals,
} from "./match-tape";

const teams = { homeTeam: "Arsenal", awayTeam: "Liverpool" };

describe("parseMatchTape", () => {
  it("reads legacy goal-only rows as goals", () => {
    const tape = parseMatchTape(
      JSON.stringify([{ minute: 12, side: "home", player: "Saka", og: false }])
    );
    expect(tape).toEqual([
      { kind: "goal", minute: 12, side: "home", player: "Saka" },
    ]);
  });

  it("keeps typed cards and substitutions", () => {
    const tape = parseMatchTape(
      JSON.stringify([
        { kind: "card", minute: 33, side: "away", player: "Van Dijk", detail: "Yellow Card" },
        {
          kind: "subst",
          minute: 70,
          side: "home",
          player: "Trossard",
          assist: "Martinelli",
        },
      ])
    );
    expect(tape.map((e) => e.kind)).toEqual(["card", "subst"]);
  });

  it("drops invalid JSON and rows without a side", () => {
    expect(parseMatchTape("not-json")).toEqual([]);
    expect(parseMatchTape(JSON.stringify([{ minute: 9, player: "X" }]))).toEqual([]);
    expect(parseMatchTape(null)).toEqual([]);
  });
});

describe("tapeGoals", () => {
  it("returns only goals for trigger settlement", () => {
    const raw = JSON.stringify([
      { kind: "goal", minute: 8, side: "home", player: "Haaland" },
      { kind: "card", minute: 40, side: "away", player: "Dias", detail: "Yellow Card" },
      { kind: "goal", minute: 55, side: "away", player: "Foden", og: true },
    ]);
    expect(tapeGoals(raw)).toEqual([
      { minute: 8, side: "home", player: "Haaland" },
      { minute: 55, side: "away", player: "Foden", og: true },
    ]);
  });
});

describe("formatTapeLine", () => {
  it("labels own goals and bookings", () => {
    expect(
      formatTapeLine(
        { kind: "goal", minute: 12, side: "home", player: "Saka", og: true },
        teams
      )
    ).toBe("Saka 12' (og)");
    expect(
      formatTapeLine(
        { kind: "card", minute: 33, side: "away", player: "Van Dijk", detail: "Yellow Card" },
        teams
      )
    ).toBe("Van Dijk 33' · Yellow Card");
  });
});
