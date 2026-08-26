import { describe, expect, it } from "vitest";
import type { RaceResult } from "@/lib/racing";
import type { RacingRunnerDetail } from "@/lib/racing-desk/types";
import { isDeskRacePast } from "@/lib/racing-desk/past";
import {
  applyRaceResultToDeskRunners,
  applyRunnerBetMarks,
} from "@/lib/services/racing-desk";

function runner(partial: Partial<RacingRunnerDetail> & { name: string }): RacingRunnerDetail {
  return {
    horseId: partial.horseId ?? partial.name.toLowerCase().replace(/\s+/g, "-"),
    number: partial.number ?? "1",
    jockey: partial.jockey ?? "Jockey",
    trainer: partial.trainer ?? "Trainer",
    nonRunner: partial.nonRunner ?? false,
    ...partial,
  };
}

describe("isDeskRacePast", () => {
  const now = Date.parse("2026-08-05T16:00:00+01:00");

  it("treats finished status as past", () => {
    expect(
      isDeskRacePast({ status: "finished", startTime: now + 60_000 }, now)
    ).toBe(true);
  });

  it("treats startTime before now as past even when still upcoming", () => {
    expect(
      isDeskRacePast({ status: "upcoming", startTime: now - 60_000 }, now)
    ).toBe(true);
  });

  it("keeps future races as not past", () => {
    expect(
      isDeskRacePast({ status: "upcoming", startTime: now + 60_000 }, now)
    ).toBe(false);
  });
});

describe("applyRaceResultToDeskRunners", () => {
  const result: RaceResult = {
    kind: "horse_racing",
    winner: "River Wharfe",
    fieldSize: 3,
    runners: [
      {
        horse: "River Wharfe",
        position: 1,
        spLabel: "2/1 Fav",
        spDecimal: 3,
        isSpFavourite: true,
      },
      {
        horse: "Aspire To Glory",
        position: 2,
        spLabel: "11/4",
        btn: "sh",
        ovrBtn: "sh",
      },
      { horse: "Celebrating Ethel", position: 3, btn: "1½", ovrBtn: "1¾" },
    ],
  };

  it("attaches finishing position, SP and beaten distances by horse name", () => {
    const runners = applyRaceResultToDeskRunners(
      [
        runner({ name: "River Wharfe", number: "3" }),
        runner({ name: "Aspire To Glory", number: "1" }),
        runner({ name: "Celebrating Ethel", number: "2" }),
      ],
      result
    );

    expect(runners[0]?.finishingPosition).toBe(1);
    expect(runners[0]?.spFraction).toBe("2/1 Fav");
    expect(runners[0]?.spDecimal).toBe(3);
    expect(runners[0]?.isSpFavourite).toBe(true);
    expect(runners[1]?.finishingPosition).toBe(2);
    expect(runners[1]?.btn).toBe("sh");
    expect(runners[2]?.finishingPosition).toBe(3);
    expect(runners[2]?.ovrBtn).toBe("1¾");
  });

  it("matches fuzzy horse names", () => {
    const runners = applyRaceResultToDeskRunners(
      [runner({ name: "River Wharfe!" })],
      result
    );
    expect(runners[0]?.finishingPosition).toBe(1);
  });
});

describe("applyRunnerBetMarks", () => {
  it("marks open bets over settled, matched by selection name", () => {
    const runners = applyRunnerBetMarks(
      [
        runner({ name: "River Wharfe" }),
        runner({ name: "Aspire To Glory" }),
        runner({ name: "Sangara" }),
      ],
      [
        { selection: "River Wharfe", status: "open" },
        { selection: "River Wharfe", status: "won" },
        { selection: "Aspire To Glory", status: "lost" },
      ]
    );
    expect(runners[0]?.betMark).toEqual({ kind: "open", betCount: 1 });
    expect(runners[1]?.betMark).toEqual({ kind: "settled", betCount: 1 });
    expect(runners[2]?.betMark).toBeUndefined();
  });
});
