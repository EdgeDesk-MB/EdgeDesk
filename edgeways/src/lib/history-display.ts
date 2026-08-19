import type { AccaLegRow, AccaRunRow, BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import { isAccaDeskBack, isAccaDeskLay } from "@/lib/bets/acca-desk-bets";
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
import { formatClockTime } from "@/lib/time-format";
import { MARKET_LABELS } from "@/lib/markets";
import {
  formatGoalScorelineSegments,
  formatGoalScorelineText,
  goalHistoryCopyFromEntry,
  goalHistoryScorelineParts,
  inferGoalScoringSidesFromEntries,
  parseGoalHistoryScoreline,
  type GoalScorelineParts,
  type HistoryTitlePart,
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
  { id: "match_events", label: "Match events", description: "Goals, kick-offs, 2UP and full time" },
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

/** True when the badge should show a live minute (e.g. 23') instead of a clock time. */
export function historyUsesMinuteBadge(entry: HistoryRow, ctx: HistoryContext): boolean {
  const event = resolveHistoryEvent(entry, ctx);
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
  ctx: HistoryContext
): HistoryTimeBadgeParts {
  const occurredAt = historyOccurredAt(entry, ctx);
  const when = new Date(occurredAt);
  const now = new Date();

  if (historyUsesMinuteBadge(entry, ctx)) {
    return { primary: `${entry.minute}'` };
  }

  const time = formatHistoryClock(when);

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
export function formatHistoryTimeBadge(entry: HistoryRow, ctx: HistoryContext): string {
  const { primary, secondary } = formatHistoryTimeBadgeParts(entry, ctx);
  return secondary ? `${primary}, ${secondary}` : primary;
}

export function formatHistoryDateGroup(
  entry: HistoryRow,
  ctx: HistoryContext,
  nowMs = Date.now()
): string {
  const when = new Date(historyOccurredAt(entry, ctx));
  const now = new Date(nowMs);
  if (isSameCalendarDay(when, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(when, yesterday)) return "Yesterday";
  return when.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: when.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
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

/** Kick-off, goal, 2UP and full time on a football fixture — not a bet row. */
export function isFootballMatchMoment(entry: HistoryRow, ctx: HistoryContext): boolean {
  if (!FOOTBALL_MATCH_MOMENT_KINDS.has(entry.kind)) return false;
  const event = resolveHistoryEvent(entry, ctx);
  if (!event) return false;
  return event.sport === "football" || !event.sport;
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

/** Bracketed scoreline segments for the goal subline. */
export function historyGoalScorelineSegments(
  entry: HistoryRow,
  ctx: HistoryContext
): HistoryTitlePart[] | null {
  const scoreline = historyGoalScoreline(entry, ctx);
  if (!scoreline) return null;
  return formatGoalScorelineSegments(scoreline);
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
      const score = scoreline ? formatGoalScorelineText(scoreline) : null;
      return [kind, fixture, score].filter(Boolean).join(", ");
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
  const type =
    bet.betType === "free_snr"
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
