import type { AccaLegRow, AccaRunRow, BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import { isAccaDeskBack, isAccaDeskLay } from "@/lib/bets/acca-desk-bets";
import { isLockInLoggedBet } from "@/lib/bets/lock-in-bets";
import { accaFoldName } from "@/lib/bets/acca-fold-name";
import { isBetBuilderDeskLay } from "@/lib/bets/bet-builder-desk-bets";
import { formatGbp } from "@/lib/format-money";
import { formatPromoTooltip } from "@/lib/bet-outcomes";
import { formatEventTitle, racingVenueLabel } from "@/lib/events";
import {
  FREE_BET_EARNED_PHRASE,
  FREE_BET_WON_PHRASE,
  titleHasFreeBetAwardPhrase,
} from "@/lib/offers/early-free-bet-award";
import { formatOfferListGroupLabel, startOfLocalDay } from "@/lib/offers/offer-list-groups";
import { formatClockTime } from "@/lib/time-format";
import { MARKET_LABELS } from "@/lib/markets";
import {
  formatGoalScorelineSegments,
  formatGoalScorelineText,
  goalHistoryCopyFromEntry,
  goalHistoryScorelineParts,
  inferGoalScoringSidesFromEntries,
  inferTwoUpTriggerGoalIds,
  parseGoalHistoryScoreline,
  type GoalScorelineParts,
  type HistoryTitlePart,
  type HistoryTwoUpTrigger,
} from "@/lib/history-goal-copy";
import type { Side } from "@/lib/calc/trigger";
import { racingResultCopyFromGoals, type RacingResultCopy } from "@/lib/history-racing-copy";

export type HistoryFilter =
  | "all"
  | "bets"
  | "placed"
  | "settlements"
  | "casino"
  | "free_bets"
  | "match_events"
  | "racing"
  | "boosts";

export const HISTORY_FILTERS: { id: HistoryFilter; label: string; description: string }[] = [
  { id: "all", label: "All", description: "Everything in the feed" },
  { id: "bets", label: "Bets", description: "Placed and settled bets" },
  { id: "placed", label: "Bets placed", description: "When you logged a new bet" },
  { id: "settlements", label: "Settlements", description: "Bet and casino settlements" },
  { id: "casino", label: "Casino", description: "Completed casino campaigns" },
  { id: "free_bets", label: "Free bets", description: "When a promo awards a free bet" },
  { id: "match_events", label: "Match events", description: "Goals (incl. 2UP), kick-offs and full time" },
  { id: "racing", label: "Racing", description: "Race results and horse-racing bets" },
  { id: "boosts", label: "Boosts", description: "Price boost bets placed and settled" },
];

export interface HistoryContext {
  eventsById: Map<number, EventRow>;
  betsById: Map<number, BetRow>;
  promoByBetId: Record<number, { amount: number; reason: string }>;
  /** Linked offer titles for early free-bet award eligibility on bet_placed rows. */
  offerTitleById: Map<number, string>;
  /** Scoring side per goal row, inferred from successive scorelines in the feed. */
  goalScoringSideById: Map<number, Side>;
  /** First goal that put a side two ahead, per match. */
  twoUpTriggerByGoalId: Map<number, HistoryTwoUpTrigger>;
}

export function buildHistoryContext(
  events: EventRow[],
  bets: BetRow[],
  promoByBetId: Record<number, { amount: number; reason: string }> = {},
  offerTitles: Array<{ id: number; title: string }> = [],
  historyEntries: HistoryRow[] = []
): HistoryContext {
  const eventsById = new Map(events.map((e) => [e.id, e]));
  return {
    eventsById,
    betsById: new Map(bets.map((b) => [b.id, b])),
    promoByBetId,
    offerTitleById: new Map(offerTitles.map((o) => [o.id, o.title])),
    goalScoringSideById: inferGoalScoringSidesFromEntries(historyEntries, eventsById),
    twoUpTriggerByGoalId: inferTwoUpTriggerGoalIds(historyEntries, eventsById),
  };
}

export function resolveHistoryEvent(
  entry: HistoryRow,
  ctx: HistoryContext
): EventRow | undefined {
  if (entry.eventId != null) return ctx.eventsById.get(entry.eventId);
  if (entry.betId != null) {
    const bet = ctx.betsById.get(entry.betId);
    if (bet?.eventId != null) return ctx.eventsById.get(bet.eventId);
  }
  return undefined;
}

/** When the moment happened - used for sorting and the time column. */
export function historyOccurredAt(entry: HistoryRow, ctx: HistoryContext): number {
  const event = resolveHistoryEvent(entry, ctx);
  const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;

  if (entry.kind === "bet_placed") {
    return bet?.createdAt ?? entry.createdAt;
  }

  if (entry.kind === "kickoff" && event?.startTime) {
    return event.startTime;
  }

  if (entry.kind === "full_time" && event?.startTime) {
    if (event.sport === "horse_racing") return event.startTime;
    const minute = entry.minute ?? 90;
    return event.startTime + minute * 60 * 1000;
  }

  if (event?.sport === "horse_racing" && event.startTime) {
    return event.startTime;
  }

  if (entry.minute != null && event?.startTime) {
    return event.startTime + entry.minute * 60 * 1000;
  }

  if (entry.kind === "settlement" && bet?.settledAt) {
    return bet.settledAt;
  }

  return entry.createdAt;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(when: Date, now: Date): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameCalendarDay(when, yesterday);
}

function formatHistoryClock(when: Date): string {
  return formatClockTime(when);
}

/**
 * Match minute for a football bet placed after kick-off.
 * Pre-match and racing stay on the wall clock.
 */
export function historyInPlayPlacementMinute(
  placedAt: number,
  event: Pick<EventRow, "sport" | "startTime" | "status" | "minute">
): number | null {
  if (event.sport === "horse_racing") return null;
  if (!(event.startTime > 0)) return null;
  const elapsedMs = placedAt - event.startTime;
  if (elapsedMs < 30_000) return null;
  const ftMinute = Math.max(event.minute || 90, 90);
  const ftAt = event.startTime + ftMinute * 60_000;
  if (event.status === "finished" && placedAt > ftAt + 120_000) return null;
  const minute = Math.floor(elapsedMs / 60_000);
  if (minute < 1 || minute > 130) return null;
  return minute;
}

/** Stored or derived minute for an in-play bet_placed row. */
export function historyBetPlacedMatchMinute(
  entry: HistoryRow,
  ctx: HistoryContext
): number | null {
  if (entry.kind !== "bet_placed") return null;
  const event = resolveHistoryEvent(entry, ctx);
  if (!event || event.sport === "horse_racing") return null;
  if (entry.minute != null && entry.minute > 0) return entry.minute;
  const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;
  return historyInPlayPlacementMinute(bet?.createdAt ?? entry.createdAt, event);
}

/** True when the badge should show a live minute (e.g. 23') instead of a clock time. */
export function historyUsesMinuteBadge(entry: HistoryRow, ctx: HistoryContext): boolean {
  const event = resolveHistoryEvent(entry, ctx);
  if (historyBetPlacedMatchMinute(entry, ctx) != null) return true;
  // AET/extra-time full_time entries show the match minute ("120'") not the wall clock
  // so they read consistently alongside AET goals at the same minute.
  if (entry.kind === "full_time" && (entry.minute ?? 90) > 90 && event?.sport !== "horse_racing") {
    return true;
  }
  return (
    entry.minute != null &&
    event?.sport !== "horse_racing" &&
    entry.kind !== "settlement" &&
    entry.kind !== "bet_placed" &&
    entry.kind !== "kickoff" &&
    entry.kind !== "full_time"
  );
}

/** Left-column time badge parts - two lines for today, yesterday and older. */
export interface HistoryTimeBadgeParts {
  primary: string;
  secondary?: string;
}

export function formatHistoryTimeBadgeParts(
  entry: HistoryRow,
  ctx: HistoryContext,
  options?: { omitDay?: boolean }
): HistoryTimeBadgeParts {
  const occurredAt = historyOccurredAt(entry, ctx);
  const when = new Date(occurredAt);
  const now = new Date();

  if (historyUsesMinuteBadge(entry, ctx)) {
    const minute = historyBetPlacedMatchMinute(entry, ctx) ?? entry.minute;
    return { primary: `${minute}'` };
  }

  const time = formatHistoryClock(when);
  if (options?.omitDay) {
    return { primary: time };
  }

  if (isSameCalendarDay(when, now)) {
    return { primary: "Today", secondary: time };
  }

  if (isYesterday(when, now)) {
    return { primary: "Yesterday", secondary: time };
  }

  return {
    primary: when.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    secondary: time,
  };
}

/** Left-column time badge - aligned to event/race time where possible. */
export function formatHistoryTimeBadge(
  entry: HistoryRow,
  ctx: HistoryContext,
  options?: { omitDay?: boolean }
): string {
  const { primary, secondary } = formatHistoryTimeBadgeParts(entry, ctx, options);
  return secondary ? `${primary}, ${secondary}` : primary;
}

export function formatHistoryDateGroup(
  entry: HistoryRow,
  ctx: HistoryContext,
  nowMs = Date.now()
): string {
  return formatOfferListGroupLabel(startOfLocalDay(historyOccurredAt(entry, ctx)), nowMs);
}

export interface HistoryDayGroup {
  key: string;
  label: string;
  entries: HistoryRow[];
}

/** Newest-first rows into Today / Yesterday / older day bands. */
export function groupHistoryFeedByDay(
  entries: HistoryRow[],
  ctx: HistoryContext,
  nowMs = Date.now()
): HistoryDayGroup[] {
  const groups: HistoryDayGroup[] = [];
  for (const entry of entries) {
    const when = new Date(historyOccurredAt(entry, ctx));
    const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
      continue;
    }
    groups.push({
      key,
      label: formatHistoryDateGroup(entry, ctx, nowMs),
      entries: [entry],
    });
  }
  return groups;
}

export function historySettledNote(entry: HistoryRow, ctx: HistoryContext): string | undefined {
  if (entry.kind !== "settlement") return undefined;
  const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;
  const event = resolveHistoryEvent(entry, ctx);
  if (!bet?.settledAt || !event?.startTime) return undefined;
  if (bet.settledAt <= event.startTime + 60_000) return undefined;
  const settled = new Date(bet.settledAt);
  return `Settled ${settled.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })}, ${formatClockTime(settled)}`;
}

export function isRacingHistoryEntry(entry: HistoryRow, ctx: HistoryContext): boolean {
  const event = resolveHistoryEvent(entry, ctx);
  return event?.sport === "horse_racing";
}

/** Settlement rows that credit a free bet (won = place trigger, earned = qualifier). */
export function isFreeBetWonHistoryEntry(entry: HistoryRow): boolean {
  return titleHasFreeBetAwardPhrase(entry.title);
}

export function isFreeBetBetType(betType: BetRow["betType"]): boolean {
  return betType === "free_snr" || betType === "free_sr";
}

export function isBoostBetType(betType: BetRow["betType"] | string | null | undefined): boolean {
  return betType === "boost";
}

export function isBoostHistoryEntry(entry: HistoryRow, ctx: HistoryContext): boolean {
  if (entry.betId == null) return false;
  if (entry.kind !== "bet_placed" && entry.kind !== "settlement") return false;
  const bet = ctx.betsById.get(entry.betId);
  return bet != null && isBoostBetType(bet.betType);
}

export function isFreeBetPlacedHistoryEntry(entry: HistoryRow, ctx: HistoryContext): boolean {
  if (entry.kind !== "bet_placed" || entry.betId == null) return false;
  const bet = ctx.betsById.get(entry.betId);
  return bet != null && isFreeBetBetType(bet.betType);
}

export function isLockInPlacedHistoryEntry(entry: HistoryRow, ctx: HistoryContext): boolean {
  if (entry.kind !== "bet_placed" || entry.betId == null) return false;
  const bet = ctx.betsById.get(entry.betId);
  return bet != null && isLockInLoggedBet(bet);
}

/**
 * Acca / Bet Builder desk hedge lays — belong on the desk while the campaign
 * is live. History narrates the campaign back (+ match events), not per-leg lays.
 */
export function isDeskCampaignLayHistoryEntry(
  entry: HistoryRow,
  ctx: HistoryContext
): boolean {
  if (entry.betId == null) return false;
  if (entry.kind !== "settlement" && entry.kind !== "bet_placed") return false;
  const bet = ctx.betsById.get(entry.betId);
  if (bet == null) return false;
  return isAccaDeskLay(bet) || isBetBuilderDeskLay(bet);
}

/** Display title - upgrades legacy "Bet placed" rows when the bet is a free bet. */
export function historyEntryTitle(entry: HistoryRow, ctx: HistoryContext): string {
  if (isLockInPlacedHistoryEntry(entry, ctx)) return "Lock-in placed";
  if (isFreeBetPlacedHistoryEntry(entry, ctx)) return "Free bet placed";
  if (entry.kind === "goal") {
    return goalHistoryCopyFromEntry(entry, resolveHistoryEvent(entry, ctx)).title;
  }
  return entry.title;
}

/** Structured title for goal rows. Null when the title is plain (no mixed weight). */
export function historyEntryTitleParts(
  entry: HistoryRow,
  ctx: HistoryContext
): HistoryTitlePart[] | null {
  if (entry.kind !== "goal") return null;
  const parts = goalHistoryCopyFromEntry(entry, resolveHistoryEvent(entry, ctx)).parts;
  if (!parts.some((part) => part.emphasize)) return null;
  return parts;
}

/** Scoreline pieces for goal rows, with the scoring side marked for emphasis. */
export function historyGoalScoreline(
  entry: HistoryRow,
  ctx: HistoryContext
): GoalScorelineParts | null {
  if (entry.kind !== "goal") return null;
  const event = resolveHistoryEvent(entry, ctx);
  const copy = goalHistoryCopyFromEntry(entry, event);
  const scoringSide = copy.scoringSide ?? ctx.goalScoringSideById.get(entry.id) ?? null;
  return goalHistoryScorelineParts(entry, event, scoringSide);
}

const FOOTBALL_MATCH_MOMENT_KINDS = new Set<HistoryRow["kind"]>([
  "kickoff",
  "goal",
  "two_up",
  "full_time",
]);

/** Kick-off, goal, 2UP and full time on a football fixture, not a bet row. */
export function isFootballMatchMoment(entry: HistoryRow, ctx: HistoryContext): boolean {
  if (!FOOTBALL_MATCH_MOMENT_KINDS.has(entry.kind)) return false;
  const event = resolveHistoryEvent(entry, ctx);
  if (!event) return false;
  return event.sport === "football" || !event.sport;
}

/** Football match-moment rows open the tape modal instead of navigating. */
export function historyEntryOpensMatchTape(
  entry: HistoryRow,
  ctx: HistoryContext
): EventRow | null {
  if (!isFootballMatchMoment(entry, ctx)) return null;
  return resolveHistoryEvent(entry, ctx) ?? null;
}

function isFootballFixtureEvent(event: EventRow | undefined): event is EventRow {
  return Boolean(event && (event.sport === "football" || !event.sport));
}

/**
 * Football fixture for the right-hand crest lock-up.
 * Match moments and Bet placed. Settlements keep the money rail.
 */
export function historyEntryFixtureLockup(
  entry: HistoryRow,
  ctx: HistoryContext
): EventRow | null {
  const tape = historyEntryOpensMatchTape(entry, ctx);
  if (tape) return tape;
  if (entry.kind !== "bet_placed") return null;
  const event = resolveHistoryEvent(entry, ctx);
  return isFootballFixtureEvent(event) ? event : null;
}

export function historyFootballEventsForCrests(
  entries: HistoryRow[],
  ctx: HistoryContext
): EventRow[] {
  const byId = new Map<number, EventRow>();
  for (const entry of entries) {
    const event = historyEntryFixtureLockup(entry, ctx);
    if (event) byId.set(event.id, event);
  }
  return [...byId.values()];
}

/** Top-row fixture for match-only football updates. */
export function historyMatchMomentHeadline(
  entry: HistoryRow,
  ctx: HistoryContext
): string | null {
  if (!isFootballMatchMoment(entry, ctx)) return null;
  const event = resolveHistoryEvent(entry, ctx);
  if (!event) return null;
  return formatEventTitle(event);
}

/** Race-only result row — not a bet settlement. */
export function isRacingResultMoment(entry: HistoryRow, ctx: HistoryContext): boolean {
  return entry.kind === "full_time" && isRacingHistoryEntry(entry, ctx);
}

/** Top-row meeting for race-only results. Time stays in the badge. */
export function historyRacingResultHeadline(
  entry: HistoryRow,
  ctx: HistoryContext
): string | null {
  if (!isRacingResultMoment(entry, ctx)) return null;
  const event = resolveHistoryEvent(entry, ctx);
  if (!event) return null;
  return racingVenueLabel(event.competition);
}

/** Fixture or meeting on the top row for sport-only feed moments. */
export function historySportMomentHeadline(
  entry: HistoryRow,
  ctx: HistoryContext
): string | null {
  return historyMatchMomentHeadline(entry, ctx) ?? historyRacingResultHeadline(entry, ctx);
}

export function historyRacingResultCopy(
  entry: HistoryRow,
  ctx: HistoryContext
): RacingResultCopy | null {
  if (!isRacingResultMoment(entry, ctx)) return null;
  const event = resolveHistoryEvent(entry, ctx);
  return (
    racingResultCopyFromGoals(event?.goals, entry.detail) ?? {
      label: historyEntryTitle(entry, ctx),
      parts: [],
    }
  );
}

/** Spoken goal prefix for the subline. The ball mark is visual-only in the feed. */
export function historyGoalEventLabel(entry: HistoryRow, ctx: HistoryContext): string | null {
  if (entry.kind !== "goal") return null;
  return goalHistoryCopyFromEntry(entry, resolveHistoryEvent(entry, ctx)).title;
}

/** 2UP mark for the goal that first put a side two ahead. */
export function historyGoalTwoUpTrigger(
  entry: HistoryRow,
  ctx: HistoryContext
): HistoryTwoUpTrigger | null {
  if (entry.kind !== "goal") return null;
  return ctx.twoUpTriggerByGoalId.get(entry.id) ?? null;
}

function twoUpHistorySide(
  entry: HistoryRow,
  event: EventRow | undefined
): Side | null {
  const fromDedupe = entry.dedupe.match(/^2up:\d+:(home|away)$/);
  if (fromDedupe?.[1] === "home" || fromDedupe?.[1] === "away") {
    return fromDedupe[1];
  }
  if (!event) return null;
  const text = `${entry.title} ${entry.detail ?? ""}`;
  const hasHome = Boolean(event.homeTeam && text.includes(event.homeTeam));
  const hasAway = Boolean(event.awayTeam && text.includes(event.awayTeam));
  if (hasHome && !hasAway) return "home";
  if (hasAway && !hasHome) return "away";
  return null;
}

function eventTwoUpTriggerSides(
  ctx: HistoryContext,
  eventId: number
): Set<Side> {
  const sides = new Set<Side>();
  for (const trigger of ctx.twoUpTriggerByGoalId.values()) {
    if (trigger.eventId === eventId) sides.add(trigger.side);
  }
  return sides;
}

/**
 * Standalone two_up rows that already sit on a Goal! line as a 2UP pill.
 * Keep the row when no matching goal exists (score tick without a goal entry).
 */
export function isAbsorbedTwoUpHistoryEntry(
  entry: HistoryRow,
  ctx: HistoryContext
): boolean {
  if (entry.kind !== "two_up") return false;
  const event = resolveHistoryEvent(entry, ctx);
  const eventId = entry.eventId ?? event?.id;
  if (eventId == null) return false;
  const triggered = eventTwoUpTriggerSides(ctx, eventId);
  if (triggered.size === 0) return false;
  const side = twoUpHistorySide(entry, event);
  if (side) return triggered.has(side);
  return triggered.size === 1;
}

/** Rows the History feed should not render. */
export function isHiddenHistoryFeedEntry(
  entry: HistoryRow,
  ctx: HistoryContext
): boolean {
  return (
    isDeskCampaignLayHistoryEntry(entry, ctx) || isAbsorbedTwoUpHistoryEntry(entry, ctx)
  );
}

/** Bracketed scoreline segments for the goal subline. */
export function historyGoalScorelineSegments(
  entry: HistoryRow,
  ctx: HistoryContext,
  opts?: { omitTeams?: boolean }
): HistoryTitlePart[] | null {
  const scoreline = historyGoalScoreline(entry, ctx);
  if (!scoreline) return null;
  return formatGoalScorelineSegments(scoreline, opts);
}

function footballFullTimeScoreSuffix(
  entry: HistoryRow,
  event: EventRow
): string | null {
  const detail = entry.detail?.trim();
  if (detail) {
    const parsed = parseGoalHistoryScoreline(detail, event);
    if (parsed) {
      const extra = detail.match(/\s+(\((?:FT:|Pens)[^)]*\))\s*$/);
      return extra
        ? `${parsed.homeScore}-${parsed.awayScore} ${extra[1]}`
        : `${parsed.homeScore}-${parsed.awayScore}`;
    }
  }
  if (event.homeScore != null && event.awayScore != null) {
    return `${event.homeScore}-${event.awayScore}`;
  }
  return detail || null;
}

/**
 * Second-row copy for match-only football updates that are not goals.
 * Goals render `⚽ Goal!` + the bracketed scoreline separately.
 */
export function historyMatchMomentSubline(
  entry: HistoryRow,
  ctx: HistoryContext
): string | null {
  if (!isFootballMatchMoment(entry, ctx) || entry.kind === "goal") return null;
  const event = resolveHistoryEvent(entry, ctx);
  if (entry.kind === "full_time" && event) {
    const title = historyEntryTitle(entry, ctx);
    const score = footballFullTimeScoreSuffix(entry, event);
    return score ? `${title} · ${score}` : title;
  }
  if (entry.kind === "two_up") {
    return entry.detail?.trim() || historyEntryTitle(entry, ctx);
  }
  return historyEntryTitle(entry, ctx);
}

/** Where a feed row should navigate when clicked. */
export function historyEntryHref(entry: HistoryRow, ctx: HistoryContext): string {
  const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;

  if (
    entry.kind === "bet_placed" ||
    entry.kind === "settlement" ||
    entry.kind === "free_bet_promo"
  ) {
    if (bet && isAccaDeskBack(bet)) return "/acca?tab=history";
    return bet ? `/tracker?highlight=${bet.id}` : "/tracker";
  }

  if (entry.kind === "casino_settlement") {
    return "/casino";
  }

  if (
    entry.kind === "kickoff" ||
    entry.kind === "goal" ||
    entry.kind === "two_up" ||
    entry.kind === "full_time"
  ) {
    if (bet) return `/tracker?highlight=${bet.id}`;
    return "/tracked-events";
  }

  return "/history";
}

function sportMomentLinkPhrase(
  entry: HistoryRow,
  ctx: HistoryContext
): string | null {
  if (isFootballMatchMoment(entry, ctx)) {
    const fixture = historyMatchMomentHeadline(entry, ctx);
    const kind = historyKindLabel(entry.kind);
    if (entry.kind === "goal") {
      const scoreline = historyGoalScoreline(entry, ctx);
      const score = scoreline
        ? formatGoalScorelineText(scoreline, { omitTeams: Boolean(fixture) })
        : null;
      const twoUp = historyGoalTwoUpTrigger(entry, ctx);
      return [kind, twoUp ? "2UP triggered" : null, fixture, score].filter(Boolean).join(", ");
    }
    return [kind, fixture].filter(Boolean).join(", ");
  }
  if (isRacingResultMoment(entry, ctx)) {
    const meeting = historyRacingResultHeadline(entry, ctx);
    const copy = historyRacingResultCopy(entry, ctx);
    const places = copy?.parts.map((part) => part.text).join("") ?? null;
    return ["Result", meeting, places].filter(Boolean).join(", ");
  }
  return null;
}

/** Screen-reader label for a clickable feed row. */
export function historyEntryLinkLabel(entry: HistoryRow, ctx: HistoryContext): string {
  const tapeEvent = historyEntryOpensMatchTape(entry, ctx);
  if (tapeEvent) {
    return `Open match events for ${formatEventTitle(tapeEvent)}`;
  }
  const href = historyEntryHref(entry, ctx);
  const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;
  const event = resolveHistoryEvent(entry, ctx);
  const matchPhrase = sportMomentLinkPhrase(entry, ctx);

  if (href.startsWith("/tracker")) {
    if (matchPhrase) return `Open ${matchPhrase} in tracker`;
    return bet ? `Open ${bet.label} in tracker` : "Open profit tracker";
  }
  if (href.startsWith("/tracked-events")) {
    if (matchPhrase) return `Open ${matchPhrase} in tracked events`;
    return event ? `Open ${formatEventTitle(event)} in tracked events` : "Open tracked events";
  }
  if (href.startsWith("/casino")) {
    return "Open casino campaigns";
  }
  return "Open history";
}

export function isFreeBetHistoryEntry(entry: HistoryRow, ctx: HistoryContext): boolean {
  if (isFreeBetPlacedHistoryEntry(entry, ctx)) return true;
  if (titleHasFreeBetAwardPhrase(entry.title)) return true;
  if (entry.kind === "free_bet_promo") return true;
  if (entry.kind === "settlement" && entry.betId != null && ctx.promoByBetId[entry.betId]) {
    return true;
  }
  return false;
}

export function matchesHistoryFilter(
  entry: HistoryRow,
  filter: HistoryFilter,
  ctx: HistoryContext
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "bets":
      return entry.kind === "settlement" || entry.kind === "bet_placed";
    case "placed":
      return entry.kind === "bet_placed";
    case "settlements":
      return entry.kind === "settlement" || entry.kind === "casino_settlement";
    case "casino":
      return entry.kind === "casino_settlement";
    case "free_bets":
      return isFreeBetHistoryEntry(entry, ctx);
    case "match_events":
      return (
        (entry.kind === "kickoff" ||
          entry.kind === "goal" ||
          entry.kind === "two_up" ||
          entry.kind === "full_time") &&
        !isRacingHistoryEntry(entry, ctx)
      );
    case "racing":
      return (
        isRacingHistoryEntry(entry, ctx) ||
        (entry.kind === "full_time" && entry.eventId != null && isRacingHistoryEntry(entry, ctx))
      );
    case "boosts":
      return isBoostHistoryEntry(entry, ctx);
    default:
      return true;
  }
}

/** Sort key - groups bet story rows on the same moment so tie ranks apply. */
function historySortAt(entry: HistoryRow, ctx: HistoryContext): number {
  const event = resolveHistoryEvent(entry, ctx);

  if (event?.startTime != null) {
    if (event.sport === "horse_racing") {
      if (
        entry.kind === "bet_placed" ||
        entry.kind === "full_time" ||
        entry.kind === "settlement"
      ) {
        return event.startTime;
      }
    }
    if (entry.kind === "settlement") {
      return event.startTime + (entry.minute ?? 90) * 60 * 1000;
    }
  }

  return historyOccurredAt(entry, ctx);
}

export function sortHistoryEntries(
  rows: HistoryRow[],
  ctx: HistoryContext
): HistoryRow[] {
  return [...rows].sort((a, b) => {
    const ta = historySortAt(a, ctx);
    const tb = historySortAt(b, ctx);
    if (tb !== ta) return tb - ta;
    const ra = historyKindTieRank(a.kind);
    const rb = historyKindTieRank(b.kind);
    if (ra !== rb) return rb - ra;
    return b.id - a.id;
  });
}

/**
 * When two entries share the same timestamp, sort descending by this rank so the
 * newest-first feed tells a coherent story:
 *   settlement (15) → full_time (12) → goal/kickoff/two_up (10) → bet_placed (0)
 *
 * The default 10 covers goal, kickoff, two_up and must be BELOW full_time (12)
 * so that a goal at minute 120 and the AET full-time whistle at the same clock
 * second display in the right order: full time on top, the goal that triggered
 * it below.
 */
function historyKindTieRank(kind: HistoryRow["kind"]): number {
  switch (kind) {
    case "bet_placed":
      return 0;
    case "full_time":
      return 12;
    case "settlement":
      return 15;
    default:
      return 10;
  }
}

export function historyKindLabel(kind: HistoryRow["kind"]): string {
  switch (kind) {
    case "bet_placed":
      return "Bet placed";
    case "settlement":
      return "Settlement";
    case "casino_settlement":
      return "Casino";
    case "kickoff":
      return "Kick-off";
    case "goal":
      return "Goal";
    case "two_up":
      return "2UP";
    case "full_time":
      return "Full time";
    case "free_bet_promo":
      return "Free bet";
    case "balance_adjustment":
      return "Balance correction";
    default:
      return kind;
  }
}

export function formatBetMeta(bet: BetRow): string[] {
  const lines: string[] = [];
  if (bet.bookmaker) lines.push(bet.bookmaker);
  if (bet.selection) {
    const market = MARKET_LABELS[bet.market] ?? bet.market;
    lines.push(`${market} · ${bet.selection}`);
  }
  if (bet.backStake > 0) {
    lines.push(`Back ${formatGbp(bet.backStake)} @ ${bet.backOdds.toFixed(2)}`);
  }
  if (bet.layStake > 0) {
    lines.push(`Lay ${formatGbp(bet.layStake)} @ ${bet.layOdds.toFixed(2)}`);
  }
  const type = isLockInLoggedBet(bet)
    ? "Lock-in"
    : bet.betType === "free_snr"
      ? "Free bet (SNR)"
      : bet.betType === "free_sr"
        ? "Free bet (SR)"
        : bet.betType === "dutch"
          ? "Dutch"
          : "Qualifying";
  lines.push(type);
  return lines;
}

export function formatHistoryEventLine(
  entry: HistoryRow,
  ctx: HistoryContext,
  options?: { omitRaceTime?: boolean }
): string | undefined {
  const event = resolveHistoryEvent(entry, ctx);
  if (!event) return undefined;
  if (options?.omitRaceTime && event.sport === "horse_racing") {
    const venue = racingVenueLabel(event.competition);
    return venue || formatEventTitle(event);
  }
  return formatEventTitle(event);
}

/** Acca settlement title — campaign outcome, not ordinary single-bet wording. */
export function formatAccaSettlementTitle(
  status: BetRow["status"],
  promo?: { amount: number; reason: string } | null,
  freeBetPhrase: string = FREE_BET_EARNED_PHRASE
): string {
  const base =
    status === "won"
      ? "Acca won"
      : status === "lost"
        ? "Acca lost"
        : status === "void"
          ? "Acca void"
          : status === "push"
            ? "Acca push"
            : "Acca settled";
  if (promo && (status === "won" || status === "lost")) {
    return `${base} · ${freeBetPhrase}`;
  }
  return base;
}

/** Ordinary bet settlement title when a free-bet promo credits on settle. */
export function formatSettlementTitleWithFreeBet(
  status: BetRow["status"],
  freeBetPhrase: string
): string {
  if (status === "lost") return `Bet lost · ${freeBetPhrase}`;
  if (status === "won") return `Bet won · ${freeBetPhrase}`;
  return status === "early_payout"
    ? "2UP paid early"
    : status === "half_win"
      ? "Bet half won"
      : status === "half_lose"
        ? "Bet half lost"
        : status === "push"
          ? "Bet push"
          : status === "void"
            ? "Bet void"
            : "Bet settled";
}

export { FREE_BET_EARNED_PHRASE, FREE_BET_WON_PHRASE };

/** Acca placed title. */
export function formatAccaPlacedTitle(betType: BetRow["betType"] | string | null): string {
  if (betType === "free_snr" || betType === "free_sr") return "Acca free bet placed";
  return "Acca placed";
}

/**
 * Second-line History copy for Acca desk backs — campaign identity only.
 * `Treble · Bet £20 (ACCA) get £10 free bet` — not a single fixture or a leg list.
 */
export function formatAccaHistoryDetail(
  run: Pick<AccaRunRow, "label">,
  legs: Array<Pick<AccaLegRow, "label" | "result">>
): string {
  const runLabel = run.label.trim();
  const fold = accaFoldName(legs.length);
  if (fold && runLabel) return `${fold} · ${runLabel}`;
  if (runLabel) return runLabel;
  if (fold) return fold;
  const n = legs.length;
  return `${n} ${n === 1 ? "leg" : "legs"}`;
}

/**
 * Account label for a P&L balance-correction row.
 * Detail is stored as `Account - +GBP 0.20`; the amount renders separately.
 */
export function balanceAdjustmentAccountName(entry: HistoryRow): string | undefined {
  if (entry.kind !== "balance_adjustment") return undefined;
  const detail = entry.detail?.trim();
  if (!detail) return undefined;
  const withAmount = detail.match(/^(.*?)\s+-\s+[+-]?GBP\s+/i);
  if (withAmount?.[1]?.trim()) return withAmount[1].trim();
  const dash = detail.lastIndexOf(" - ");
  if (dash > 0) return detail.slice(0, dash).trim() || undefined;
  return detail;
}

/** Header subtitle - omit when the bet card already shows the same text. */
export function historyEntrySubtitle(
  entry: HistoryRow,
  bet: BetRow | undefined,
  promo?: { amount: number; reason: string }
): string | undefined {
  if (entry.kind === "balance_adjustment") {
    return balanceAdjustmentAccountName(entry);
  }
  const detail = entry.detail?.trim();
  if (!detail) return undefined;
  if (!bet) return detail;

  const label = bet.label.trim();
  if (detail === label) return undefined;

  if (promo) {
    const promoTail = formatPromoTooltip(promo.amount, promo.reason);
    if (detail === `${label} · ${promoTail}`) return undefined;
    if (detail.startsWith(`${label} · `)) {
      return detail.slice(label.length + 3).trim() || undefined;
    }
  }

  return detail;
}

export function showHistoryTriggerField(bet: BetRow): boolean {
  const trigger = bet.triggerText?.trim();
  if (!trigger) return false;
  return !bet.label.includes(trigger);
}

/** Promo line for history cards - dedupes amount already embedded in reason. */
export function formatHistoryPromoLine(promo: { amount: number; reason: string }): string {
  return formatPromoTooltip(promo.amount, promo.reason);
}

/** Promo awards apply at settlement - not on the original bet-placed entry. */
export function showHistoryPromoField(entry: HistoryRow, promo?: { amount: number; reason: string }): boolean {
  if (!promo) return false;
  return entry.kind === "settlement" || entry.kind === "free_bet_promo";
}

/** Bet label row - skip when it only repeats the selection (e.g. "Winner Kit Gabriel"). */
export function showHistoryBetLabel(bet: BetRow): boolean {
  const label = bet.label.trim();
  const sel = bet.selection?.trim();
  if (!sel) return true;
  if (label === sel) return false;
  if (label === `Winner ${sel}`) return false;
  return true;
}
