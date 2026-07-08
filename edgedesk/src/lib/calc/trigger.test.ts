import { describe, expect, it } from "vitest";
import {
  evaluateTrigger,
  parseTrigger,
  playerMatches,
  triggerIfEndedNow,
  type GoalEvent,
  type TriggerContext,
  type TriggerRule,
} from "./trigger";

const teams = { homeTeam: "Mexico", awayTeam: "England" };

const ctx = (
  goals: GoalEvent[],
  opts: Partial<TriggerContext> = {}
): TriggerContext => ({
  ...teams,
  homeScore: goals.filter((g) => g.side === "home").length,
  awayScore: goals.filter((g) => g.side === "away").length,
  finished: false,
  goals,
  ...opts,
});

const kane = (minute: number): GoalEvent => ({ minute, side: "away", player: "H. Kane" });
const mex = (minute: number, player = "R. Jiménez"): GoalEvent => ({ minute, side: "home", player });

describe("playerMatches", () => {
  it("matches surname-only, initials and full names", () => {
    expect(playerMatches("Harry Kane", "H. Kane")).toBe(true);
    expect(playerMatches("kane", "Harry Kane")).toBe(true);
    expect(playerMatches("Harry Kane", "Harry Kane")).toBe(true);
    expect(playerMatches("H Kane", "Harry Kane")).toBe(true);
  });
  it("handles accents and punctuation", () => {
    expect(playerMatches("Raul Jimenez", "R. Jiménez")).toBe(true);
    expect(playerMatches("Saint-Maximin", "A. Saint Maximin")).toBe(true);
  });
  it("rejects different players", () => {
    expect(playerMatches("Harry Kane", "M. Rashford")).toBe(false);
    expect(playerMatches("Harry Maguire", "Harry Kane")).toBe(false);
    expect(playerMatches("Michail Antonio", "Marcus Antonio")).toBe(false);
  });
});

describe("parseTrigger", () => {
  const parse = (t: string) => parseTrigger(t, teams);

  it("first goalscorer — the headline example", () => {
    expect(parse("Harry Kane scores first")?.rule).toEqual({
      kind: "first_goalscorer",
      player: "Harry Kane",
    });
    expect(parse("Harry Kane to score the first goal")?.rule.kind).toBe("first_goalscorer");
    expect(parse("first goalscorer Harry Kane")?.rule.kind).toBe("first_goalscorer");
    expect(parse("Harry Kane first goalscorer")?.rule.kind).toBe("first_goalscorer");
  });

  it("team scores first (subject is a team, not a player)", () => {
    expect(parse("Mexico scores first")?.rule).toEqual({ kind: "team_scores_first", side: "home" });
    expect(parse("England scores first")?.rule).toEqual({ kind: "team_scores_first", side: "away" });
  });

  it("anytime / multi-goal scorer", () => {
    expect(parse("Harry Kane scores")?.rule).toEqual({
      kind: "player_scores",
      player: "Harry Kane",
      count: 1,
    });
    expect(parse("Harry Kane scores anytime")?.rule.kind).toBe("player_scores");
    expect(parse("Harry Kane scores 2+")?.rule).toEqual({
      kind: "player_scores",
      player: "Harry Kane",
      count: 2,
    });
    expect(parse("Harry Kane scores a brace")?.rule).toEqual({
      kind: "player_scores",
      player: "Harry Kane",
      count: 2,
    });
    expect(parse("Harry Kane scores a hat-trick")?.rule).toEqual({
      kind: "player_scores",
      player: "Harry Kane",
      count: 3,
    });
  });

  it("last goalscorer", () => {
    expect(parse("Harry Kane scores last")?.rule.kind).toBe("last_goalscorer");
    expect(parse("last goalscorer Harry Kane")?.rule.kind).toBe("last_goalscorer");
  });

  it("team markets", () => {
    expect(parse("Mexico wins")?.rule).toEqual({ kind: "team_result", result: "home" });
    expect(parse("England to win")?.rule).toEqual({ kind: "team_result", result: "away" });
    expect(parse("draw")?.rule).toEqual({ kind: "team_result", result: "draw" });
    expect(parse("Mexico wins to nil")?.rule).toEqual({ kind: "win_to_nil", side: "home" });
    expect(parse("England scores 2 or more goals")?.rule).toEqual({
      kind: "team_goals",
      side: "away",
      count: 2,
    });
  });

  it("totals, btts, correct score", () => {
    expect(parse("over 2.5 goals")?.rule).toEqual({ kind: "total_goals", dir: "over", line: 2.5 });
    expect(parse("under 3.5")?.rule).toEqual({ kind: "total_goals", dir: "under", line: 3.5 });
    expect(parse("over 2 goals")?.rule).toEqual({ kind: "total_goals", dir: "over", line: 1.5 });
    expect(parse("3+ goals")?.rule).toEqual({ kind: "total_goals", dir: "over", line: 2.5 });
    expect(parse("both teams to score")?.rule).toEqual({ kind: "btts", yes: true });
    expect(parse("BTTS")?.rule).toEqual({ kind: "btts", yes: true });
    expect(parse("correct score 2-1")?.rule).toEqual({ kind: "correct_score", home: 2, away: 1 });
    expect(parse("2-1")?.rule).toEqual({ kind: "correct_score", home: 2, away: 1 });
  });

  it("AND combinations", () => {
    const p = parse("Harry Kane scores first and England wins");
    expect(p?.rule.kind).toBe("and");
    const rule = p!.rule as Extract<TriggerRule, { kind: "and" }>;
    expect(rule.rules).toHaveLength(2);
    expect(rule.rules[0].kind).toBe("first_goalscorer");
    expect(rule.rules[1]).toEqual({ kind: "team_result", result: "away" });
    expect(p?.description).toContain("AND");
  });

  it("returns null for gibberish", () => {
    expect(parse("the vibes are good")).toBeNull();
    expect(parse("")).toBeNull();
  });
});

describe("evaluateTrigger — real-time, irreversible settlement", () => {
  const fgsKane: TriggerRule = { kind: "first_goalscorer", player: "Harry Kane" };

  it("FGS pending before any goal", () => {
    expect(evaluateTrigger(fgsKane, ctx([])).status).toBe("pending");
  });

  it("FGS wins THE MOMENT Kane scores first — mid-match", () => {
    const v = evaluateTrigger(fgsKane, ctx([kane(23)]));
    expect(v.status).toBe("won");
    expect(v.reason).toContain("Kane");
  });

  it("FGS loses the moment someone else scores first, even if Kane scores later", () => {
    expect(evaluateTrigger(fgsKane, ctx([mex(10)])).status).toBe("lost");
    expect(evaluateTrigger(fgsKane, ctx([mex(10), kane(50)])).status).toBe("lost");
  });

  it("FGS loses at FT with no goals", () => {
    expect(evaluateTrigger(fgsKane, ctx([], { finished: true })).status).toBe("lost");
  });

  it("FGS ignores own goals", () => {
    const og: GoalEvent = { minute: 5, side: "away", player: "J. Sánchez", og: true };
    expect(evaluateTrigger(fgsKane, ctx([og])).status).toBe("pending");
    expect(evaluateTrigger(fgsKane, ctx([og, kane(30)])).status).toBe("won");
  });

  it("FGS stays pending when first scorer is unrecorded (manual event)", () => {
    const anon: GoalEvent = { minute: 12, side: "home" };
    expect(evaluateTrigger(fgsKane, ctx([anon])).status).toBe("pending");
  });

  it("anytime scorer wins mid-match, brace counts correctly", () => {
    const anytime: TriggerRule = { kind: "player_scores", player: "Kane", count: 1 };
    const brace: TriggerRule = { kind: "player_scores", player: "Kane", count: 2 };
    expect(evaluateTrigger(anytime, ctx([mex(10), kane(40)])).status).toBe("won");
    expect(evaluateTrigger(brace, ctx([kane(40)])).status).toBe("pending");
    expect(evaluateTrigger(brace, ctx([kane(40), kane(70)])).status).toBe("won");
    expect(evaluateTrigger(brace, ctx([kane(40)], { finished: true })).status).toBe("lost");
  });

  it("last goalscorer only settles at FT", () => {
    const lgs: TriggerRule = { kind: "last_goalscorer", player: "Kane" };
    expect(evaluateTrigger(lgs, ctx([kane(80)])).status).toBe("pending");
    expect(evaluateTrigger(lgs, ctx([mex(10), kane(80)], { finished: true })).status).toBe("won");
    expect(evaluateTrigger(lgs, ctx([kane(10), mex(80)], { finished: true })).status).toBe("lost");
  });

  it("win to nil dies instantly when the clean sheet goes", () => {
    const rule: TriggerRule = { kind: "win_to_nil", side: "away" };
    expect(evaluateTrigger(rule, ctx([kane(10)])).status).toBe("pending");
    expect(evaluateTrigger(rule, ctx([kane(10), mex(30)])).status).toBe("lost");
    expect(evaluateTrigger(rule, ctx([kane(10)], { finished: true })).status).toBe("won");
  });

  it("over wins mid-match once the line is passed; under waits for FT", () => {
    const over: TriggerRule = { kind: "total_goals", dir: "over", line: 2.5 };
    const under: TriggerRule = { kind: "total_goals", dir: "under", line: 2.5 };
    const three = [mex(10), kane(20), mex(30)];
    expect(evaluateTrigger(over, ctx(three)).status).toBe("won");
    expect(evaluateTrigger(under, ctx(three)).status).toBe("lost");
    expect(evaluateTrigger(under, ctx([mex(10)])).status).toBe("pending");
    expect(evaluateTrigger(under, ctx([mex(10)], { finished: true })).status).toBe("won");
  });

  it("btts yes wins live; correct score dies when overtaken", () => {
    const btts: TriggerRule = { kind: "btts", yes: true };
    expect(evaluateTrigger(btts, ctx([mex(10), kane(20)])).status).toBe("won");
    const cs: TriggerRule = { kind: "correct_score", home: 1, away: 0 };
    expect(evaluateTrigger(cs, ctx([mex(10)])).status).toBe("pending");
    expect(evaluateTrigger(cs, ctx([mex(10), mex(30)])).status).toBe("lost");
    expect(evaluateTrigger(cs, ctx([mex(10)], { finished: true })).status).toBe("won");
  });

  it("AND — loses fast, wins only when every leg is in", () => {
    const rule: TriggerRule = {
      kind: "and",
      rules: [
        { kind: "first_goalscorer", player: "Kane" },
        { kind: "team_result", result: "away" },
      ],
    };
    expect(evaluateTrigger(rule, ctx([mex(5)])).status).toBe("lost");
    expect(evaluateTrigger(rule, ctx([kane(5)])).status).toBe("pending");
    expect(evaluateTrigger(rule, ctx([kane(5)], { finished: true })).status).toBe("won");
    expect(evaluateTrigger(rule, ctx([kane(5), mex(50), mex(60)], { finished: true })).status).toBe(
      "lost"
    );
  });

  it("triggerIfEndedNow gives the provisional view", () => {
    const fgs: TriggerRule = { kind: "first_goalscorer", player: "Kane" };
    expect(triggerIfEndedNow(fgs, ctx([]))).toBe(false); // ends now → no goalscorer → lost
    expect(triggerIfEndedNow(fgs, ctx([kane(10)]))).toBe(true);
    const anon: GoalEvent = { minute: 12, side: "home" };
    expect(triggerIfEndedNow(fgs, ctx([anon]))).toBeNull(); // unknowable
  });
});
