import { roundPence } from "@/lib/calc/money";
import type { BetRow } from "@/lib/db";
import {
  buildPnlChartMarkers,
  type ChartBetMarker,
  type ChartBetMarkerTone,
} from "@/lib/pnl/chart-bet-markers";
import { openBetExpectedProfit } from "@/lib/pnl/open-bet-valuation";

export type RacingPnlBetInput = {
  id: number;
  label?: string | null;
  actualProfit: number | null;
  expectedProfit: number | null;
  status: BetRow["status"];
  eventId: number | null;
};

export type RacingPnlEventInput = {
  id: number;
  sport: string;
  startTime: number;
  externalId?: string | null;
  competition?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
};

export type RacingPnlRaceRow = {
  eventId: number;
  raceExternalId: string | null;
  startTime: number;
  course: string;
  raceName: string;
  offTime: string | null;
  /** Racing API region (GB / IRE) when known — drives flag + horse icon. */
  region?: string | null;
  profit: number;
  betCount: number;
  openCount: number;
  settledCount: number;
};

export type RacingPnlDayReport = {
  total: number;
  openCount: number;
  settledCount: number;
  rows: RacingPnlRaceRow[];
  /**
   * Cumulative P&L tips after each bet (by race off time), Home ledger shape.
   * Markers sit on the prior plateau; the series tip is the move that follows.
   */
  cumulative: Array<{ t: number; value: number }>;
  /** Win/loss markers for the day chart (same prior-plateau convention as Home). */
  markers: ChartBetMarker[];
};

/** Local calendar-day bounds for a Unix ms timestamp or `YYYY-MM-DD` desk date. */
export function racingDayBounds(day: number | string = Date.now()): {
  dayStart: number;
  dayEnd: number;
} {
  let start: Date;
  if (typeof day === "string") {
    const [y, m, d] = day.split("-").map(Number);
    start = new Date(y!, (m ?? 1) - 1, d ?? 1);
  } else {
    start = new Date(day);
  }
  start.setHours(0, 0, 0, 0);
  const dayStart = start.getTime();
  return { dayStart, dayEnd: dayStart + 24 * 60 * 60 * 1000 };
}

function betContribution(bet: RacingPnlBetInput): number | null {
  if (bet.status === "void") return null;

  if (bet.status === "open") {
    return openBetExpectedProfit(bet);
  }

  return bet.actualProfit;
}

function toneFromAmount(amount: number, status: BetRow["status"]): ChartBetMarkerTone {
  if (status === "void" || status === "push") return "neutral";
  if (amount > 0.004) return "win";
  if (amount < -0.004) return "loss";
  if (status === "won" || status === "early_payout" || status === "half_win") return "win";
  if (status === "lost" || status === "half_lose") return "loss";
  return "neutral";
}

/**
 * Horse-racing P&L attributed to the local calendar day of the race
 * (`event.startTime`), not when the user entered the result.
 *
 * - Settled bets on that day's races → `actualProfit`
 * - Open bets on that day's races → worst-case `expectedProfit` (same basis as
 *   homepage provisional), so the figure can move when the result lands
 * - Void / other sports / races on other days → excluded
 *
 * `day` is Unix ms (defaults to now) or a desk `YYYY-MM-DD` date key.
 */
export function racingPnlToday(
  bets: RacingPnlBetInput[],
  events: RacingPnlEventInput[],
  day: number | string = Date.now()
): number {
  return racingPnlByRace(bets, events, day).total;
}

/**
 * Per-race breakdown + per-bet cumulative series/markers for Racing Desk
 * “P&L today”. Same attribution rules as {@link racingPnlToday}.
 */
export function racingPnlByRace(
  bets: RacingPnlBetInput[],
  events: RacingPnlEventInput[],
  day: number | string = Date.now()
): RacingPnlDayReport {
  const { dayStart, dayEnd } = racingDayBounds(day);

  const todayHorseEvents = events
    .filter(
      (e) =>
        e.sport === "horse_racing" &&
        e.startTime >= dayStart &&
        e.startTime < dayEnd
    )
    .slice()
    .sort((a, b) => a.startTime - b.startTime || a.id - b.id);

  const eventById = new Map(todayHorseEvents.map((e) => [e.id, e]));

  type Acc = {
    profit: number;
    betCount: number;
    openCount: number;
    settledCount: number;
  };
  const byEvent = new Map<number, Acc>();

  type LedgerBet = {
    bet: RacingPnlBetInput;
    event: RacingPnlEventInput;
    amount: number;
  };
  const ledgerBets: LedgerBet[] = [];

  for (const bet of bets) {
    if (bet.eventId == null || !eventById.has(bet.eventId)) continue;
    const contribution = betContribution(bet);
    if (contribution == null) continue;

    const event = eventById.get(bet.eventId)!;
    const acc = byEvent.get(bet.eventId) ?? {
      profit: 0,
      betCount: 0,
      openCount: 0,
      settledCount: 0,
    };
    acc.profit = roundPence(acc.profit + contribution);
    acc.betCount += 1;
    if (bet.status === "open") acc.openCount += 1;
    else acc.settledCount += 1;
    byEvent.set(bet.eventId, acc);
    ledgerBets.push({ bet, event, amount: contribution });
  }

  // Race off-time order, then bet id — same race gets 1s tip stagger so each
  // bet has its own series tip (Home: chart moves after the marker).
  ledgerBets.sort(
    (a, b) =>
      a.event.startTime - b.event.startTime ||
      a.bet.id - b.bet.id
  );

  const rows: RacingPnlRaceRow[] = [];
  let total = 0;
  let openCount = 0;
  let settledCount = 0;

  for (const ev of todayHorseEvents) {
    const acc = byEvent.get(ev.id);
    if (!acc) continue;

    total = roundPence(total + acc.profit);
    openCount += acc.openCount;
    settledCount += acc.settledCount;

    const course = (ev.competition ?? "").trim() || "Race";
    const raceName = (ev.homeTeam ?? "").trim() || "Race";
    const offTime = (ev.awayTeam ?? "").trim() || null;

    rows.push({
      eventId: ev.id,
      raceExternalId: ev.externalId ?? null,
      startTime: ev.startTime,
      course,
      raceName,
      offTime,
      profit: acc.profit,
      betCount: acc.betCount,
      openCount: acc.openCount,
      settledCount: acc.settledCount,
    });
  }

  const cumulative: Array<{ t: number; value: number }> = [];
  const markerSources: Parameters<typeof buildPnlChartMarkers>[0] = [];
  let running = 0;
  let tipOffset = 0;
  let lastRaceStart = Number.NaN;

  for (const { bet, event, amount } of ledgerBets) {
    if (event.startTime !== lastRaceStart) {
      tipOffset = 0;
      lastRaceStart = event.startTime;
    }
    const tipTime = event.startTime + tipOffset * 1000;
    tipOffset += 1;
    running = roundPence(running + amount);
    cumulative.push({ t: tipTime, value: running });

    const course = (event.competition ?? "").trim();
    const off = (event.awayTeam ?? "").trim();
    const tipAmount = roundPence(amount);
    markerSources.push({
      id: bet.id,
      kind: "bet",
      time: tipTime,
      amount: tipAmount,
      label:
        bet.label?.trim() ||
        [off, course].filter(Boolean).join(" ") ||
        "Racing bet",
      status: bet.status,
      tone: toneFromAmount(tipAmount, bet.status),
    });
  }

  if (cumulative.length > 0) {
    const firstT = cumulative[0]!.t;
    cumulative.unshift({
      t: Math.max(dayStart, firstT - 60 * 60 * 1000),
      value: 0,
    });
  }

  const markers = buildPnlChartMarkers(markerSources);

  return { total, openCount, settledCount, rows, cumulative, markers };
}
