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

export type RacingPnlCampaignKind = "acca" | "bet_builder" | "systems";

/**
 * One Acca / Bet Builder / Systems ticket for Racing Desk day P&L.
 * Linked back/lay rows are excluded from the per-bet loop so the campaign
 * net is counted once.
 */
export type RacingPnlCampaignInput = {
  id: number;
  kind: RacingPnlCampaignKind;
  label: string;
  status: string;
  /** Back + lays once the run has settled. */
  settledProfit: number | null;
  /** Square / worst-case while the run is still active. */
  openProfit: number | null;
  linkedBetIds: number[];
  /** Linked fixture ids (legs or the Bet Builder event). */
  eventIds: number[];
  /** Legs that already have a result (not pending). */
  decidedEventIds?: number[];
};

export type RacingPnlRowKind = "race" | "campaign";

export type RacingPnlRaceRow = {
  rowId: string;
  kind: RacingPnlRowKind;
  campaignKind?: RacingPnlCampaignKind;
  campaignId?: number;
  /** Distinct horse-racing events on the campaign (1 = same-race ticket). */
  spanCount?: number;
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
   * Markers keep the prior-plateau Y; X sits just before this tip so a later
   * race is not drawn on an earlier off-time.
   */
  cumulative: Array<{ t: number; value: number }>;
  /** Win/loss markers for the day chart (prior Y, own-tip X). */
  markers: ChartBetMarker[];
};

export const RACING_PNL_CAMPAIGN_COURSE: Record<RacingPnlCampaignKind, string> = {
  acca: "Acca",
  bet_builder: "Bet builder",
  systems: "System",
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

function campaignChartId(kind: RacingPnlCampaignKind, id: number): number {
  const base = kind === "acca" ? 1_000_000 : kind === "bet_builder" ? 2_000_000 : 3_000_000;
  return -(base + id);
}

function sortHorseEvents(events: RacingPnlEventInput[]): RacingPnlEventInput[] {
  return events.slice().sort((a, b) => a.startTime - b.startTime || a.id - b.id);
}

function campaignContribution(
  campaign: RacingPnlCampaignInput
): { amount: number; open: boolean } | null {
  if (campaign.status === "abandoned") return null;
  if (campaign.status === "active") {
    if (campaign.openProfit == null) return null;
    return { amount: campaign.openProfit, open: true };
  }
  if (campaign.status === "completed") {
    if (campaign.settledProfit == null) return null;
    return { amount: campaign.settledProfit, open: false };
  }
  return null;
}

/**
 * Horse-racing P&L attributed to the local calendar day of the race
 * (`event.startTime`), not when the user entered the result.
 *
 * - Settled singles on that day's races → `actualProfit`
 * - Open singles on that day's races → worst-case `expectedProfit`
 * - Acca / Systems / Bet Builder → one ticket (campaign net or square).
 *   Linked back/lay rows are excluded. Multi-race tickets get their own
 *   breakdown line and plot at the last racing leg that day. Completed
 *   multi-day tickets sit on the last decided racing-leg day only.
 * - Void / other sports / races on other days → excluded
 *
 * `day` is Unix ms (defaults to now) or a desk `YYYY-MM-DD` date key.
 */
export function racingPnlToday(
  bets: RacingPnlBetInput[],
  events: RacingPnlEventInput[],
  day: number | string = Date.now(),
  campaigns: RacingPnlCampaignInput[] = []
): number {
  return racingPnlByRace(bets, events, day, campaigns).total;
}

/**
 * Per-race breakdown + per-bet cumulative series/markers for Racing Desk
 * “P&L today”. Same attribution rules as {@link racingPnlToday}.
 */
export function racingPnlByRace(
  bets: RacingPnlBetInput[],
  events: RacingPnlEventInput[],
  day: number | string = Date.now(),
  campaigns: RacingPnlCampaignInput[] = []
): RacingPnlDayReport {
  const { dayStart, dayEnd } = racingDayBounds(day);

  const horseEvents = sortHorseEvents(
    events.filter((e) => e.sport === "horse_racing")
  );
  const horseById = new Map(horseEvents.map((e) => [e.id, e]));

  const todayHorseEvents = horseEvents.filter(
    (e) => e.startTime >= dayStart && e.startTime < dayEnd
  );
  const eventById = new Map(todayHorseEvents.map((e) => [e.id, e]));

  const linkedBetIds = new Set<number>();
  for (const campaign of campaigns) {
    for (const id of campaign.linkedBetIds) linkedBetIds.add(id);
  }

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
    if (linkedBetIds.has(bet.id)) continue;
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

  const campaignRows: RacingPnlRaceRow[] = [];

  for (const campaign of campaigns) {
    const racingAll = sortHorseEvents(
      campaign.eventIds
        .map((id) => horseById.get(id))
        .filter((e): e is RacingPnlEventInput => e != null)
    );
    const onDay = racingAll.filter(
      (e) => e.startTime >= dayStart && e.startTime < dayEnd
    );
    if (onDay.length === 0) continue;

    const decidedIds = new Set(campaign.decidedEventIds ?? []);
    const racingDecided = racingAll.filter((e) => decidedIds.has(e.id));

    if (campaign.status === "completed") {
      const attr = racingDecided.at(-1);
      if (!attr || attr.startTime < dayStart || attr.startTime >= dayEnd) continue;
    } else if (campaign.status !== "active") {
      continue;
    }

    const valued = campaignContribution(campaign);
    if (valued == null) continue;

    const plotEvent = onDay[onDay.length - 1]!;
    const amount = roundPence(valued.amount);
    const open = valued.open;
    const status: BetRow["status"] = open ? "open" : amount < -0.004 ? "lost" : "won";

    ledgerBets.push({
      bet: {
        id: campaignChartId(campaign.kind, campaign.id),
        label: campaign.label,
        actualProfit: open ? null : amount,
        expectedProfit: open ? amount : amount,
        status,
        eventId: plotEvent.id,
      },
      event: plotEvent,
      amount,
    });

    if (racingAll.length === 1) {
      const acc = byEvent.get(plotEvent.id) ?? {
        profit: 0,
        betCount: 0,
        openCount: 0,
        settledCount: 0,
      };
      acc.profit = roundPence(acc.profit + amount);
      acc.betCount += 1;
      if (open) acc.openCount += 1;
      else acc.settledCount += 1;
      byEvent.set(plotEvent.id, acc);
      continue;
    }

    const offTime = (plotEvent.awayTeam ?? "").trim() || null;
    campaignRows.push({
      rowId: `campaign:${campaign.kind}:${campaign.id}`,
      kind: "campaign",
      campaignKind: campaign.kind,
      campaignId: campaign.id,
      spanCount: racingAll.length,
      eventId: plotEvent.id,
      raceExternalId: plotEvent.externalId ?? null,
      startTime: plotEvent.startTime,
      course: RACING_PNL_CAMPAIGN_COURSE[campaign.kind],
      raceName: campaign.label.trim() || RACING_PNL_CAMPAIGN_COURSE[campaign.kind],
      offTime,
      profit: amount,
      betCount: 1,
      openCount: open ? 1 : 0,
      settledCount: open ? 0 : 1,
    });
  }

  // Race off-time order, then bet id — same race gets 1s tip stagger so each
  // bet has its own series tip (Home: chart moves after the marker).
  ledgerBets.sort(
    (a, b) => a.event.startTime - b.event.startTime || a.bet.id - b.bet.id
  );

  const rows: RacingPnlRaceRow[] = [];

  for (const ev of todayHorseEvents) {
    const acc = byEvent.get(ev.id);
    if (!acc) continue;

    const course = (ev.competition ?? "").trim() || "Race";
    const raceName = (ev.homeTeam ?? "").trim() || "Race";
    const offTime = (ev.awayTeam ?? "").trim() || null;

    rows.push({
      rowId: `race:${ev.id}`,
      kind: "race",
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

  rows.push(...campaignRows);
  rows.sort(
    (a, b) =>
      a.startTime - b.startTime ||
      (a.kind === "race" ? 0 : 1) - (b.kind === "race" ? 0 : 1) ||
      a.eventId - b.eventId ||
      (a.campaignId ?? 0) - (b.campaignId ?? 0)
  );

  let total = 0;
  let openCount = 0;
  let settledCount = 0;
  for (const row of rows) {
    total = roundPence(total + row.profit);
    openCount += row.openCount;
    settledCount += row.settledCount;
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

  const markers = sitRacingDayMarkersAtOwnTip(buildPnlChartMarkers(markerSources));

  return { total, openCount, settledCount, rows, cumulative, markers };
}

/**
 * Home parks later markers on the previous tip's timestamp (left of the
 * plateau). On a race-day chart that puts a 15:17 acca on the 14:05 step.
 * Keep the prior-plateau Y; move X to one second before this tip.
 */
function sitRacingDayMarkersAtOwnTip(
  markers: ChartBetMarker[]
): ChartBetMarker[] {
  return markers.map((marker) => {
    const eventTimeSec = marker.eventTimeSec ?? marker.settledAtSec;
    return { ...marker, settledAtSec: eventTimeSec - 1 };
  });
}
