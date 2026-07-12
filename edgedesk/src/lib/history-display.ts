import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import { formatGbp } from "@/lib/format-money";
import { formatPromoTooltip } from "@/lib/bet-outcomes";
import { formatEventTitle, racingVenueLabel } from "@/lib/events";
import { formatClockTime } from "@/lib/time-format";
import { MARKET_LABELS } from "@/lib/markets";

export type HistoryFilter =
  | "all"
  | "bets"
  | "placed"
  | "settlements"
  | "free_bets"
  | "match_events"
  | "racing";

export const HISTORY_FILTERS: { id: HistoryFilter; label: string; description: string }[] = [
  { id: "all", label: "All", description: "Everything in the feed" },
  { id: "bets", label: "Bets", description: "Placed and settled bets" },
  { id: "placed", label: "Bets placed", description: "When you logged a new bet" },
  { id: "settlements", label: "Settlements", description: "Wins, losses and voids" },
  { id: "free_bets", label: "Free bets", description: "When a promo awards a free bet" },
  { id: "match_events", label: "Match events", description: "Goals, kick-offs, 2UP and full time" },
  { id: "racing", label: "Racing", description: "Race results and horse-racing bets" },
];

export interface HistoryContext {
  eventsById: Map<number, EventRow>;
  betsById: Map<number, BetRow>;
  promoByBetId: Record<number, { amount: number; reason: string }>;
}

export function buildHistoryContext(
  events: EventRow[],
  bets: BetRow[],
  promoByBetId: Record<number, { amount: number; reason: string }> = {}
): HistoryContext {
  return {
    eventsById: new Map(events.map((e) => [e.id, e])),
    betsById: new Map(bets.map((b) => [b.id, b])),
    promoByBetId,
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

/** Left-column time badge parts - two lines for yesterday and older. */
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
    return { primary: time };
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

export function formatHistoryDateGroup(entry: HistoryRow, ctx: HistoryContext): string {
  const when = new Date(historyOccurredAt(entry, ctx));
  const now = new Date();
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

export function isFreeBetWonHistoryEntry(entry: HistoryRow): boolean {
  return entry.title.includes("Free bet won");
}

export function isFreeBetBetType(betType: BetRow["betType"]): boolean {
  return betType === "free_snr" || betType === "free_sr";
}

export function isFreeBetPlacedHistoryEntry(entry: HistoryRow, ctx: HistoryContext): boolean {
  if (entry.kind !== "bet_placed" || entry.betId == null) return false;
  const bet = ctx.betsById.get(entry.betId);
  return bet != null && isFreeBetBetType(bet.betType);
}

/** Display title - upgrades legacy "Bet placed" rows when the bet is a free bet. */
export function historyEntryTitle(entry: HistoryRow, ctx: HistoryContext): string {
  if (isFreeBetPlacedHistoryEntry(entry, ctx)) return "Free bet placed";
  return entry.title;
}

/** Where a feed row should navigate when clicked. */
export function historyEntryHref(entry: HistoryRow, ctx: HistoryContext): string {
  const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;

  if (
    entry.kind === "bet_placed" ||
    entry.kind === "settlement" ||
    entry.kind === "free_bet_promo"
  ) {
    return bet ? `/tracker?highlight=${bet.id}` : "/tracker";
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

/** Screen-reader label for a clickable feed row. */
export function historyEntryLinkLabel(entry: HistoryRow, ctx: HistoryContext): string {
  const href = historyEntryHref(entry, ctx);
  const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;
  const event = resolveHistoryEvent(entry, ctx);

  if (href.startsWith("/tracker")) {
    return bet ? `Open ${bet.label} in tracker` : "Open profit tracker";
  }
  if (href.startsWith("/tracked-events")) {
    return event ? `Open ${formatEventTitle(event)} in tracked events` : "Open tracked events";
  }
  return "Open history";
}

export function isFreeBetHistoryEntry(entry: HistoryRow, ctx: HistoryContext): boolean {
  if (isFreeBetPlacedHistoryEntry(entry, ctx)) return true;
  if (entry.title.includes("Free bet won")) return true;
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
      return entry.kind === "settlement";
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

/** Header subtitle - omit when the bet card already shows the same text. */
export function historyEntrySubtitle(
  entry: HistoryRow,
  bet: BetRow | undefined,
  promo?: { amount: number; reason: string }
): string | undefined {
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
