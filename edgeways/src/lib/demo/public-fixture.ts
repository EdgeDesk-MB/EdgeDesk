/**
 * Canned AppState for public /demo (EDGE-59).
 * Lived-in month: football 2UP, racing place-refund, Acca / System / BB.
 * Never written to SQLite.
 */
import type { AccountBalance } from "@/lib/services/balances.types";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { AppState, LivePosition } from "@/lib/services/state.types";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import { commissionPaidOnSettledBet } from "@/lib/calc/commission-paid";
import { DEFAULT_SETTINGS } from "@/lib/services/settings-shared";
import type { PublicDemoView } from "@/lib/demo/public-demo";
import { buildHistoryContext, sortHistoryEntries } from "@/lib/history-display";

const DAY = 24 * 60 * 60 * 1000;

function t(daysAgo: number, hour = 12, now = Date.now()): number {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function account(
  id: number,
  name: string,
  type: AccountBalance["type"],
  balance: number,
  accessStatus: AccountBalance["accessStatus"],
  createdAt: number,
  extras: Partial<AccountBalance> = {}
): AccountBalance {
  return {
    id,
    name,
    type,
    exchangeId: null,
    fundedByAccountId: type === "bookie" ? 1 : null,
    brandColor: null,
    owner: "me",
    isActive: 1,
    accessStatus,
    notes: null,
    wrRemaining: 0,
    wrMinOdds: null,
    wrType: "stake",
    health: null,
    healthUpdatedAt: null,
    createdAt,
    balance,
    freeBets: 0,
    pendingIn: 0,
    ...extras,
  };
}

function profit(input: {
  qualifying: number;
  freeBet?: number;
  awarded?: number;
  stage?: OfferSummary["profit"]["freeBetStage"];
  openExpected?: number;
}): OfferSummary["profit"] {
  const freeBet = input.freeBet ?? 0;
  const total = input.qualifying + freeBet + (input.openExpected ?? 0);
  return {
    qualifyingProfit: input.qualifying,
    qualifyingSettledCount: 1,
    qualifyingOpenCount: input.openExpected ? 1 : 0,
    freeBetAwarded: (input.awarded ?? 0) > 0,
    freeBetAwardAmount: input.awarded ?? null,
    freeBetAwardReason: input.awarded ? "offer" : null,
    freeBetStage: input.stage ?? (input.awarded ? "settled" : "none"),
    freeBetProfit: freeBet,
    freeBetOpenCount: 0,
    freeBetSettledCount: freeBet !== 0 ? 1 : 0,
    openExpectedProfit: input.openExpected ?? 0,
    totalProfit: total,
  };
}

function offer(input: {
  id: number;
  title: string;
  bookmaker: string;
  status: OfferSummary["status"];
  sport: OfferSummary["sport"];
  offerType: string | null;
  expected: number;
  actual: number;
  createdAt: number;
  completedAt: number | null;
  expiresAt: number | null;
  betCount: number;
  openBets: number;
  profit: OfferSummary["profit"];
  rules?: string | null;
  scopeCourse?: string | null;
  eventDate?: string | null;
}): OfferSummary {
  const capture =
    input.status === "completed" && input.expected !== 0
      ? input.actual / input.expected
      : null;
  return {
    id: input.id,
    bookmaker: input.bookmaker,
    title: input.title,
    description: null,
    expectedProfit: input.expected,
    status: input.status,
    expiresAt: input.expiresAt,
    createdAt: input.createdAt,
    completedAt: input.completedAt,
    startsOn: null,
    sport: input.sport,
    offerType: input.offerType,
    scopeCourse: input.scopeCourse ?? null,
    eventDate: input.eventDate ?? null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    rules: input.rules ?? null,
    seriesId: null,
    instanceDate: null,
    source: null,
    offerUrl: null,
    betCount: input.betCount,
    openBets: input.openBets,
    actualProfit: input.actual,
    expectedFromBets: input.expected,
    profit: input.profit,
    evLock:
      input.status === "completed"
        ? {
            expectedProfit: input.expected,
            basis: "estimated",
            version: 1,
            capturePct: capture,
            realizedProfit: input.actual,
            lockedAt: input.createdAt,
            mistakeTag: null,
          }
        : null,
  };
}

function event(row: EventRow): EventRow {
  return row;
}

function bet(row: Omit<BetRow, "exchangeId" | "earlyPayout" | "refundAmount" | "refundRetention" | "legs" | "triggerText" | "triggerRule" | "notes" | "quickLogged" | "source" | "purpose" | "importFingerprint" | "importMeta"> & Partial<BetRow>): BetRow {
  return {
    exchangeId: null,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    notes: null,
    quickLogged: null,
    source: null,
    purpose: null,
    importFingerprint: null,
    importMeta: null,
    ...row,
  };
}

function history(row: HistoryRow): HistoryRow {
  return row;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Same cumulative path the Home chart markers use (settled bets + casino). */
export function buildDemoPnlSeries(
  bets: BetRow[],
  casinoSettlements: AppState["casinoSettlements"],
  adjustments: AppState["pnlAdjustments"] = []
): AppState["series"] {
  const points = [
    ...bets
      .filter((b) => b.status !== "open" && b.status !== "void" && b.actualProfit != null)
      .map((b) => ({
        time: b.settledAt ?? b.createdAt,
        profit: b.actualProfit!,
        commission: commissionPaidOnSettledBet(b),
      })),
    ...casinoSettlements.map((c) => ({
      time: c.time,
      profit: c.amount,
      commission: 0,
    })),
    ...adjustments.map((a) => ({
      time: a.time,
      profit: a.amount,
      commission: 0,
    })),
  ].sort((a, b) => a.time - b.time);

  let running = 0;
  let commissionRunning = 0;
  return points.map((p) => {
    running += p.profit;
    commissionRunning += p.commission;
    return {
      time: p.time,
      value: roundMoney(running),
      commissionPaid: roundMoney(commissionRunning),
    };
  });
}

function betsForCompletedOffer(row: OfferSummary, id: number, now: number): BetRow[] {
  const sport = row.sport === "horse_racing" ? "horse_racing" : "football";
  const twoUp = row.title.includes("2UP");
  const awarded = row.profit.freeBetAwarded;
  const stake = awarded
    ? row.profit.freeBetAwardAmount ?? 20
    : twoUp
      ? 20
      : 15;
  const qualSettled = awarded ? row.createdAt + 2 * 60 * 60 * 1000 : (row.completedAt ?? row.createdAt);
  const qual = bet({
    id,
    eventId: row.id === 10 ? 4 : null,
    label: twoUp ? `${row.title} · ${row.bookmaker}` : `${row.title} · qualifying`,
    market: sport === "horse_racing" ? "win" : "match_odds",
    selection: row.id === 10 ? "Man City" : row.id === 4 ? "Constitution Hill" : "",
    betType: "qualifying",
    bookmaker: row.bookmaker,
    backStake: stake,
    backOdds: twoUp ? 1.8 : 2.5,
    layStake: roundMoney(stake * 0.97),
    layOdds: twoUp ? 1.85 : 2.6,
    commission: 0.02,
    status: twoUp ? "early_payout" : row.profit.qualifyingProfit >= 0 ? "won" : "lost",
    expectedProfit: row.expectedProfit,
    actualProfit: row.profit.qualifyingProfit,
    balanceLedgered: 1,
    balanceSettled: 1,
    createdAt: row.createdAt,
    settledAt: qualSettled,
    offerId: row.id,
    sport,
  });
  if (!awarded) return [qual];
  const fbStake = row.profit.freeBetAwardAmount ?? 20;
  return [
    qual,
    bet({
      id: id + 1,
      eventId: null,
      label: `${row.title} · free bet`,
      market: sport === "horse_racing" ? "win" : "match_odds",
      selection: row.id === 4 ? "State Man" : "",
      betType: "free_snr",
      bookmaker: row.bookmaker,
      backStake: fbStake,
      backOdds: 5,
      layStake: roundMoney(fbStake * 0.82),
      layOdds: 5.4,
      commission: 0.02,
      status: "won",
      expectedProfit: roundMoney(fbStake * 0.8),
      actualProfit: row.profit.freeBetProfit,
      balanceLedgered: 1,
      balanceSettled: 1,
      createdAt: row.createdAt + DAY,
      settledAt: row.completedAt ?? now,
      offerId: row.id,
      sport,
    }),
  ];
}

const PLACE_REFUND_RULES = JSON.stringify({
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [2, 3, 4],
  betStake: 50,
  freeBetAmount: 50,
});

export function buildPublicDemoState(
  view: PublicDemoView,
  now = Date.now()
): AppState {
  const accounts: AccountBalance[] = [
    account(1, "Demo Bank", "bank", 780, "available", t(28, 12, now)),
    account(2, "Bet365", "bookie", 120, "available", t(28, 12, now), { freeBets: 30 }),
    account(3, "William Hill", "bookie", 70, "available", t(28, 12, now), { freeBets: 10 }),
    account(4, "Coral", "bookie", 0, "gubbed", t(28, 12, now)),
    account(5, "Sky Bet", "bookie", 55, "available", t(28, 12, now), { freeBets: 20 }),
    account(6, "Paddy Power", "bookie", 80, "available", t(21, 12, now), { freeBets: 15 }),
    account(7, "Betfair", "exchange", 250, "available", t(28, 12, now)),
    account(8, "Betfair Sportsbook", "bookie", 40, "available", t(22, 12, now)),
    account(9, "Ladbrokes", "bookie", 45, "available", t(20, 12, now), {
      freeBets: 25,
      pendingIn: 20,
    }),
    account(10, "Unibet", "bookie", 30, "available", t(18, 12, now), {
      health: "cooling",
      healthUpdatedAt: t(3, 10, now),
      wrRemaining: 40,
      wrMinOdds: 1.5,
    }),
    account(11, "Betdaq", "exchange", 150, "available", t(26, 12, now)),
  ];

  const events: EventRow[] = [
    event({
      id: 1,
      sport: "football",
      externalId: "demo-ars-che",
      competition: "Premier League",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      startTime: t(0, 15, now),
      status: "live",
      homeScore: 2,
      awayScore: 0,
      minute: 67,
      homeLed2: 1,
      awayLed2: 0,
      source: "sim",
      goals: JSON.stringify([
        { minute: 12, side: "home" },
        { minute: 41, side: "home" },
      ]),
      ftHomeScore: null,
      ftAwayScore: null,
      matchEnding: null,
      period: null,
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
      simScript: null,
      simStartedAt: t(0, 15, now),
      createdAt: t(1, 9, now),
    }),
    event({
      id: 2,
      sport: "football",
      externalId: "demo-liv-tot",
      competition: "Premier League",
      homeTeam: "Liverpool",
      awayTeam: "Spurs",
      startTime: t(-0.1, 20, now),
      status: "upcoming",
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      homeLed2: 0,
      awayLed2: 0,
      source: "manual",
      goals: null,
      ftHomeScore: null,
      ftAwayScore: null,
      matchEnding: null,
      period: null,
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
      simScript: null,
      simStartedAt: null,
      createdAt: t(2, 9, now),
    }),
    event({
      id: 3,
      sport: "horse_racing",
      externalId: "demo-newm-1500",
      competition: "Newmarket",
      homeTeam: "15:00 Newmarket",
      awayTeam: "Baaeed",
      startTime: t(0, 15, now),
      status: "upcoming",
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      homeLed2: 0,
      awayLed2: 0,
      source: "manual",
      goals: null,
      ftHomeScore: null,
      ftAwayScore: null,
      matchEnding: null,
      period: null,
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
      simScript: null,
      simStartedAt: null,
      createdAt: t(0, 8, now),
    }),
    event({
      id: 4,
      sport: "football",
      externalId: "demo-mci-new",
      competition: "Premier League",
      homeTeam: "Man City",
      awayTeam: "Newcastle",
      startTime: t(6, 17, now),
      status: "finished",
      homeScore: 3,
      awayScore: 1,
      minute: 90,
      homeLed2: 1,
      awayLed2: 0,
      source: "manual",
      goals: JSON.stringify([
        { minute: 8, side: "home" },
        { minute: 22, side: "home" },
        { minute: 71, side: "away" },
        { minute: 84, side: "home" },
      ]),
      ftHomeScore: 3,
      ftAwayScore: 1,
      matchEnding: "ft",
      period: null,
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
      simScript: null,
      simStartedAt: null,
      createdAt: t(7, 9, now),
    }),
  ];

  const offers: OfferSummary[] = [
    offer({
      id: 1,
      title: "Bet £10 get £30 in free bets",
      bookmaker: "Bet365",
      status: "completed",
      sport: "sports",
      offerType: "promo_terms",
      expected: 22.5,
      actual: 21.1,
      createdAt: t(24, 12, now),
      completedAt: t(22, 18, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -1.8, freeBet: 22.9, awarded: 30, stage: "settled" }),
    }),
    offer({
      id: 2,
      title: "Bet £25 get £25 free bet",
      bookmaker: "William Hill",
      status: "completed",
      sport: "sports",
      offerType: "promo_terms",
      expected: 18.75,
      actual: 17.4,
      createdAt: t(22, 12, now),
      completedAt: t(20, 18, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -2.1, freeBet: 19.5, awarded: 25, stage: "settled" }),
    }),
    offer({
      id: 3,
      title: "2UP early payout",
      bookmaker: "Paddy Power",
      status: "completed",
      sport: "football",
      offerType: "promo_terms",
      expected: 28,
      actual: 31.4,
      createdAt: t(19, 10, now),
      completedAt: t(19, 17, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: 31.4 }),
    }),
    offer({
      id: 4,
      title: "Bet £50 get £50 free bet if 2nd, 3rd or 4th",
      bookmaker: "Betfair Sportsbook",
      status: "completed",
      sport: "horse_racing",
      offerType: "bet_get_free_place",
      expected: 42,
      actual: 44.8,
      createdAt: t(18, 9, now),
      completedAt: t(18, 16, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -3.2, freeBet: 48, awarded: 50, stage: "settled" }),
      rules: PLACE_REFUND_RULES,
      scopeCourse: "all",
    }),
    offer({
      id: 5,
      title: "Bet £50 get £50 free bet if 2nd, 3rd or 4th",
      bookmaker: "Betfair Sportsbook",
      status: "completed",
      sport: "horse_racing",
      offerType: "bet_get_free_place",
      expected: 42,
      actual: 39.6,
      createdAt: t(15, 9, now),
      completedAt: t(15, 16, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -4.1, freeBet: 43.7, awarded: 50, stage: "settled" }),
      rules: PLACE_REFUND_RULES,
      scopeCourse: "all",
    }),
    offer({
      id: 6,
      title: "2UP early payout",
      bookmaker: "Paddy Power",
      status: "completed",
      sport: "football",
      offerType: "promo_terms",
      expected: 26,
      actual: 24.2,
      createdAt: t(14, 15, now),
      completedAt: t(14, 17, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: 24.2 }),
    }),
    offer({
      id: 7,
      title: "Bet £20 get £20 free bet",
      bookmaker: "Sky Bet",
      status: "completed",
      sport: "sports",
      offerType: "promo_terms",
      expected: 15,
      actual: 14.1,
      createdAt: t(13, 11, now),
      completedAt: t(12, 18, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -1.6, freeBet: 15.7, awarded: 20, stage: "settled" }),
    }),
    offer({
      id: 8,
      title: "5-fold acca insurance",
      bookmaker: "Sky Bet",
      status: "completed",
      sport: "football",
      offerType: "promo_terms",
      expected: 82,
      actual: 76.4,
      createdAt: t(18, 11, now),
      completedAt: t(12, 18, now),
      expiresAt: null,
      betCount: 4,
      openBets: 0,
      profit: profit({ qualifying: 76.4 }),
    }),
    offer({
      id: 9,
      title: "Bet £50 get £50 free bet if 2nd, 3rd or 4th",
      bookmaker: "Coral",
      status: "completed",
      sport: "horse_racing",
      offerType: "bet_get_free_place",
      expected: 40,
      actual: 41.2,
      createdAt: t(11, 9, now),
      completedAt: t(11, 16, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -2.8, freeBet: 44, awarded: 50, stage: "settled" }),
      rules: PLACE_REFUND_RULES,
      scopeCourse: "all",
    }),
    offer({
      id: 10,
      title: "2UP early payout",
      bookmaker: "Paddy Power",
      status: "completed",
      sport: "football",
      offerType: "promo_terms",
      expected: 29,
      actual: 33.8,
      createdAt: t(8, 15, now),
      completedAt: t(8, 17, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: 33.8 }),
    }),
    offer({
      id: 11,
      title: "Bet £50 get £50 free bet if 2nd, 3rd or 4th",
      bookmaker: "William Hill",
      status: "completed",
      sport: "horse_racing",
      offerType: "bet_get_free_place",
      expected: 41,
      actual: 38.9,
      createdAt: t(7, 10, now),
      completedAt: t(7, 16, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -3.6, freeBet: 42.5, awarded: 50, stage: "settled" }),
      rules: PLACE_REFUND_RULES,
      scopeCourse: "Newmarket",
    }),
    offer({
      id: 12,
      title: "Acca insurance, 3-fold",
      bookmaker: "Paddy Power",
      status: "active",
      sport: "football",
      offerType: "promo_terms",
      expected: 18,
      actual: 0,
      createdAt: t(2, 10, now),
      completedAt: null,
      expiresAt: t(-4, 22, now),
      betCount: 2,
      openBets: 1,
      profit: profit({ qualifying: 0, openExpected: 18 }),
    }),
    offer({
      id: 13,
      title: "Lucky 15, extra places",
      bookmaker: "William Hill",
      status: "completed",
      sport: "horse_racing",
      offerType: "promo_terms",
      expected: 46,
      actual: 48.2,
      createdAt: t(16, 10, now),
      completedAt: t(16, 17, now),
      expiresAt: null,
      betCount: 1,
      openBets: 0,
      profit: profit({ qualifying: 48.2 }),
    }),
    offer({
      id: 14,
      title: "Bet builder, 2 selections",
      bookmaker: "Sky Bet",
      status: "completed",
      sport: "football",
      offerType: "promo_terms",
      expected: 36,
      actual: 34.7,
      createdAt: t(9, 12, now),
      completedAt: t(9, 19, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: 34.7 }),
    }),
    offer({
      id: 15,
      title: "2UP early payout",
      bookmaker: "Paddy Power",
      status: "active",
      sport: "football",
      offerType: "promo_terms",
      expected: 22,
      actual: 0,
      createdAt: t(0, 12, now),
      completedAt: null,
      expiresAt: t(-1, 17, now),
      betCount: 1,
      openBets: 1,
      profit: profit({ qualifying: 0, openExpected: 22 }),
    }),
    offer({
      id: 16,
      title: "Yankee on the card",
      bookmaker: "Coral",
      status: "active",
      sport: "horse_racing",
      offerType: "promo_terms",
      expected: 19,
      actual: 0,
      createdAt: t(0, 9, now),
      completedAt: null,
      expiresAt: t(-1, 18, now),
      betCount: 1,
      openBets: 1,
      profit: profit({ qualifying: 0, openExpected: 19 }),
    }),
    offer({
      id: 17,
      title: "Bet builder, 3 selections",
      bookmaker: "Bet365",
      status: "active",
      sport: "football",
      offerType: "promo_terms",
      expected: 16,
      actual: 0,
      createdAt: t(0, 12, now),
      completedAt: null,
      expiresAt: t(-1, 17, now),
      betCount: 2,
      openBets: 2,
      profit: profit({ qualifying: 0, openExpected: 16 }),
    }),
    offer({
      id: 18,
      title: "Bet £50 get £50 free bet if 2nd, 3rd or 4th",
      bookmaker: "Sky Bet",
      status: "active",
      sport: "horse_racing",
      offerType: "bet_get_free_place",
      expected: 40,
      actual: 0,
      createdAt: t(0, 8, now),
      completedAt: null,
      expiresAt: t(-2, 18, now),
      betCount: 1,
      openBets: 1,
      profit: profit({ qualifying: 0, openExpected: 40 }),
      rules: PLACE_REFUND_RULES,
      scopeCourse: "all",
    }),
    offer({
      id: 19,
      title: "Bet £10 get £30 in free bets",
      bookmaker: "Bet365",
      status: "completed",
      sport: "sports",
      offerType: "promo_terms",
      expected: 22.5,
      actual: 20.8,
      createdAt: t(5, 11, now),
      completedAt: t(4, 18, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -1.9, freeBet: 22.7, awarded: 30, stage: "settled" }),
    }),
    offer({
      id: 20,
      title: "Weekend price boost",
      bookmaker: "Bet365",
      status: "completed",
      sport: "football",
      offerType: "promo_terms",
      expected: 8,
      actual: 9.4,
      createdAt: t(3, 10, now),
      completedAt: t(3, 17, now),
      expiresAt: null,
      betCount: 1,
      openBets: 0,
      profit: profit({ qualifying: 9.4 }),
    }),
    offer({
      id: 21,
      title: "Bet £50 get £50 free bet if 2nd, 3rd or 4th",
      bookmaker: "Paddy Power",
      status: "completed",
      sport: "horse_racing",
      offerType: "bet_get_free_place",
      expected: 88,
      actual: 91.2,
      createdAt: t(21, 9, now),
      completedAt: t(21, 16, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -4.4, freeBet: 95.6, awarded: 50, stage: "settled" }),
      rules: PLACE_REFUND_RULES,
      scopeCourse: "all",
    }),
    offer({
      id: 22,
      title: "2UP early payout",
      bookmaker: "Paddy Power",
      status: "completed",
      sport: "football",
      offerType: "promo_terms",
      expected: 74,
      actual: 81.6,
      createdAt: t(20, 15, now),
      completedAt: t(20, 17, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: 81.6 }),
    }),
    offer({
      id: 23,
      title: "Bet £50 get £50 free bet if 2nd, 3rd or 4th",
      bookmaker: "Sky Bet",
      status: "completed",
      sport: "horse_racing",
      offerType: "bet_get_free_place",
      expected: 86,
      actual: 84.3,
      createdAt: t(10, 9, now),
      completedAt: t(10, 16, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: -5.1, freeBet: 89.4, awarded: 50, stage: "settled" }),
      rules: PLACE_REFUND_RULES,
      scopeCourse: "all",
    }),
    offer({
      id: 24,
      title: "Acca insurance, 4-fold",
      bookmaker: "Bet365",
      status: "completed",
      sport: "football",
      offerType: "promo_terms",
      expected: 96,
      actual: 102.5,
      createdAt: t(6, 11, now),
      completedAt: t(5, 18, now),
      expiresAt: null,
      betCount: 3,
      openBets: 0,
      profit: profit({ qualifying: 102.5 }),
    }),
    offer({
      id: 25,
      title: "Bet builder, 4 selections",
      bookmaker: "Paddy Power",
      status: "completed",
      sport: "football",
      offerType: "promo_terms",
      expected: 68,
      actual: 71.8,
      createdAt: t(4, 12, now),
      completedAt: t(4, 19, now),
      expiresAt: null,
      betCount: 2,
      openBets: 0,
      profit: profit({ qualifying: 71.8 }),
    }),
    offer({
      id: 26,
      title: "Lucky 31, extra places",
      bookmaker: "Coral",
      status: "completed",
      sport: "horse_racing",
      offerType: "promo_terms",
      expected: 78,
      actual: 74.9,
      createdAt: t(2, 10, now),
      completedAt: t(2, 17, now),
      expiresAt: null,
      betCount: 1,
      openBets: 0,
      profit: profit({ qualifying: 74.9 }),
    }),
  ];

  const completedBets = offers
    .filter((row) => row.status === "completed")
    .flatMap((row, i) => betsForCompletedOffer(row, 100 + i * 2, now));

  const openBets: BetRow[] = [
    bet({
      id: 2,
      eventId: 1,
      label: "2UP Arsenal",
      market: "match_odds",
      selection: "Arsenal",
      betType: "qualifying",
      bookmaker: "Paddy Power",
      backStake: 25,
      backOdds: 1.72,
      layStake: 24.4,
      layOdds: 1.76,
      commission: 0.02,
      status: "open",
      expectedProfit: 22,
      actualProfit: null,
      balanceLedgered: 1,
      balanceSettled: 0,
      createdAt: t(0, 12, now),
      settledAt: null,
      offerId: 15,
      sport: "football",
      triggerText: "Pays if Arsenal lead by 2",
    }),
    bet({
      id: 3,
      eventId: 3,
      label: "Bet £50 get £50 · Baaeed",
      market: "win",
      selection: "Baaeed",
      betType: "qualifying",
      bookmaker: "Sky Bet",
      backStake: 50,
      backOdds: 3.2,
      layStake: 48.5,
      layOdds: 3.3,
      commission: 0.02,
      status: "open",
      expectedProfit: 40,
      actualProfit: null,
      balanceLedgered: 1,
      balanceSettled: 0,
      createdAt: t(0, 8, now),
      settledAt: null,
      offerId: 18,
      sport: "horse_racing",
    }),
    bet({
      id: 40,
      eventId: 1,
      label: "Acca · Paddy Power 3-fold",
      market: "acca",
      selection: "",
      betType: "qualifying",
      bookmaker: "Paddy Power",
      backStake: 20,
      backOdds: 5.39,
      layStake: 0,
      layOdds: 0,
      commission: 0.02,
      status: "open",
      expectedProfit: 18,
      actualProfit: null,
      balanceLedgered: 1,
      balanceSettled: 0,
      createdAt: t(2, 10, now),
      settledAt: null,
      offerId: 12,
      sport: "football",
    }),
    bet({
      id: 60,
      eventId: 1,
      label: "BB · Arsenal win + BTTS + over 2.5",
      market: "other",
      selection: "",
      betType: "qualifying",
      bookmaker: "Bet365",
      backStake: 20,
      backOdds: 6.5,
      layStake: 18.4,
      layOdds: 7.0,
      commission: 0.02,
      status: "open",
      expectedProfit: 16,
      actualProfit: null,
      balanceLedgered: 1,
      balanceSettled: 0,
      createdAt: t(0, 12, now),
      settledAt: null,
      offerId: 17,
      sport: "football",
    }),
    bet({
      id: 80,
      eventId: 3,
      label: "Yankee on the card",
      market: "system",
      selection: "",
      betType: "qualifying",
      bookmaker: "Coral",
      backStake: 10,
      backOdds: 0,
      layStake: 0,
      layOdds: 0,
      commission: 0,
      status: "open",
      expectedProfit: 19,
      actualProfit: null,
      balanceLedgered: 1,
      balanceSettled: 0,
      createdAt: t(0, 9, now),
      settledAt: null,
      offerId: 16,
      sport: "horse_racing",
    }),
  ];

  const bets: BetRow[] = [...completedBets, ...openBets];

  const casinoSettlements: AppState["casinoSettlements"] = [
    {
      id: 1,
      time: t(10, 21, now),
      amount: 12.6,
      title: "£20 deposit, 50 free spins",
      casino: "Bet365 Casino",
    },
    {
      id: 2,
      time: t(6, 22, now),
      amount: 18.4,
      title: "Reload spins",
      casino: "Sky Vegas",
    },
    {
      id: 3,
      time: t(2, 21, now),
      amount: 22.1,
      title: "Live casino cashback",
      casino: "Paddy Power Games",
    },
  ];

  const series = buildDemoPnlSeries(bets, casinoSettlements);
  const bettingProfit = roundMoney(
    bets
      .filter((b) => b.status !== "open" && b.status !== "void" && b.actualProfit != null)
      .reduce((sum, b) => sum + (b.actualProfit ?? 0), 0)
  );
  const casinoProfit = roundMoney(
    casinoSettlements.reduce((sum, row) => sum + row.amount, 0)
  );
  const settledProfit = series.at(-1)?.value ?? roundMoney(bettingProfit + casinoProfit);

  const livePositions: LivePosition[] = [
    {
      betId: 2,
      eventId: 1,
      label: "2UP Arsenal",
      eventName: "Arsenal vs Chelsea",
      eventSport: "football",
      eventStatusLabel: "2-0 · 67'",
      minute: 67,
      score: "2-0",
      provisional: 22.4,
      snapshotProvisional: 21.8,
      valuationMode: "model",
      expected: 22,
      triggerNote: "Arsenal lead by 2. 2UP is live.",
    },
    {
      betId: 60,
      eventId: 1,
      label: "BB · Arsenal win + BTTS + over 2.5",
      eventName: "Arsenal vs Chelsea",
      eventSport: "football",
      eventStatusLabel: "2-0 · 67'",
      minute: 67,
      score: "2-0",
      provisional: 8.1,
      snapshotProvisional: 7.4,
      valuationMode: "model",
      expected: 16,
      triggerNote: "Win leg is on. BTTS still needs Chelsea.",
    },
  ];

  const liveHistory: HistoryRow[] = [
    history({
      id: 1,
      dedupe: "demo-goal-ars-1",
      kind: "goal",
      eventId: 1,
      betId: 2,
      minute: 12,
      title: "Goal!",
      detail: "Arsenal 1-0 Chelsea",
      note: null,
      amount: null,
      createdAt: t(0, 15, now) + 12 * 60_000,
    }),
    history({
      id: 2,
      dedupe: "demo-two-up-ars",
      kind: "two_up",
      eventId: 1,
      betId: 2,
      minute: 41,
      title: "Arsenal went 2-0",
      detail: "2UP is live on Paddy Power.",
      note: null,
      amount: null,
      createdAt: t(0, 15, now) + 41 * 60_000,
    }),
    history({
      id: 3,
      dedupe: "demo-goal-ars-2",
      kind: "goal",
      eventId: 1,
      betId: 2,
      minute: 41,
      title: "Goal!",
      detail: "Arsenal 2-0 Chelsea",
      note: null,
      amount: null,
      createdAt: t(0, 15, now) + 41 * 60_000,
    }),
    history({
      id: 4,
      dedupe: "demo-placed-bb-live",
      kind: "bet_placed",
      eventId: 1,
      betId: 60,
      minute: null,
      title: "Bet builder placed",
      detail: "Arsenal win + BTTS + over 2.5",
      note: null,
      amount: null,
      createdAt: t(0, 12, now),
    }),
  ];

  const settlementHistory = completedBets.map((row, i) =>
    history({
      id: 200 + i,
      dedupe: `demo-settle-${row.id}`,
      kind: "settlement",
      eventId: row.eventId,
      betId: row.id,
      minute: null,
      title: `${row.label} settled`,
      detail: row.bookmaker,
      note: null,
      amount: row.actualProfit,
      createdAt: row.settledAt ?? row.createdAt,
    })
  );

  const awardHistory = completedBets
    .filter((row) => row.betType === "qualifying")
    .flatMap((row, i) => {
      const offer = offers.find((o) => o.id === row.offerId);
      const amount = offer?.profit.freeBetAwardAmount;
      if (!amount) return [];
      return [
        history({
          id: 400 + i,
          dedupe: `demo-fb-award-${row.id}`,
          kind: "free_bet_promo",
          eventId: null,
          betId: row.id,
          minute: null,
          title: `£${amount} free bet awarded`,
          detail: offer?.title ?? "Free bet",
          note: null,
          amount,
          createdAt: row.settledAt ?? row.createdAt,
        }),
      ];
    });

  const casinoHistory = casinoSettlements.map((row, i) =>
    history({
      id: 500 + i,
      dedupe: `demo-casino-${row.id}`,
      kind: "casino_settlement",
      eventId: null,
      betId: null,
      minute: null,
      title: `${row.casino ?? "Casino"} settled`,
      detail: row.title,
      note: null,
      amount: row.amount,
      createdAt: row.time,
    })
  );

  const promoAwards = Object.fromEntries(
    completedBets
      .filter((row) => row.betType === "qualifying")
      .flatMap((row) => {
        const offer = offers.find((o) => o.id === row.offerId);
        const amount = offer?.profit.freeBetAwardAmount;
        if (!amount) return [];
        return [[row.id, { amount, reason: offer.title }]] as const;
      })
  );
  const unsortedHistory: HistoryRow[] = [
    ...liveHistory,
    ...settlementHistory,
    ...awardHistory,
    ...casinoHistory,
  ];
  const historyRows = sortHistoryEntries(
    unsortedHistory,
    buildHistoryContext(
      events,
      bets,
      promoAwards,
      offers.map((o) => ({ id: o.id, title: o.title })),
      unsortedHistory
    )
  );

  return {
    events,
    bets,
    settledProfit,
    bettingProfit,
    casinoProfit,
    provisionalProfit: 46.4,
    retention: { rate: 0.81, sampleSize: 14 },
    effortMeasured: {
      qualify: { minutes: 8, sampleSize: 12 },
      convert: { minutes: 11, sampleSize: 9 },
    },
    accaLayDue: [
      {
        legId: 2,
        runLabel: "Paddy Power acca insurance",
        legLabel: "Liverpool",
        seq: 2,
        scheduledAt: t(-0.1, 20, now),
        suggestedStake: 18.97,
      },
    ],
    betBuilderLayDue: [
      {
        runId: 1,
        label: "Arsenal BB: win + BTTS + over 2.5",
        suggestedStake: 18.4,
      },
    ],
    mugPlans: [
      {
        id: 1,
        accountId: 4,
        accountName: "Coral",
        cadenceDays: 7,
        monthlyBudget: 20,
        lastMugAt: t(9, 14, now),
      },
    ],
    alertsUnread: 3,
    deliveredAlertKeys: [],
    boostsOpen: 1,
    casinoNeedsAction: 1,
    demoMode: true,
    hostedDesk: false,
    livePositions,
    liveEventModels: [
      {
        eventId: 1,
        marketsLabel: "Match odds",
        homeWin: 0.78,
        draw: 0.14,
        awayWin: 0.08,
      },
    ],
    series,
    pnlAdjustments: [],
    casinoSettlements,
    planRaces: [
      {
        eventId: 3,
        course: "Newmarket",
        offTime: t(0, 15, now),
        resultLogged: false,
        openExpected: 40,
        hasOpenBet: true,
        externalId: "demo-newm-1500",
      },
    ],
    planFixtures: [
      {
        eventId: 1,
        kickoff: t(0, 15, now),
        label: "Arsenal vs Chelsea",
        betCount: 2,
        openBetCount: 2,
        openExpected: 38,
      },
      {
        eventId: 2,
        kickoff: t(-0.1, 20, now),
        label: "Liverpool vs Spurs",
        betCount: 1,
        openBetCount: 1,
        openExpected: 18,
      },
    ],
    history: historyRows,
    chartHistory: historyRows.filter((row) => row.amount != null),
    promoAwards,
    apiConfigured: view === "edge",
    racingApiConfigured: view === "edge",
    racingResultsTier: view === "edge" ? "basic" : "none",
    apiUsage: { used: view === "edge" ? 42 : 0, budget: 250 },
    racingApiUsage: { used: view === "edge" ? 18 : 0 },
    exchangeProvider: "betfair",
    exchangeName: "Betfair",
    exchangeStatus: {
      provider: "betfair",
      status: view === "edge" ? "connected" : "not_configured",
    },
    exchangeProviders: [],
    racingAutopilot: [],
    settings: {
      ...DEFAULT_SETTINGS,
      defaultBookmaker: "Bet365",
      planPreview: view,
      ageConfirmedAt: null,
    },
    balances: {
      total: 1620,
      bookies: 440,
      exchanges: 400,
      banks: 780,
      pendingBankCredits: 0,
      inBets: 95,
      bankroll: 1620,
      accounts,
    },
    offers,
  };
}
