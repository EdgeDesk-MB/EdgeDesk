import { describe, expect, it } from "vitest";
import type { EventRow, HistoryRow } from "@/lib/db/schema";
import {
  formatGoalHistoryCopy,
  formatGoalScorelineSegments,
  formatGoalScorelineText,
  goalHistoryCopyFromEntry,
  inferGoalScoringSidesFromEntries,
  inferTwoUpTriggerGoalIds,
  inferScoringSide,
  inferScoringSideFromScoreDelta,
  previousScorelineFromDedupe,
} from "./history-goal-copy";

const event = {
  homeTeam: "Paris Saint Germain",
  awayTeam: "Aston Villa",
  goals: JSON.stringify([
    { minute: 21, side: "home", player: "K. Mbappé" },
    { minute: 45, side: "away" },
    { minute: 66, side: "home", player: "O. Dembélé" },
  ]),
} satisfies Pick<EventRow, "homeTeam" | "awayTeam" | "goals">;

function entry(
  partial: Partial<Pick<HistoryRow, "title" | "detail" | "dedupe" | "minute">> &
    Pick<HistoryRow, "title">
): Pick<HistoryRow, "kind" | "title" | "detail" | "dedupe" | "minute"> {
  return {
    kind: "goal",
    detail: null,
    dedupe: "goal:1:0",
    minute: 21,
    ...partial,
  };
}

describe("formatGoalHistoryCopy", () => {
  it("names the player in the title and keeps the team for the scoreline", () => {
    expect(
      formatGoalHistoryCopy({
        side: "home",
        player: "K. Mbappé",
        homeTeam: "Paris Saint Germain",
        awayTeam: "Aston Villa",
      })
    ).toEqual({
      title: "Goal: K. Mbappé!",
      parts: [{ text: "Goal: K. Mbappé!" }],
      scoringSide: "home",
      scoringTeam: "Paris Saint Germain",
    });
  });

  it("keeps a plain Goal title when the scorer is unknown", () => {
    expect(
      formatGoalHistoryCopy({
        side: "away",
        homeTeam: "Paris Saint Germain",
        awayTeam: "Aston Villa",
      })
    ).toEqual({
      title: "Goal!",
      parts: [{ text: "Goal!" }],
      scoringSide: "away",
      scoringTeam: "Aston Villa",
    });
  });

  it("labels own goals by the player, not the team", () => {
    expect(
      formatGoalHistoryCopy({
        side: "home",
        player: "J. Sánchez",
        og: true,
        homeTeam: "Paris Saint Germain",
        awayTeam: "Aston Villa",
      }).title
    ).toBe("Own goal: J. Sánchez");
  });

  it("falls back to Goal! when the scoring side is unknown", () => {
    expect(
      formatGoalHistoryCopy({
        side: null,
        homeTeam: "Paris Saint Germain",
        awayTeam: "Aston Villa",
      }).title
    ).toBe("Goal!");
  });
});

describe("inferScoringSideFromScoreDelta", () => {
  it("detects a single-goal increment", () => {
    expect(inferScoringSideFromScoreDelta(1, 0, 1, 1)).toBe("away");
    expect(inferScoringSideFromScoreDelta(1, 1, 2, 1)).toBe("home");
  });

  it("refuses catch-up jumps", () => {
    expect(inferScoringSideFromScoreDelta(0, 0, 2, 1)).toBeNull();
  });
});

describe("previousScorelineFromDedupe", () => {
  it("picks the closest earlier score tick", () => {
    expect(
      previousScorelineFromDedupe(
        ["score:9:1-0", "score:9:1-1", "ko:9"],
        9,
        2,
        1
      )
    ).toEqual({ home: 1, away: 1 });
  });
});

describe("inferScoringSide", () => {
  it("uses the timeline total when that is only one goal behind", () => {
    expect(
      inferScoringSide({
        knownHome: 1,
        knownAway: 0,
        currentHome: 1,
        currentAway: 1,
      })
    ).toBe("away");
  });

  it("prefers a later history tick over an empty timeline", () => {
    expect(
      inferScoringSide({
        knownHome: 0,
        knownAway: 0,
        currentHome: 2,
        currentAway: 1,
        previousScore: { home: 1, away: 1 },
      })
    ).toBe("home");
  });
});

describe("goalHistoryCopyFromEntry", () => {
  it("keeps a generic 1-0 row titled Goal and still knows home scored", () => {
    const copy = goalHistoryCopyFromEntry(
      entry({
        title: "Goal",
        detail: "Paris Saint Germain 1-0 Aston Villa",
        dedupe: "score:1:1-0",
        minute: 21,
      }),
      { ...event, goals: null }
    );
    expect(copy.title).toBe("Goal!");
    expect(copy.scoringSide).toBe("home");
  });

  it("keeps Goal! when the scoreline does not reveal the scorer", () => {
    expect(
      goalHistoryCopyFromEntry(
        entry({
          title: "Goal",
          detail: "Paris Saint Germain 2-1 Aston Villa",
          dedupe: "score:1:2-1",
          minute: 66,
        }),
        { ...event, goals: null }
      ).title
    ).toBe("Goal!");
  });

  it("rebuilds timeline rows as Goal: player", () => {
    const copy = goalHistoryCopyFromEntry(
      entry({
        title: "K. Mbappé",
        detail: "1st goalscorer - Paris Saint Germain 1-0 Aston Villa",
        dedupe: "goal:1:0",
        minute: 21,
      }),
      event
    );
    expect(copy.title).toBe("Goal: K. Mbappé!");
    expect(copy.scoringTeam).toBe("Paris Saint Germain");
  });

  it("strips a leftover team-in-title into Goal: player", () => {
    expect(
      goalHistoryCopyFromEntry(
        entry({
          title: "Goal: Paris Saint Germain · K. Mbappé",
          detail: "Paris Saint Germain 1-0 Aston Villa",
          dedupe: "goal:1:0",
          minute: 21,
        }),
        event
      ).title
    ).toBe("Goal: K. Mbappé!");
  });

  it("does not repeat Goal when the stored title is Goal · team", () => {
    const copy = goalHistoryCopyFromEntry(
      entry({
        title: "Goal · Paris Saint Germain",
        detail: "Paris Saint Germain 2-0 Aston Villa",
        dedupe: "demo-goal-1",
        minute: 41,
      }),
      { ...event, goals: JSON.stringify([{ minute: 41, side: "home" }]) }
    );
    expect(copy.title).toBe("Goal!");
    expect(copy.scoringSide).toBe("home");
  });
});

describe("formatGoalScorelineText", () => {
  it("brackets the home tally when home scored", () => {
    expect(
      formatGoalScorelineText({
        homeTeam: "Wolves",
        awayTeam: "Blackburn",
        homeScore: 2,
        awayScore: 1,
        scoringSide: "home",
      })
    ).toBe("Wolves [2] - 1 Blackburn");
  });

  it("brackets the away tally when away scored", () => {
    expect(
      formatGoalScorelineText({
        homeTeam: "Wolves",
        awayTeam: "Blackburn",
        homeScore: 1,
        awayScore: 1,
        scoringSide: "away",
      })
    ).toBe("Wolves 1 - [1] Blackburn");
  });

  it("emphasises only the bracketed tally, not the team name", () => {
    expect(
      formatGoalScorelineSegments({
        homeTeam: "Wolves",
        awayTeam: "Blackburn",
        homeScore: 2,
        awayScore: 1,
        scoringSide: "home",
      })
    ).toEqual([
      { text: "Wolves " },
      { text: "[2]", emphasize: true },
      { text: " - 1 Blackburn" },
    ]);
  });

  it("omits brackets when the scorer is unknown", () => {
    expect(
      formatGoalScorelineText({
        homeTeam: "Wolves",
        awayTeam: "Blackburn",
        homeScore: 2,
        awayScore: 2,
        scoringSide: null,
      })
    ).toBe("Wolves 2 - 2 Blackburn");
  });
});

describe("inferGoalScoringSidesFromEntries", () => {
  it("reads who scored from successive scorelines", () => {
    const eventsById = new Map([[4, event]]);
    const sides = inferGoalScoringSidesFromEntries(
      [
        {
          id: 1,
          kind: "goal",
          eventId: 4,
          minute: 21,
          detail: "Paris Saint Germain 1-0 Aston Villa",
        },
        {
          id: 2,
          kind: "goal",
          eventId: 4,
          minute: 45,
          detail: "Paris Saint Germain 1-1 Aston Villa",
        },
        {
          id: 3,
          kind: "goal",
          eventId: 4,
          minute: 66,
          detail: "Paris Saint Germain 2-1 Aston Villa",
        },
      ],
      eventsById
    );
    expect(sides.get(1)).toBe("home");
    expect(sides.get(2)).toBe("away");
    expect(sides.get(3)).toBe("home");
  });
});

describe("inferTwoUpTriggerGoalIds", () => {
  const hull = { homeTeam: "Hull City", awayTeam: "Manchester United" };

  it("marks the goal that first puts a side two ahead", () => {
    const eventsById = new Map([[9, hull]]);
    const triggers = inferTwoUpTriggerGoalIds(
      [
        {
          id: 1,
          kind: "goal",
          eventId: 9,
          minute: 12,
          detail: "Hull City 1-0 Manchester United",
        },
        {
          id: 2,
          kind: "goal",
          eventId: 9,
          minute: 38,
          detail: "Hull City 2-0 Manchester United",
        },
        {
          id: 3,
          kind: "goal",
          eventId: 9,
          minute: 70,
          detail: "Hull City 3-0 Manchester United",
        },
      ],
      eventsById
    );
    expect(triggers.get(1)).toBeUndefined();
    expect(triggers.get(2)).toEqual({
      side: "home",
      eventId: 9,
      team: "Hull City",
    });
    expect(triggers.get(3)).toBeUndefined();
  });

  it("can fire once per side in the same match", () => {
    const eventsById = new Map([[9, hull]]);
    const triggers = inferTwoUpTriggerGoalIds(
      [
        {
          id: 1,
          kind: "goal",
          eventId: 9,
          minute: 20,
          detail: "Hull City 2-0 Manchester United",
        },
        {
          id: 2,
          kind: "goal",
          eventId: 9,
          minute: 55,
          detail: "Hull City 2-2 Manchester United",
        },
        {
          id: 3,
          kind: "goal",
          eventId: 9,
          minute: 80,
          detail: "Hull City 2-4 Manchester United",
        },
      ],
      eventsById
    );
    expect(triggers.get(1)?.side).toBe("home");
    expect(triggers.get(2)).toBeUndefined();
    expect(triggers.get(3)?.side).toBe("away");
  });
});
