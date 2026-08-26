/**
 * Home → Live → Events: Betfair match-odds backs for a live football card.
 * MODEL probabilities stay on Positions / 2UP — this file is display mapping only.
 */
import { canonicalizeTeam, footballTeamsMatch } from "@/lib/services/exchange/football-match";

export type LiveBackRunner = "home" | "draw" | "away";

export type LiveMatchBackOdds = {
  homeBack?: number;
  drawBack?: number;
  awayBack?: number;
};

export type LiveMatchBackTag = {
  runner: LiveBackRunner;
  label: string;
  odds: number;
  highlighted: boolean;
};

const SHORT_LABEL: Record<string, string> = {
  "manchester united": "United",
  "manchester city": "Man City",
  "nottingham forest": "Forest",
  "crystal palace": "Palace",
  tottenham: "Spurs",
  wolverhampton: "Wolves",
  "sheffield united": "Sheff Utd",
  "sheffield wednesday": "Sheff Wed",
  "queens park rangers": "QPR",
  "west bromwich": "West Brom",
  "west ham": "West Ham",
  "aston villa": "Villa",
  hull: "Hull",
};

function titleCaseWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Compact team name for a back tag: Hull, United, Palace. */
export function shortFootballTeamLabel(name: string): string {
  const canon = canonicalizeTeam(name);
  if (!canon) return name.trim();
  return SHORT_LABEL[canon] ?? titleCaseWords(canon);
}

export function betHighlightsBackRunner(
  selection: string,
  runner: LiveBackRunner,
  homeTeam: string,
  awayTeam: string
): boolean {
  const raw = selection.trim();
  if (!raw) return false;
  const s = raw.toLowerCase();
  if (runner === "home" && (s === "home" || s === "h")) return true;
  if (runner === "away" && (s === "away" || s === "a")) return true;
  if (runner === "draw" && (s === "draw" || s === "d" || s === "x" || s === "the draw")) {
    return true;
  }
  if (runner === "home") {
    return (
      footballTeamsMatch(raw, homeTeam) ||
      shortFootballTeamLabel(homeTeam).toLowerCase() === s
    );
  }
  if (runner === "away") {
    return (
      footballTeamsMatch(raw, awayTeam) ||
      shortFootballTeamLabel(awayTeam).toLowerCase() === s
    );
  }
  return false;
}

function validBack(odds: number | undefined): odds is number {
  return typeof odds === "number" && Number.isFinite(odds) && odds > 1;
}

/** True when two backs differ by at least a displayed 0.01 tick. */
export function liveBacksMoved(a: number, b: number): boolean {
  return Math.abs(a - b) >= 0.005;
}

/** Green flash when the back lengthens, red when it shortens. */
export function liveOddsFlash(prev: number | undefined, next: number): "up" | "down" | null {
  if (prev == null || !liveBacksMoved(prev, next)) return null;
  return next > prev ? "up" : "down";
}

export type LiveMatchBacksEntry = {
  odds: LiveMatchBackOdds;
  suspended: boolean;
  /** Increments when a live Betfair book quote arrives, even if backs are unchanged. */
  quoteSeq?: number;
};

/** Advance only when we actually fetched live backs, not on hold/empty/suspend. */
export function nextLiveMatchBackQuoteSeq(
  previous: number | undefined,
  poll: { kind: LiveMatchBackPollKind; odds: LiveMatchBackOdds }
): number {
  const seq = previous ?? 0;
  if (poll.kind === "live" && hasLiveMatchBacks(poll.odds)) return seq + 1;
  return seq;
}

export type LiveMatchBackPollKind = "live" | "suspended" | "closed" | "empty" | "hold";

function hasLiveMatchBacks(odds: LiveMatchBackOdds): boolean {
  return validBack(odds.homeBack) || validBack(odds.drawBack) || validBack(odds.awayBack);
}

/**
 * Keep the last printed backs when Betfair parks the book.
 * Closed clears. A network blip holds the previous row without claiming suspend.
 */
export function mergeLiveMatchBackPoll(
  previous: LiveMatchBacksEntry | undefined,
  poll: { kind: LiveMatchBackPollKind; odds: LiveMatchBackOdds }
): LiveMatchBacksEntry | null {
  if (poll.kind === "closed") return null;
  if (poll.kind === "hold") return previous ?? null;

  if (poll.kind === "live" && hasLiveMatchBacks(poll.odds)) {
    return { odds: poll.odds, suspended: false };
  }

  if (poll.kind === "suspended") {
    const odds = hasLiveMatchBacks(poll.odds) ? poll.odds : (previous?.odds ?? {});
    return { odds, suspended: true };
  }

  if (previous && hasLiveMatchBacks(previous.odds)) {
    return { odds: previous.odds, suspended: true };
  }
  return null;
}

export function liveMatchBackTags(input: {
  homeTeam: string;
  awayTeam: string;
  odds: LiveMatchBackOdds;
  selections?: Iterable<string>;
}): LiveMatchBackTag[] | null {
  const selections = [...(input.selections ?? [])];
  const highlighted = (runner: LiveBackRunner) =>
    selections.some((sel) =>
      betHighlightsBackRunner(sel, runner, input.homeTeam, input.awayTeam)
    );

  const tags: LiveMatchBackTag[] = [];
  if (validBack(input.odds.homeBack)) {
    tags.push({
      runner: "home",
      label: shortFootballTeamLabel(input.homeTeam),
      odds: input.odds.homeBack,
      highlighted: highlighted("home"),
    });
  }
  if (validBack(input.odds.drawBack)) {
    tags.push({
      runner: "draw",
      label: "Draw",
      odds: input.odds.drawBack,
      highlighted: highlighted("draw"),
    });
  }
  if (validBack(input.odds.awayBack)) {
    tags.push({
      runner: "away",
      label: shortFootballTeamLabel(input.awayTeam),
      odds: input.odds.awayBack,
      highlighted: highlighted("away"),
    });
  }
  return tags.length > 0 ? tags : null;
}
