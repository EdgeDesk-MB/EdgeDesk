/**
 * "The bet wins IF …" trigger engine.
 *
 * A trigger is a plain-English condition typed by the user ("Harry Kane scores first",
 * "over 2.5 goals", "Mexico wins to nil and BTTS"). It is parsed into a structured
 * rule, shown back to the user for confirmation, and then evaluated against the live
 * match state on every tick. The evaluator is deliberately conservative: it only
 * returns "won" or "lost" once the outcome is IRREVERSIBLE (a first-goalscorer bet is
 * decided the moment the first goal goes in — not at full time), otherwise "pending".
 *
 * Parsing is deterministic keyword grammar — no network, no LLM — so the same text
 * always produces the same rule and the interpretation can be previewed instantly.
 */

export type Side = "home" | "away";

export interface GoalEvent {
  minute: number;
  side: Side;
  player?: string;
  /** Own goal — ignored by goalscorer markets, still counts for team/total goals */
  og?: boolean;
}

export interface TriggerContext {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  finished: boolean;
  goals: GoalEvent[];
}

export type TriggerRule =
  | { kind: "first_goalscorer"; player: string }
  | { kind: "last_goalscorer"; player: string }
  | { kind: "player_scores"; player: string; count: number }
  | { kind: "team_scores_first"; side: Side }
  | { kind: "team_goals"; side: Side; count: number }
  | { kind: "team_result"; result: Side | "draw" }
  | { kind: "win_to_nil"; side: Side }
  | { kind: "btts"; yes: boolean }
  | { kind: "total_goals"; dir: "over" | "under"; line: number }
  | { kind: "correct_score"; home: number; away: number }
  | { kind: "and"; rules: TriggerRule[] };

export interface ParsedTrigger {
  rule: TriggerRule;
  /** Human-readable readback, e.g. "First goalscorer — Harry Kane" */
  description: string;
}

export interface TriggerVerdict {
  status: "won" | "lost" | "pending";
  reason: string;
}

/* ------------------------------------------------------------------ */
/* Text utilities                                                      */
/* ------------------------------------------------------------------ */

const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const clean = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");

const normName = (s: string) =>
  stripAccents(s)
    .toLowerCase()
    .replace(/[.'’-]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Fuzzy player-name match: "kane" ~ "H. Kane" ~ "Harry Kane".
 * Surnames (last token) must agree; leading tokens may be initials.
 */
export function playerMatches(a: string, b: string): boolean {
  const ta = normName(a).split(" ").filter(Boolean);
  const tb = normName(b).split(" ").filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return false;
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false;
  // Compare remaining tokens right-aligned so "Saint-Maximin" ~ "A. Saint Maximin":
  // omitted leading tokens are fine, present ones must agree (initials allowed).
  const ra = ta.slice(0, -1);
  const rb = tb.slice(0, -1);
  for (let i = 1; i <= Math.min(ra.length, rb.length); i++) {
    const x = ra[ra.length - i];
    const y = rb[rb.length - i];
    if (x === y) continue;
    if (x.length === 1 && y.startsWith(x)) continue;
    if (y.length === 1 && x.startsWith(y)) continue;
    return false;
  }
  return true;
}

const normTeam = (s: string) => stripAccents(s).toLowerCase().replace(/[^a-z0-9]/g, "");

function teamLike(subject: string, team: string): boolean {
  const a = normTeam(subject);
  const b = normTeam(team);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Resolve a subject phrase to a side of the match, if it names one of the teams. */
function resolveSide(subject: string, ctx: { homeTeam: string; awayTeam: string }): Side | null {
  const s = subject.trim().toLowerCase();
  if (s === "home" || s === "the home team" || s === "home team") return "home";
  if (s === "away" || s === "the away team" || s === "away team") return "away";
  if (ctx.homeTeam && teamLike(subject, ctx.homeTeam)) return "home";
  if (ctx.awayTeam && teamLike(subject, ctx.awayTeam)) return "away";
  return null;
}

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
};

function parseCount(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return NUM_WORDS[s] ?? null;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

interface Teams {
  homeTeam: string;
  awayTeam: string;
}

const sideName = (side: Side, t: Teams) =>
  side === "home" ? t.homeTeam || "Home" : t.awayTeam || "Away";

function parseClause(raw: string, teams: Teams): ParsedTrigger | null {
  const c = clean(raw);
  if (!c) return null;

  let m: RegExpMatchArray | null;

  // Correct score: "2-1", "correct score 2:1", "score is 2-1"
  m = c.match(/^(?:(?:the )?(?:correct )?score (?:is |to be |ends? )?)?(\d+)\s*[-–:]\s*(\d+)$/i);
  if (m) {
    const home = parseInt(m[1], 10);
    const away = parseInt(m[2], 10);
    return {
      rule: { kind: "correct_score", home, away },
      description: `Correct score — ${home}-${away}`,
    };
  }

  // BTTS
  if (/^(?:btts(?: yes)?|both teams (?:to )?score)$/i.test(c)) {
    return { rule: { kind: "btts", yes: true }, description: "Both teams to score — yes" };
  }
  if (/^(?:btts no|no btts|both teams (?:do not|don'?t|not to) score)$/i.test(c)) {
    return { rule: { kind: "btts", yes: false }, description: "Both teams to score — no" };
  }

  // Over/under: "over 2.5 goals", "under 3.5", "3+ goals"
  m = c.match(/^(over|under)\s+(\d+(?:\.\d+)?)(?:\s+goals?)?$/i);
  if (m) {
    const dir = m[1].toLowerCase() as "over" | "under";
    let line = parseFloat(m[2]);
    if (Number.isInteger(line)) line = dir === "over" ? line - 0.5 : line + 0.5;
    return {
      rule: { kind: "total_goals", dir, line },
      description: `${dir === "over" ? "Over" : "Under"} ${line} goals`,
    };
  }
  m = c.match(/^(\d+)\s*\+\s*goals?$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return {
      rule: { kind: "total_goals", dir: "over", line: n - 0.5 },
      description: `Over ${n - 0.5} goals`,
    };
  }

  // Draw
  if (/^(?:(?:the )?draw|(?:match|game|it) ends? (?:in a |all )?(?:draw|level))$/i.test(c)) {
    return { rule: { kind: "team_result", result: "draw" }, description: "Result — draw" };
  }

  // Win to nil: "Mexico wins to nil"
  m = c.match(/^(.+?)\s+(?:to win|wins?)\s+to nil$/i);
  if (m) {
    const side = resolveSide(m[1], teams);
    if (side) {
      return {
        rule: { kind: "win_to_nil", side },
        description: `${sideName(side, teams)} to win to nil`,
      };
    }
    return null;
  }

  // Team win: "Mexico wins", "England to win the match"
  m = c.match(/^(.+?)\s+(?:to win|wins?)(?:\s+the\s+(?:match|game))?$/i);
  if (m) {
    const side = resolveSide(m[1], teams);
    if (side) {
      return {
        rule: { kind: "team_result", result: side },
        description: `Result — ${sideName(side, teams)} win`,
      };
    }
    return null;
  }

  // Scores first: "Harry Kane scores first", "Mexico scores the first goal",
  // "first goalscorer Harry Kane", "Harry Kane first goalscorer"
  const firstSubject =
    (m = c.match(/^(.+?)\s+(?:scores?|to score)\s+(?:the\s+)?first(?:\s+goal)?$/i)) ? m[1]
    : (m = c.match(/^(.+?)\s+(?:is\s+)?(?:the\s+)?first\s+goal\s*scorer$/i)) ? m[1]
    : (m = c.match(/^first\s+goal\s*scorer\s*[:\-–]?\s+(.+)$/i)) ? m[1]
    : null;
  if (firstSubject) {
    const side = resolveSide(firstSubject, teams);
    if (side) {
      return {
        rule: { kind: "team_scores_first", side },
        description: `${sideName(side, teams)} to score first`,
      };
    }
    return {
      rule: { kind: "first_goalscorer", player: firstSubject },
      description: `First goalscorer — ${firstSubject}`,
    };
  }

  // Scores last: "Harry Kane scores last", "last goalscorer Harry Kane"
  const lastSubject =
    (m = c.match(/^(.+?)\s+(?:scores?|to score)\s+(?:the\s+)?last(?:\s+goal)?$/i)) ? m[1]
    : (m = c.match(/^(.+?)\s+(?:is\s+)?(?:the\s+)?last\s+goal\s*scorer$/i)) ? m[1]
    : (m = c.match(/^last\s+goal\s*scorer\s*[:\-–]?\s+(.+)$/i)) ? m[1]
    : null;
  if (lastSubject && !resolveSide(lastSubject, teams)) {
    return {
      rule: { kind: "last_goalscorer", player: lastSubject },
      description: `Last goalscorer — ${lastSubject}`,
    };
  }

  // Brace / hat-trick: "Harry Kane scores a brace"
  m = c.match(/^(.+?)\s+(?:scores?|to score)\s+a?\s*(brace|hat[\s-]?trick)$/i);
  if (m) {
    const count = /brace/i.test(m[2]) ? 2 : 3;
    const player = m[1];
    if (!resolveSide(player, teams)) {
      return {
        rule: { kind: "player_scores", player, count },
        description: `${player} to score ${count === 2 ? "a brace (2+)" : "a hat-trick (3+)"}`,
      };
    }
  }

  // Scores N+ goals: "Harry Kane scores 2+", "Mexico scores 3 or more goals"
  m = c.match(/^(.+?)\s+(?:scores?|to score)\s+(\d+|one|two|three|four|five|six)\s*(?:\+|or more)?(?:\s+goals?)?$/i);
  if (m) {
    const count = parseCount(m[2]);
    if (count != null && count >= 1) {
      const side = resolveSide(m[1], teams);
      if (side) {
        return {
          rule: { kind: "team_goals", side, count },
          description: `${sideName(side, teams)} to score ${count}+ goals`,
        };
      }
      return {
        rule: { kind: "player_scores", player: m[1], count },
        description: `${m[1]} to score ${count}+ goal${count > 1 ? "s" : ""}`,
      };
    }
  }

  // Scores anytime: "Harry Kane scores", "Mexico scores", "Harry Kane to score anytime"
  m = c.match(/^(.+?)\s+(?:scores?|to score)(?:\s+(?:anytime|any time))?$/i);
  if (m) {
    const side = resolveSide(m[1], teams);
    if (side) {
      return {
        rule: { kind: "team_goals", side, count: 1 },
        description: `${sideName(side, teams)} to score`,
      };
    }
    return {
      rule: { kind: "player_scores", player: m[1], count: 1 },
      description: `Anytime goalscorer — ${m[1]}`,
    };
  }

  return null;
}

/**
 * Parse a full trigger phrase. Tries splitting on "and" first — every clause must
 * parse for the combo to stand — then falls back to the whole text, so team names
 * containing "and" (Brighton and Hove Albion) still work as a single clause.
 */
export function parseTrigger(text: string, teams: Teams): ParsedTrigger | null {
  const clauses = clean(text).split(/\s+(?:and|&|\+)\s+/i);
  if (clauses.length >= 2) {
    const parsed = clauses.map((cl) => parseClause(cl, teams));
    if (parsed.every((p) => p !== null)) {
      const ok = parsed as ParsedTrigger[];
      return {
        rule: { kind: "and", rules: ok.map((p) => p.rule) },
        description: ok.map((p) => p.description).join(" AND "),
      };
    }
  }
  return parseClause(text, teams);
}

/* ------------------------------------------------------------------ */
/* Evaluator                                                           */
/* ------------------------------------------------------------------ */

/** Goals that count for goalscorer markets (own goals excluded, industry standard). */
const scorerGoals = (ctx: TriggerContext) => ctx.goals.filter((g) => !g.og);

const goalLabel = (g: GoalEvent) => `${g.player ?? "unknown scorer"} (${g.minute}')`;

export function evaluateTrigger(rule: TriggerRule, ctx: TriggerContext): TriggerVerdict {
  const total = ctx.homeScore + ctx.awayScore;

  switch (rule.kind) {
    case "first_goalscorer": {
      const goals = scorerGoals(ctx);
      if (goals.length === 0) {
        return ctx.finished
          ? { status: "lost", reason: "No goalscorer" }
          : { status: "pending", reason: "No goals yet" };
      }
      const first = goals[0];
      if (!first.player) {
        return {
          status: "pending",
          reason: `First goal at ${first.minute}' — scorer not recorded, settle manually`,
        };
      }
      return playerMatches(rule.player, first.player)
        ? { status: "won", reason: `First goal: ${goalLabel(first)}` }
        : { status: "lost", reason: `First goal: ${goalLabel(first)}` };
    }

    case "last_goalscorer": {
      if (!ctx.finished) return { status: "pending", reason: "Decided at full time" };
      const goals = scorerGoals(ctx);
      if (goals.length === 0) return { status: "lost", reason: "No goalscorer" };
      const last = goals[goals.length - 1];
      if (!last.player) {
        return {
          status: "pending",
          reason: `Last goal at ${last.minute}' — scorer not recorded, settle manually`,
        };
      }
      return playerMatches(rule.player, last.player)
        ? { status: "won", reason: `Last goal: ${goalLabel(last)}` }
        : { status: "lost", reason: `Last goal: ${goalLabel(last)}` };
    }

    case "player_scores": {
      const goals = scorerGoals(ctx);
      const scored = goals.filter((g) => g.player && playerMatches(rule.player, g.player));
      if (scored.length >= rule.count) {
        return {
          status: "won",
          reason: scored.slice(0, rule.count).map(goalLabel).join(", "),
        };
      }
      if (!ctx.finished) {
        return {
          status: "pending",
          reason: `${scored.length}/${rule.count} goal${rule.count > 1 ? "s" : ""} so far`,
        };
      }
      // Finished — but if some scorers weren't recorded we can't be sure it lost
      if (goals.some((g) => !g.player)) {
        return { status: "pending", reason: "Some scorers not recorded — settle manually" };
      }
      return { status: "lost", reason: `Scored ${scored.length} of ${rule.count} needed` };
    }

    case "team_scores_first": {
      if (ctx.goals.length === 0) {
        return ctx.finished
          ? { status: "lost", reason: "No goals in the match" }
          : { status: "pending", reason: "No goals yet" };
      }
      const first = ctx.goals[0];
      return first.side === rule.side
        ? { status: "won", reason: `First goal was ${rule.side} (${first.minute}')` }
        : { status: "lost", reason: `First goal was ${first.side} (${first.minute}')` };
    }

    case "team_goals": {
      const goalsFor = rule.side === "home" ? ctx.homeScore : ctx.awayScore;
      if (goalsFor >= rule.count) {
        return { status: "won", reason: `${rule.side} on ${goalsFor} goal${goalsFor > 1 ? "s" : ""}` };
      }
      return ctx.finished
        ? { status: "lost", reason: `${rule.side} finished on ${goalsFor}` }
        : { status: "pending", reason: `${goalsFor}/${rule.count} goals so far` };
    }

    case "team_result": {
      if (!ctx.finished) return { status: "pending", reason: "Decided at full time" };
      const result =
        ctx.homeScore > ctx.awayScore ? "home" : ctx.awayScore > ctx.homeScore ? "away" : "draw";
      return result === rule.result
        ? { status: "won", reason: `FT ${ctx.homeScore}-${ctx.awayScore}` }
        : { status: "lost", reason: `FT ${ctx.homeScore}-${ctx.awayScore}` };
    }

    case "win_to_nil": {
      const conceded = rule.side === "home" ? ctx.awayScore : ctx.homeScore;
      if (conceded > 0) return { status: "lost", reason: "Clean sheet gone" };
      if (!ctx.finished) return { status: "pending", reason: "Clean sheet intact" };
      const scored = rule.side === "home" ? ctx.homeScore : ctx.awayScore;
      return scored > 0
        ? { status: "won", reason: `Won ${ctx.homeScore}-${ctx.awayScore} to nil` }
        : { status: "lost", reason: `FT ${ctx.homeScore}-${ctx.awayScore}` };
    }

    case "btts": {
      const both = ctx.homeScore > 0 && ctx.awayScore > 0;
      if (rule.yes) {
        if (both) return { status: "won", reason: "Both teams have scored" };
        return ctx.finished
          ? { status: "lost", reason: `FT ${ctx.homeScore}-${ctx.awayScore}` }
          : { status: "pending", reason: "Waiting on both teams scoring" };
      }
      if (both) return { status: "lost", reason: "Both teams have scored" };
      return ctx.finished
        ? { status: "won", reason: `FT ${ctx.homeScore}-${ctx.awayScore}` }
        : { status: "pending", reason: "Decided at full time" };
    }

    case "total_goals": {
      if (rule.dir === "over") {
        if (total > rule.line) return { status: "won", reason: `${total} goals` };
        return ctx.finished
          ? { status: "lost", reason: `Finished on ${total} goals` }
          : { status: "pending", reason: `${total} goals so far` };
      }
      if (total > rule.line) return { status: "lost", reason: `${total} goals already` };
      return ctx.finished
        ? { status: "won", reason: `Finished on ${total} goals` }
        : { status: "pending", reason: `${total} goals so far` };
    }

    case "correct_score": {
      if (ctx.finished) {
        return ctx.homeScore === rule.home && ctx.awayScore === rule.away
          ? { status: "won", reason: `FT ${ctx.homeScore}-${ctx.awayScore}` }
          : { status: "lost", reason: `FT ${ctx.homeScore}-${ctx.awayScore}` };
      }
      // Scores only go up — once either side passes the target the bet is dead
      if (ctx.homeScore > rule.home || ctx.awayScore > rule.away) {
        return { status: "lost", reason: `Score already ${ctx.homeScore}-${ctx.awayScore}` };
      }
      return { status: "pending", reason: `Currently ${ctx.homeScore}-${ctx.awayScore}` };
    }

    case "and": {
      const verdicts = rule.rules.map((r) => evaluateTrigger(r, ctx));
      const lost = verdicts.find((v) => v.status === "lost");
      if (lost) return { status: "lost", reason: lost.reason };
      if (verdicts.every((v) => v.status === "won")) {
        return { status: "won", reason: verdicts.map((v) => v.reason).join(" · ") };
      }
      const waiting = verdicts.filter((v) => v.status === "pending");
      return { status: "pending", reason: waiting.map((v) => v.reason).join(" · ") };
    }
  }
}

/**
 * "If the match ended right now" verdict — used for provisional live P&L on
 * pending trigger bets. Returns null when even a finished match wouldn't
 * settle it (e.g. scorers not recorded).
 */
export function triggerIfEndedNow(rule: TriggerRule, ctx: TriggerContext): boolean | null {
  const v = evaluateTrigger(rule, { ...ctx, finished: true });
  return v.status === "pending" ? null : v.status === "won";
}
