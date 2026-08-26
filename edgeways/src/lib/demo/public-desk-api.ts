/**
 * Canned GET payloads for desks that do not read AppState
 * (Acca, Systems, Bet Builder, Casino, Boosts).
 */
import { buildPublicDemoState } from "@/lib/demo/public-fixture";
import { publicDemoOfferEdge, publicDemoRacingDesk } from "@/lib/demo/public-racing-desk";
import {
  buildHistoryContext,
  isHiddenHistoryFeedEntry,
  matchesHistoryFilter,
  type HistoryFilter,
} from "@/lib/history-display";
import type { AccaRunView } from "@/lib/services/acca-desk";
import type { BoostDiaryEntry } from "@/lib/services/boosts-client";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";
import type {
  AccaLegRow,
  AccaRunRow,
  AlertsInboxRow,
  BetBuilderRunRow,
  BetBuilderSelectionRow,
  SystemLegRow,
  SystemRunRow,
} from "@/lib/db/schema";

const DAY = 24 * 60 * 60 * 1000;

function t(daysAgo: number, hour = 12, now = Date.now()): number {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function accaRun(
  row: AccaRunRow,
  legs: AccaLegRow[],
  backBetType: string | null
): AccaRunView {
  return { run: row, legs, backBetType };
}

export function publicDemoAccaRuns(now = Date.now()): AccaRunView[] {
  return [
    accaRun(
      {
        id: 1,
        offerId: 12,
        label: "Paddy Power acca insurance",
        method: "insurance_legs",
        stake: 20,
        bookmaker: "Paddy Power",
        commission: 0.02,
        refundAmount: 20,
        backBetId: 40,
        wholeLayBetId: null,
        wholeLayStake: null,
        wholeLayOdds: null,
        boostPct: null,
        noLay: 0,
        muteAlerts: 0,
        status: "active",
        createdAt: t(2, 10, now),
        settledAt: null,
      },
      [
        {
          id: 1,
          runId: 1,
          seq: 1,
          label: "Arsenal",
          eventId: 1,
          sport: "football",
          market: "match_odds",
          selection: "Arsenal",
          backOdds: 1.72,
          layOdds: 1.76,
          layStake: 19.55,
          layBetId: 41,
          result: "won",
          scheduledAt: t(1, 15, now),
        },
        {
          id: 2,
          runId: 1,
          seq: 2,
          label: "Liverpool",
          eventId: 2,
          sport: "football",
          market: "match_odds",
          selection: "Liverpool",
          backOdds: 1.9,
          layOdds: 1.95,
          layStake: 18.97,
          layBetId: null,
          result: "pending",
          scheduledAt: t(-0.2, 20, now),
        },
        {
          id: 3,
          runId: 1,
          seq: 3,
          label: "Man City",
          eventId: null,
          sport: "football",
          market: "match_odds",
          selection: "Man City",
          backOdds: 1.65,
          layOdds: null,
          layStake: null,
          layBetId: null,
          result: "pending",
          scheduledAt: t(-1, 17, now),
        },
      ],
      "qualifying"
    ),
    accaRun(
      {
        id: 2,
        offerId: 8,
        label: "Sky Bet 5-fold insurance",
        method: "sequential",
        stake: 10,
        bookmaker: "Sky Bet",
        commission: 0.02,
        refundAmount: 10,
        backBetId: 42,
        wholeLayBetId: null,
        wholeLayStake: null,
        wholeLayOdds: null,
        boostPct: 20,
        noLay: 0,
        muteAlerts: 0,
        status: "completed",
        createdAt: t(18, 11, now),
        settledAt: t(12, 18, now),
      },
      [
        {
          id: 4,
          runId: 2,
          seq: 1,
          label: "Brighton",
          eventId: null,
          sport: "football",
          market: "match_odds",
          selection: "Brighton",
          backOdds: 2.1,
          layOdds: 2.16,
          layStake: 9.72,
          layBetId: 43,
          result: "won",
          scheduledAt: t(17, 15, now),
        },
        {
          id: 5,
          runId: 2,
          seq: 2,
          label: "Aston Villa",
          eventId: null,
          sport: "football",
          market: "match_odds",
          selection: "Aston Villa",
          backOdds: 1.8,
          layOdds: 1.85,
          layStake: 9.73,
          layBetId: 44,
          result: "won",
          scheduledAt: t(15, 15, now),
        },
        {
          id: 6,
          runId: 2,
          seq: 3,
          label: "Newcastle",
          eventId: null,
          sport: "football",
          market: "match_odds",
          selection: "Newcastle",
          backOdds: 2.0,
          layOdds: 2.06,
          layStake: 9.71,
          layBetId: 45,
          result: "lost",
          scheduledAt: t(13, 15, now),
        },
      ],
      "qualifying"
    ),
  ];
}

export function publicDemoSystemRuns(now = Date.now()) {
  const lucky: SystemRunRow = {
    id: 1,
    offerId: 13,
    label: "William Hill Lucky 15",
    structure: "lucky_15",
    unitStake: 1,
    lines: 15,
    totalStake: 15,
    eachWay: 1,
    placeFraction: 0.2,
    bookmaker: "William Hill",
    classification: "qualifying",
    backBetId: 50,
    status: "completed",
    createdAt: t(16, 10, now),
    settledAt: t(16, 17, now),
  };
  const luckyLegs: SystemLegRow[] = [
    {
      id: 1,
      runId: 1,
      seq: 1,
      label: "Constitution Hill",
      eventId: null,
      sport: "horse_racing",
      market: "win",
      selection: "Constitution Hill",
      oddsDecimal: 2.5,
      result: "won",
      scheduledAt: t(16, 14, now),
    },
    {
      id: 2,
      runId: 1,
      seq: 2,
      label: "State Man",
      eventId: null,
      sport: "horse_racing",
      market: "win",
      selection: "State Man",
      oddsDecimal: 3.2,
      result: "placed",
      scheduledAt: t(16, 14, now),
    },
    {
      id: 3,
      runId: 1,
      seq: 3,
      label: "Jonbon",
      eventId: null,
      sport: "horse_racing",
      market: "win",
      selection: "Jonbon",
      oddsDecimal: 2.8,
      result: "lost",
      scheduledAt: t(16, 15, now),
    },
    {
      id: 4,
      runId: 1,
      seq: 4,
      label: "Energumene",
      eventId: null,
      sport: "horse_racing",
      market: "win",
      selection: "Energumene",
      oddsDecimal: 4.0,
      result: "lost",
      scheduledAt: t(16, 15, now),
    },
  ];

  const yankee: SystemRunRow = {
    id: 2,
    offerId: 16,
    label: "Coral Yankee",
    structure: "yankee",
    unitStake: 2,
    lines: 11,
    totalStake: 22,
    eachWay: 0,
    placeFraction: null,
    bookmaker: "Coral",
    classification: "ev_play",
    backBetId: 51,
    status: "active",
    createdAt: t(0, 9, now),
    settledAt: null,
  };
  const yankeeLegs: SystemLegRow[] = [
    {
      id: 5,
      runId: 2,
      seq: 1,
      label: "Baaeed",
      eventId: 3,
      sport: "horse_racing",
      market: "win",
      selection: "Baaeed",
      oddsDecimal: 2.2,
      result: "pending",
      scheduledAt: t(0, 15, now),
    },
    {
      id: 6,
      runId: 2,
      seq: 2,
      label: "Emily Upjohn",
      eventId: 3,
      sport: "horse_racing",
      market: "win",
      selection: "Emily Upjohn",
      oddsDecimal: 3.5,
      result: "pending",
      scheduledAt: t(0, 15, now),
    },
    {
      id: 7,
      runId: 2,
      seq: 3,
      label: "Nashwa",
      eventId: null,
      sport: "horse_racing",
      market: "win",
      selection: "Nashwa",
      oddsDecimal: 4.33,
      result: "pending",
      scheduledAt: t(0, 15, now),
    },
    {
      id: 8,
      runId: 2,
      seq: 4,
      label: "Inspiral",
      eventId: null,
      sport: "horse_racing",
      market: "win",
      selection: "Inspiral",
      oddsDecimal: 5.0,
      result: "pending",
      scheduledAt: t(0, 16, now),
    },
  ];

  return [
    {
      run: yankee,
      legs: yankeeLegs,
      backBetType: "qualifying",
      campaignProfit: 0,
    },
    {
      run: lucky,
      legs: luckyLegs,
      backBetType: "qualifying",
      campaignProfit: 48.2,
    },
  ];
}

export function publicDemoBetBuilderRuns(now = Date.now()) {
  const active: BetBuilderRunRow = {
    id: 1,
    offerId: 17,
    label: "Arsenal BB: win + BTTS + over 2.5",
    method: "combined",
    stake: 20,
    bookmaker: "Bet365",
    commission: 0.02,
    backOdds: 6.5,
    backBetId: 60,
    wholeLayBetId: 61,
    wholeLayStake: 18.4,
    wholeLayOdds: 7.0,
    eventLabel: "Arsenal vs Chelsea",
    eventId: 1,
    sport: "football",
    scheduledAt: t(0, 15, now),
    muteAlerts: 0,
    status: "active",
    createdAt: t(0, 12, now),
    settledAt: null,
  };
  const activeSels: BetBuilderSelectionRow[] = [
    {
      id: 1,
      runId: 1,
      seq: 1,
      label: "Arsenal to win",
      market: "match_odds",
      selection: "Arsenal",
      result: "pending",
    },
    {
      id: 2,
      runId: 1,
      seq: 2,
      label: "Both teams to score",
      market: "btts",
      selection: "Yes",
      result: "pending",
    },
    {
      id: 3,
      runId: 1,
      seq: 3,
      label: "Over 2.5 goals",
      market: "over_under",
      selection: "Over 2.5",
      result: "pending",
    },
  ];

  const done: BetBuilderRunRow = {
    id: 2,
    offerId: 14,
    label: "Liverpool BB: win + Saka anytime",
    method: "combined",
    stake: 15,
    bookmaker: "Sky Bet",
    commission: 0.02,
    backOdds: 5.2,
    backBetId: 62,
    wholeLayBetId: 63,
    wholeLayStake: 13.9,
    wholeLayOdds: 5.6,
    eventLabel: "Liverpool vs Spurs",
    eventId: null,
    sport: "football",
    scheduledAt: t(9, 17, now),
    muteAlerts: 0,
    status: "completed",
    createdAt: t(9, 12, now),
    settledAt: t(9, 19, now),
  };
  const doneSels: BetBuilderSelectionRow[] = [
    {
      id: 4,
      runId: 2,
      seq: 1,
      label: "Liverpool to win",
      market: "match_odds",
      selection: "Liverpool",
      result: "won",
    },
    {
      id: 5,
      runId: 2,
      seq: 2,
      label: "Salah anytime scorer",
      market: "anytime_scorer",
      selection: "Salah",
      result: "won",
    },
  ];

  return [
    { run: active, selections: activeSels, backBetType: "qualifying" },
    { run: done, selections: doneSels, backBetType: "qualifying" },
  ];
}

export function publicDemoCasinoOffers(now = Date.now()): CasinoOfferSummary[] {
  return [
    {
      id: 1,
      casino: "Bet365 Casino",
      title: "£20 deposit, 50 free spins",
      bonusAmount: 20,
      wageringMultiplier: 40,
      rtp: 0.96,
      contributionPct: 1,
      status: "completed",
      expectedEv: 8.4,
      actualProfit: 12.6,
      notes: null,
      game: "Book of Dead",
      expiresAt: null,
      seriesId: null,
      instanceDate: null,
      offerUrl: null,
      createdAt: t(11, 14, now),
      completedAt: t(10, 21, now),
      components: [],
      evBasis: "estimated",
    },
    {
      id: 2,
      casino: "Sky Vegas",
      title: "£10 bonus, 30x wagering",
      bonusAmount: 10,
      wageringMultiplier: 30,
      rtp: 0.95,
      contributionPct: 1,
      status: "active",
      expectedEv: 4.2,
      actualProfit: null,
      notes: null,
      game: "Starburst",
      expiresAt: t(-3, 23, now),
      seriesId: null,
      instanceDate: null,
      offerUrl: null,
      createdAt: t(1, 11, now),
      completedAt: null,
      components: [],
      evBasis: "heuristic",
    },
  ];
}

export function publicDemoBoosts(now = Date.now()): BoostDiaryEntry[] {
  return [
    {
      id: 1,
      label: "Arsenal boosted to 6/4",
      bookmaker: "Sky Bet",
      kind: "boost",
      boostedOdds: 2.5,
      fairOdds: 2.1,
      stake: 10,
      evGbp: 1.9,
      basis: "estimated",
      betId: null,
      layStake: 11.9,
      layOdds: 2.14,
      commission: 0.02,
      exchangeId: null,
      exchangeBack: 2.12,
      outcome: null,
      actualProfit: null,
      createdAt: t(0, 11, now),
      settledAt: null,
      stage: "logged",
      linkedBet: null,
    },
    {
      id: 2,
      label: "Liverpool win boost",
      bookmaker: "Paddy Power",
      kind: "boost",
      boostedOdds: 2.2,
      fairOdds: 1.95,
      stake: 15,
      evGbp: 1.92,
      basis: "estimated",
      betId: 70,
      layStake: 16.8,
      layOdds: 1.99,
      commission: 0.02,
      exchangeId: null,
      exchangeBack: 1.97,
      outcome: "won",
      actualProfit: 3.4,
      createdAt: t(8, 12, now),
      settledAt: t(8, 19, now),
      stage: "placed",
      linkedBet: {
        id: 70,
        status: "won",
        actualProfit: 3.4,
        expectedProfit: 1.92,
        backStake: 15,
        backOdds: 2.2,
        layStake: 16.8,
        layOdds: 1.99,
        commission: 0.02,
        bookmaker: "Paddy Power",
        exchangeId: null,
        label: "Liverpool win boost",
      },
    },
  ];
}

export function publicDemoFreeBetLots(now = Date.now()) {
  return [
    {
      id: 1,
      accountId: 2,
      accountName: "Bet365",
      originalAmount: 30,
      remaining: 30,
      note: "Bet £10 get £30",
      createdAt: t(5, 11, now),
      betId: null,
      expiresAt: t(-6, 12, now),
    },
    {
      id: 2,
      accountId: 3,
      accountName: "William Hill",
      originalAmount: 10,
      remaining: 10,
      note: "Reload free bet",
      createdAt: t(4, 14, now),
      betId: null,
      expiresAt: t(-3, 18, now),
    },
    {
      id: 3,
      accountId: 5,
      accountName: "Sky Bet",
      originalAmount: 20,
      remaining: 20,
      note: "Bet £20 get £20",
      createdAt: t(8, 11, now),
      betId: null,
      expiresAt: t(-4, 12, now),
    },
    {
      id: 4,
      accountId: 6,
      accountName: "Paddy Power",
      originalAmount: 15,
      remaining: 15,
      note: "Acca insurance leftover",
      createdAt: t(3, 10, now),
      betId: null,
      expiresAt: null,
    },
    {
      id: 5,
      accountId: 9,
      accountName: "Ladbrokes",
      originalAmount: 25,
      remaining: 25,
      note: "Place refund",
      createdAt: t(2, 16, now),
      betId: null,
      expiresAt: t(-2, 18, now),
    },
  ];
}

function publicDemoAccountTxs(accountId: number, now: number) {
  const rows = [
    { id: 1, accountId: 2, amount: 200, category: "top_up", note: "Bank transfer in", createdAt: t(27, 10, now) },
    { id: 2, accountId: 2, amount: -10, category: "bet_stake", note: "Qualifying · Bet £10 get £30", createdAt: t(24, 12, now) },
    { id: 3, accountId: 2, amount: 30, category: "free_bet", note: "Free bet promo - Bet £10 get £30", createdAt: t(22, 18, now) },
    { id: 4, accountId: 3, amount: 150, category: "top_up", note: "Bank transfer in", createdAt: t(26, 11, now) },
    { id: 5, accountId: 3, amount: 10, category: "free_bet", note: "Reload free bet", createdAt: t(4, 14, now) },
    { id: 6, accountId: 5, amount: 20, category: "free_bet", note: "Bet £20 get £20", createdAt: t(8, 11, now) },
    { id: 7, accountId: 6, amount: 15, category: "free_bet", note: "Acca insurance leftover", createdAt: t(3, 10, now) },
    { id: 8, accountId: 7, amount: 400, category: "top_up", note: "Exchange float", createdAt: t(28, 9, now) },
    { id: 9, accountId: 7, amount: -48.5, category: "bet_stake", note: "Lay · Baaeed", createdAt: t(0, 8, now) },
    { id: 10, accountId: 9, amount: 25, category: "free_bet", note: "Place refund", createdAt: t(2, 16, now) },
    { id: 11, accountId: 1, amount: -200, category: "transfer", note: "To Bet365", createdAt: t(27, 10, now) },
    { id: 12, accountId: 11, amount: 150, category: "top_up", note: "Betdaq float", createdAt: t(26, 9, now) },
  ];
  return rows
    .filter((row) => row.accountId === accountId)
    .map((row) => ({ ...row, pending: 0 }));
}

const HISTORY_FILTERS: HistoryFilter[] = [
  "all",
  "bets",
  "placed",
  "settlements",
  "casino",
  "free_bets",
  "match_events",
  "racing",
  "boosts",
];

function publicDemoHistoryPayload(path: string, now: number) {
  const query = path.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  const filterParam = params.get("filter") ?? "all";
  const filter = HISTORY_FILTERS.includes(filterParam as HistoryFilter)
    ? (filterParam as HistoryFilter)
    : "all";
  const limit = Math.min(Number(params.get("limit") ?? 200) || 200, 500);
  const state = buildPublicDemoState("edge", now);
  const offerTitles = state.offers.map((o) => ({ id: o.id, title: o.title }));
  const context = buildHistoryContext(
    state.events,
    state.bets,
    state.promoAwards,
    offerTitles,
    state.history
  );
  let entries = state.history.filter((e) => !isHiddenHistoryFeedEntry(e, context));
  if (filter !== "all") {
    entries = entries.filter((e) => matchesHistoryFilter(e, filter, context));
  }
  return {
    entries: entries.slice(0, limit),
    events: state.events,
    bets: state.bets,
    promoAwards: state.promoAwards,
    offerTitles,
    filter,
  };
}

function pathAndDate(path: string): { pathname: string; date: string } {
  const [pathname, query = ""] = path.split("?");
  const date =
    new URLSearchParams(query).get("date") ?? new Date().toISOString().slice(0, 10);
  return { pathname: pathname ?? path, date };
}

/** Canned Alerts page for the public demo. Never written to a live desk. */
export function publicDemoAlertsInbox(now = Date.now()): AlertsInboxRow[] {
  const raisedAt = t(0, 9, now);
  return [
    {
      id: 1,
      dedupe: "naked_exposure:40",
      kind: "naked_exposure",
      title: "⚠️ Lay missing · full stake exposed",
      body: "Qualifying · Acca insurance, 3-fold (Paddy Power)",
      href: "/tracker?highlight=40",
      createdAt: raisedAt,
      updatedAt: raisedAt,
      readAt: null,
    },
    {
      id: 2,
      dedupe: "naked_exposure:80",
      kind: "naked_exposure",
      title: "⚠️ Lay missing · full stake exposed",
      body: "Qualifying · Yankee on the card (Coral)",
      href: "/tracker?highlight=80",
      createdAt: raisedAt,
      updatedAt: raisedAt,
      readAt: null,
    },
    {
      id: 3,
      dedupe: "two_up_lock:1",
      kind: "two_up_lock",
      title: "🔒 2UP · hedge the lay",
      body: "Arsenal vs Chelsea · early payout is in",
      href: "/tracker?highlight=1",
      createdAt: raisedAt,
      updatedAt: raisedAt,
      readAt: null,
    },
  ];
}

export function publicDemoApiGet(path: string, now = Date.now()): unknown | undefined {
  const { pathname, date } = pathAndDate(path);
  if (pathname === "/api/alerts") return { alerts: publicDemoAlertsInbox(now) };
  if (pathname === "/api/racing/desk") return publicDemoRacingDesk(date);
  if (pathname === "/api/offers/edge") return publicDemoOfferEdge(date);
  if (pathname === "/api/history") return publicDemoHistoryPayload(path, now);
  if (path === "/api/acca") return { runs: publicDemoAccaRuns(now) };
  if (path === "/api/systems") return { runs: publicDemoSystemRuns(now) };
  if (path === "/api/bet-builder") return { runs: publicDemoBetBuilderRuns(now) };
  if (path === "/api/casino") return { offers: publicDemoCasinoOffers(now) };
  if (path === "/api/boosts") return { entries: publicDemoBoosts(now) };
  if (path === "/api/accounts/free-bets") return { lots: publicDemoFreeBetLots(now) };
  if (pathname === "/api/exchange/football-odds") {
    return {
      status: "unmatched",
      odds: {},
      missing: [
        "home back",
        "draw back",
        "away back",
        "home lay",
        "away lay",
        "Over 2.5",
        "BTTS Yes",
      ],
      error: "Betfair prices are not available on the public demo.",
    };
  }
  const accountMatch = path.match(/^\/api\/accounts\/(\d+)$/);
  if (accountMatch) {
    const id = Number(accountMatch[1]);
    const account = buildPublicDemoState("edge", now).balances.accounts.find(
      (row) => row.id === id
    );
    if (!account) return { error: "Not found" };
    return {
      account,
      transactions: publicDemoAccountTxs(id, now),
      freeBetLots: publicDemoFreeBetLots(now).filter((lot) => lot.accountId === id),
    };
  }
  return undefined;
}
