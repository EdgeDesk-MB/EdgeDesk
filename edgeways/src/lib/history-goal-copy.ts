import type { EventRow, HistoryRow } from "@/lib/db/schema";
import type { GoalEvent, Side } from "@/lib/calc/trigger";

export interface HistoryTitlePart {
  text: string;
  emphasize?: boolean;
}

export interface GoalHistoryCopy {
  title: string;
  parts: HistoryTitlePart[];
  scoringSide: Side | null;
  scoringTeam: string | null;
}

export interface GoalScorelineParts {
  flags?: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  scoringSide: Side | null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Who scored this goal, given the score before and after. Null if the delta is not exactly one goal. */
export function inferScoringSideFromScoreDelta(
  prevHome: number,
  prevAway: number,
  nextHome: number,
  nextAway: number
): Side | null {
  const dHome = nextHome - prevHome;
  const dAway = nextAway - prevAway;
  if (dHome === 1 && dAway === 0) return "home";
  if (dHome === 0 && dAway === 1) return "away";
  return null;
}

/**
 * Best previous `score:{eventId}:{h}-{a}` row below the current score.
 * Used when the scorer timeline is missing and we only have incremental score ticks.
 */
export function previousScorelineFromDedupe(
  dedupes: string[],
  eventId: number,
  currentHome: number,
  currentAway: number
): { home: number; away: number } | null {
  const prefix = `score:${eventId}:`;
  const currentTotal = currentHome + currentAway;
  let best: { home: number; away: number; total: number } | null = null;
  for (const dedupe of dedupes) {
    if (!dedupe.startsWith(prefix)) continue;
    const match = dedupe.slice(prefix.length).match(/^(\d+)-(\d+)$/);
    if (!match) continue;
    const home = Number(match[1]);
    const away = Number(match[2]);
    const total = home + away;
    if (total >= currentTotal) continue;
    if (!best || total > best.total) best = { home, away, total };
  }
  return best ? { home: best.home, away: best.away } : null;
}

export function inferScoringSide(opts: {
  knownHome: number;
  knownAway: number;
  currentHome: number;
  currentAway: number;
  previousScore?: { home: number; away: number } | null;
}): Side | null {
  let prevHome = opts.knownHome;
  let prevAway = opts.knownAway;
  if (opts.previousScore) {
    const prevTotal = opts.previousScore.home + opts.previousScore.away;
    if (prevTotal > prevHome + prevAway && prevTotal < opts.currentHome + opts.currentAway) {
      prevHome = opts.previousScore.home;
      prevAway = opts.previousScore.away;
    }
  }
  return inferScoringSideFromScoreDelta(prevHome, prevAway, opts.currentHome, opts.currentAway);
}

/** n-0 is home, 0-n is away. Anything with both sides on the board needs a previous score. */
export function inferScoringSideFromScoreline(
  homeScore: number,
  awayScore: number
): Side | null {
  if (homeScore > 0 && awayScore === 0) return "home";
  if (awayScore > 0 && homeScore === 0) return "away";
  return null;
}

export function parseGoalHistoryScoreline(
  detail: string | null | undefined,
  event?: Pick<EventRow, "homeTeam" | "awayTeam">
): Omit<GoalScorelineParts, "scoringSide"> | null {
  if (!detail) return null;
  if (event) {
    const match = detail.match(
      new RegExp(
        `^(?:(.*?) - )?${escapeRegExp(event.homeTeam)} (\\d+)-(\\d+) ${escapeRegExp(event.awayTeam)}$`
      )
    );
    if (match) {
      return {
        flags: match[1] || undefined,
        homeTeam: event.homeTeam,
        homeScore: Number(match[2]),
        awayScore: Number(match[3]),
        awayTeam: event.awayTeam,
      };
    }
  }
  const match = detail.match(/^(?:(.*?) - )?(.+) (\d+)-(\d+) (.+)$/);
  if (!match) return null;
  return {
    flags: match[1] || undefined,
    homeTeam: match[2],
    homeScore: Number(match[3]),
    awayScore: Number(match[4]),
    awayTeam: match[5],
  };
}

export function formatGoalHistoryCopy(input: {
  side: Side | null;
  player?: string | null;
  og?: boolean;
  homeTeam: string;
  awayTeam: string;
}): GoalHistoryCopy {
  const scoringTeam =
    input.side === "home" ? input.homeTeam : input.side === "away" ? input.awayTeam : null;
  const player = input.player?.trim() || null;
  const prefix = input.og ? "Own goal" : "Goal!";

  // Title names the scorer when we have one. The scoring team is emphasised
  // on the scoreline, not repeated on the first line.
  if (player) {
    const title = input.og ? `Own goal: ${player}` : `Goal: ${player}!`;
    return {
      title,
      parts: [{ text: title }],
      scoringSide: input.side,
      scoringTeam,
    };
  }
  return {
    title: prefix,
    parts: [{ text: prefix }],
    scoringSide: input.side,
    scoringTeam,
  };
}

function parseGoalsJson(raw: string | null | undefined): GoalEvent[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GoalEvent[]) : [];
  } catch {
    return [];
  }
}

export function matchTimelineGoal(
  entry: Pick<HistoryRow, "dedupe" | "minute" | "title">,
  event: Pick<EventRow, "goals">
): GoalEvent | undefined {
  const goals = parseGoalsJson(event.goals);
  if (goals.length === 0) return undefined;

  const indexed = entry.dedupe.match(/^goal:\d+:(\d+)$/);
  if (indexed) {
    const goal = goals[Number(indexed[1])];
    if (goal) return goal;
  }

  const atMinute =
    entry.minute != null ? goals.filter((goal) => goal.minute === entry.minute) : [];
  if (atMinute.length === 1) return atMinute[0];

  const byPlayer = goals.find(
    (goal) => goal.player && (entry.title === goal.player || entry.title.includes(goal.player))
  );
  if (byPlayer) return byPlayer;

  return atMinute[0];
}

function parseStoredGoalTitle(
  title: string,
  homeTeam: string,
  awayTeam: string
): { side: Side | null; player: string | null; og: boolean } {
  const og = title === "Own goal" || title.startsWith("Own goal:");
  if (title === "Goal" || title === "Goal!" || title === "Own goal") {
    return { side: null, player: null, og };
  }

  // Leftover "Goal · Arsenal" / "Goal - Arsenal" (team, no player) used to
  // become player "Goal · Arsenal" and render as "Goal: Goal · Arsenal!".
  const teamOnly = title.match(/^(?:Goal!?|Own goal)\s*[·\-–:]\s*(.+)$/);
  if (teamOnly) {
    const name = teamOnly[1].replace(/!$/, "").trim();
    if (name === homeTeam) return { side: "home", player: null, og };
    if (name === awayTeam) return { side: "away", player: null, og };
  }

  const prefixed = title.match(/^(?:Goal!?|Own goal):\s*(.*)$/);
  const rest = prefixed ? prefixed[1].replace(/!$/, "") : title;
  if (!rest) return { side: null, player: null, og };

  const separator = rest.indexOf(" · ");
  if (separator >= 0) {
    const left = rest.slice(0, separator);
    const right = rest.slice(separator + 3);
    if (left === homeTeam) return { side: "home", player: right || null, og };
    if (left === awayTeam) return { side: "away", player: right || null, og };
  }

  if (rest === homeTeam || title === homeTeam) return { side: "home", player: null, og };
  if (rest === awayTeam || title === awayTeam) return { side: "away", player: null, og };

  if (!prefixed) return { side: null, player: rest, og };
  return { side: null, player: rest, og };
}

function inferSideFromDedupe(dedupe: string): Side | null {
  const match = dedupe.match(/^score:\d+:(\d+)-(\d+)$/);
  if (!match) return null;
  return inferScoringSideFromScoreline(Number(match[1]), Number(match[2]));
}

export function goalHistoryCopyFromEntry(
  entry: Pick<HistoryRow, "kind" | "title" | "detail" | "dedupe" | "minute">,
  event: Pick<EventRow, "homeTeam" | "awayTeam" | "goals"> | undefined
): GoalHistoryCopy {
  if (entry.kind !== "goal") {
    return {
      title: entry.title,
      parts: [{ text: entry.title }],
      scoringSide: null,
      scoringTeam: null,
    };
  }
  if (!event) {
    if (entry.title === "Goal" || entry.title === "Goal!" || entry.title === "Own goal") {
      return formatGoalHistoryCopy({
        side: null,
        og: entry.title === "Own goal",
        homeTeam: "",
        awayTeam: "",
      });
    }
    return {
      title: entry.title,
      parts: [{ text: entry.title }],
      scoringSide: null,
      scoringTeam: null,
    };
  }

  const matched = matchTimelineGoal(entry, event);
  const stored = parseStoredGoalTitle(entry.title, event.homeTeam, event.awayTeam);
  const scoreline = parseGoalHistoryScoreline(entry.detail, event);
  const fromScoreline = scoreline
    ? inferScoringSideFromScoreline(scoreline.homeScore, scoreline.awayScore)
    : null;
  const og =
    matched?.og === true ||
    stored.og ||
    scoreline?.flags?.toLowerCase().includes("own goal") === true;

  return formatGoalHistoryCopy({
    side: matched?.side ?? stored.side ?? fromScoreline ?? inferSideFromDedupe(entry.dedupe),
    player: matched?.player ?? stored.player,
    og,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
  });
}

export function goalHistoryScorelineParts(
  entry: Pick<HistoryRow, "detail">,
  event: Pick<EventRow, "homeTeam" | "awayTeam"> | undefined,
  scoringSide: Side | null
): GoalScorelineParts | null {
  const parsed = parseGoalHistoryScoreline(entry.detail, event);
  if (!parsed) return null;
  return { ...parsed, scoringSide };
}

/**
 * Goal scoreline with the scorer's new tally in brackets:
 * `Wolves [2] - 1 Blackburn` when home just made it 2-1.
 */
export function formatGoalScorelineSegments(parts: GoalScorelineParts): HistoryTitlePart[] {
  if (parts.scoringSide === "home") {
    return [
      { text: `${parts.homeTeam} ` },
      { text: `[${parts.homeScore}]`, emphasize: true },
      { text: ` - ${parts.awayScore} ${parts.awayTeam}` },
    ];
  }
  if (parts.scoringSide === "away") {
    return [
      { text: `${parts.homeTeam} ${parts.homeScore} - ` },
      { text: `[${parts.awayScore}]`, emphasize: true },
      { text: ` ${parts.awayTeam}` },
    ];
  }
  return [
    {
      text: `${parts.homeTeam} ${parts.homeScore} - ${parts.awayScore} ${parts.awayTeam}`,
    },
  ];
}

export function formatGoalScorelineText(parts: GoalScorelineParts): string {
  return formatGoalScorelineSegments(parts)
    .map((part) => part.text)
    .join("");
}

type GoalWalkEntry = Pick<HistoryRow, "id" | "kind" | "eventId" | "detail" | "minute">;

function groupOrderedGoalsByEvent(
  entries: GoalWalkEntry[],
  eventsById: Map<number, Pick<EventRow, "homeTeam" | "awayTeam">>
): Array<{
  eventId: number;
  event: Pick<EventRow, "homeTeam" | "awayTeam"> | undefined;
  ordered: GoalWalkEntry[];
}> {
  const byEvent = new Map<number, GoalWalkEntry[]>();
  for (const entry of entries) {
    if (entry.kind !== "goal" || entry.eventId == null) continue;
    const list = byEvent.get(entry.eventId) ?? [];
    list.push(entry);
    byEvent.set(entry.eventId, list);
  }

  return [...byEvent.entries()].map(([eventId, list]) => {
    const event = eventsById.get(eventId);
    const ordered = [...list].sort((a, b) => {
      const scoreA = parseGoalHistoryScoreline(a.detail, event);
      const scoreB = parseGoalHistoryScoreline(b.detail, event);
      const totalA = scoreA ? scoreA.homeScore + scoreA.awayScore : 0;
      const totalB = scoreB ? scoreB.homeScore + scoreB.awayScore : 0;
      if (totalA !== totalB) return totalA - totalB;
      const minuteA = a.minute ?? 0;
      const minuteB = b.minute ?? 0;
      if (minuteA !== minuteB) return minuteA - minuteB;
      return a.id - b.id;
    });
    return { eventId, event, ordered };
  });
}

/**
 * Walk goal rows per match in score order so a 1-1 can inherit "away scored"
 * from the previous 1-0 tick. Used when the scorer timeline was never fetched.
 */
export function inferGoalScoringSidesFromEntries(
  entries: GoalWalkEntry[],
  eventsById: Map<number, Pick<EventRow, "homeTeam" | "awayTeam">>
): Map<number, Side> {
  const out = new Map<number, Side>();
  for (const { event, ordered } of groupOrderedGoalsByEvent(entries, eventsById)) {
    let prevHome = 0;
    let prevAway = 0;
    for (const entry of ordered) {
      const score = parseGoalHistoryScoreline(entry.detail, event);
      if (!score) continue;
      const side =
        inferScoringSideFromScoreDelta(prevHome, prevAway, score.homeScore, score.awayScore) ??
        inferScoringSideFromScoreline(score.homeScore, score.awayScore);
      if (side) out.set(entry.id, side);
      prevHome = score.homeScore;
      prevAway = score.awayScore;
    }
  }
  return out;
}

export interface HistoryTwoUpTrigger {
  side: Side;
  eventId: number;
  team: string | null;
}

/**
 * First goal that puts a side two ahead. Later 3-1 / 4-2 ticks do not re-fire.
 */
export function inferTwoUpTriggerGoalIds(
  entries: GoalWalkEntry[],
  eventsById: Map<number, Pick<EventRow, "homeTeam" | "awayTeam">>
): Map<number, HistoryTwoUpTrigger> {
  const out = new Map<number, HistoryTwoUpTrigger>();
  for (const { eventId, event, ordered } of groupOrderedGoalsByEvent(entries, eventsById)) {
    let prevLead = 0;
    let homeTriggered = false;
    let awayTriggered = false;
    for (const entry of ordered) {
      const score = parseGoalHistoryScoreline(entry.detail, event);
      if (!score) continue;
      const lead = score.homeScore - score.awayScore;
      if (!homeTriggered && lead >= 2 && prevLead < 2) {
        out.set(entry.id, {
          side: "home",
          eventId,
          team: event?.homeTeam ?? score.homeTeam,
        });
        homeTriggered = true;
      } else if (!awayTriggered && lead <= -2 && prevLead > -2) {
        out.set(entry.id, {
          side: "away",
          eventId,
          team: event?.awayTeam ?? score.awayTeam,
        });
        awayTriggered = true;
      }
      prevLead = lead;
    }
  }
  return out;
}
