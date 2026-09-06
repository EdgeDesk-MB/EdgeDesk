import { describe, expect, it } from "vitest";
import {
  cardCaption,
  formatTapeDetail,
  formatTapeLine,
  formatTapeMinute,
  groupTapeByPeriod,
  parseMatchTape,
  periodEndScore,
  tapeGoals,
  tapePeriodId,
  tapeRunningScores,
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

  it("keeps added time on extra-time stoppage clocks", () => {
    const tape = parseMatchTape(
      JSON.stringify([
        {
          kind: "card",
          minute: 47,
          extra: 2,
          side: "home",
          player: "Mwanga J.",
          detail: "Red Card",
        },
      ])
    );
    expect(tape[0]).toMatchObject({ minute: 47, extra: 2, kind: "card" });
    expect(formatTapeMinute(tape[0]!)).toBe("45+2'");
    expect(tapePeriodId(tape[0]!)).toBe("first");
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

describe("groupTapeByPeriod", () => {
  it("splits stoppage-time first-half events from the second half", () => {
    const groups = groupTapeByPeriod([
      { kind: "card", minute: 47, extra: 2, side: "home", player: "Mwanga J." },
      { kind: "subst", minute: 46, side: "home", player: "Ndiaye R.", assist: "Nakamura S." },
      { kind: "goal", minute: 12, side: "away", player: "Doumbia K.", detail: "Penalty" },
    ]);
    expect(groups.map((g) => g.period)).toEqual(["first", "second"]);
    expect(groups[0]!.events.map((e) => e.player)).toEqual(["Doumbia K.", "Mwanga J."]);
    expect(groups[1]!.events[0]!.assist).toBe("Nakamura S.");
  });
});

describe("tapeRunningScores", () => {
  it("increments only on goals and keeps the score on later rows", () => {
    const events = [
      { kind: "goal" as const, minute: 12, side: "away" as const, player: "Doumbia" },
      { kind: "card" as const, minute: 39, side: "away" as const, player: "Doumbia" },
      { kind: "goal" as const, minute: 79, side: "home" as const, player: "Fofana" },
    ];
    expect(tapeRunningScores(events)).toEqual([
      { home: 0, away: 1 },
      { home: 0, away: 1 },
      { home: 1, away: 1 },
    ]);
  });
});

describe("formatTapeDetail", () => {
  it("sentence-cases feed captions and keeps mapped labels", () => {
    expect(formatTapeDetail("Penalty")).toBe("Penalty");
    expect(formatTapeDetail("Penalty - Saved")).toBe("Penalty - saved");
    expect(formatTapeDetail("Yellow Card")).toBeUndefined();
    expect(cardCaption("Yellow Card")).toBe("Yellow card");
    expect(cardCaption("Second Yellow card")).toBe("Second yellow");
  });
});

describe("periodEndScore", () => {
  it("uses the live score while the first half is still the last period", () => {
    const events = [
      { kind: "goal" as const, minute: 12, side: "away" as const },
    ];
    expect(
      periodEndScore(events, "first", {
        htHome: 0,
        htAway: 0,
        isLastPeriod: true,
        live: { home: 0, away: 1 },
      })
    ).toEqual({ home: 0, away: 1 });
  });

  it("prefers the published half-time score for the first half", () => {
    const events = [
      { kind: "goal" as const, minute: 12, side: "away" as const },
    ];
    expect(
      periodEndScore(events, "first", { htHome: 0, htAway: 1 })
    ).toEqual({ home: 0, away: 1 });
  });

  it("uses the live score on the last visible period", () => {
    const events = [
      { kind: "goal" as const, minute: 12, side: "away" as const },
      { kind: "goal" as const, minute: 79, side: "home" as const },
    ];
    expect(
      periodEndScore(events, "second", {
        isLastPeriod: true,
        live: { home: 1, away: 2 },
      })
    ).toEqual({ home: 1, away: 2 });
  });
});
