import type {
  AccountRow,
  BalanceTransactionRow,
  BetRow,
  CasinoOfferRow,
  EventRow,
  HistoryRow,
  OfferRow,
} from "@/lib/db/schema";
import type {
  AccountRow as PgAccountRow,
  BalanceTransactionRow as PgBalanceTransactionRow,
  BetRow as PgBetRow,
  CasinoOfferRow as PgCasinoOfferRow,
  EventRow as PgEventRow,
  HistoryRow as PgHistoryRow,
  OfferRow as PgOfferRow,
} from "@/lib/db/schema.pg";

/**
 * Events are GLOBAL feed data, not desk data — there is no clerk column to
 * drop. Listed explicitly anyway so a future divergence between the SQLite and
 * Postgres event columns is a compile error rather than a silent hole.
 */
export function toSqliteEventRow(row: PgEventRow): EventRow {
  return {
    id: row.id,
    sport: row.sport,
    externalId: row.externalId,
    competition: row.competition,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    startTime: row.startTime,
    status: row.status,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    minute: row.minute,
    homeLed2: row.homeLed2,
    awayLed2: row.awayLed2,
    source: row.source,
    goals: row.goals,
    ftHomeScore: row.ftHomeScore,
    ftAwayScore: row.ftAwayScore,
    matchEnding: row.matchEnding,
    period: row.period,
    simScript: row.simScript,
    simStartedAt: row.simStartedAt,
    createdAt: row.createdAt,
  };
}

export function toSqliteBetRow(row: PgBetRow): BetRow {
  return {
    id: row.id,
    eventId: row.eventId,
    label: row.label,
    market: row.market,
    selection: row.selection,
    betType: row.betType,
    bookmaker: row.bookmaker,
    exchangeId: row.exchangeId,
    backStake: row.backStake,
    backOdds: row.backOdds,
    layStake: row.layStake,
    layOdds: row.layOdds,
    commission: row.commission,
    earlyPayout: row.earlyPayout,
    refundAmount: row.refundAmount,
    refundRetention: row.refundRetention,
    legs: row.legs,
    triggerText: row.triggerText,
    triggerRule: row.triggerRule,
    status: row.status,
    expectedProfit: row.expectedProfit,
    actualProfit: row.actualProfit,
    notes: row.notes,
    balanceLedgered: row.balanceLedgered,
    balanceSettled: row.balanceSettled,
    createdAt: row.createdAt,
    settledAt: row.settledAt,
    offerId: row.offerId,
    quickLogged: row.quickLogged,
    source: row.source,
    purpose: row.purpose,
    sport: row.sport,
    importFingerprint: null,
    importMeta: null,
  };
}

export function toSqliteOfferRow(row: PgOfferRow): OfferRow {
  return {
    id: row.id,
    bookmaker: row.bookmaker,
    title: row.title,
    description: row.description,
    expectedProfit: row.expectedProfit,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    startsOn: row.startsOn,
    sport: row.sport,
    offerType: row.offerType,
    scopeCourse: row.scopeCourse,
    eventDate: row.eventDate,
    scopeRaceId: row.scopeRaceId,
    scopeRaceLabel: row.scopeRaceLabel,
    rules: row.rules,
    seriesId: row.seriesId,
    instanceDate: row.instanceDate,
    source: row.source,
    offerUrl: row.offerUrl,
  };
}

export function toSqliteAccountRow(row: PgAccountRow): AccountRow {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    exchangeId: row.exchangeId,
    fundedByAccountId: row.fundedByAccountId,
    brandColor: row.brandColor,
    owner: row.owner,
    isActive: row.isActive,
    accessStatus: row.accessStatus,
    notes: row.notes,
    wrRemaining: row.wrRemaining,
    wrMinOdds: row.wrMinOdds,
    wrType: row.wrType,
    health: row.health,
    healthUpdatedAt: row.healthUpdatedAt,
    createdAt: row.createdAt,
  };
}

export function toSqliteBalanceTransactionRow(
  row: PgBalanceTransactionRow
): BalanceTransactionRow {
  return {
    id: row.id,
    accountId: row.accountId,
    amount: row.amount,
    category: row.category,
    betId: row.betId,
    casinoOfferId: row.casinoOfferId,
    transferGroupId: row.transferGroupId,
    pending: row.pending,
    note: row.note,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
    affectPnl: row.affectPnl,
    expiresAt: row.expiresAt,
  };
}

export function toSqliteHistoryRow(row: PgHistoryRow): HistoryRow {
  return {
    id: row.id,
    dedupe: row.dedupe,
    kind: row.kind,
    eventId: row.eventId,
    betId: row.betId,
    minute: row.minute,
    title: row.title,
    detail: row.detail,
    note: row.note,
    amount: row.amount,
    createdAt: row.createdAt,
  };
}

export function toSqliteCasinoOfferRow(row: PgCasinoOfferRow): CasinoOfferRow {
  return {
    id: row.id,
    casino: row.casino,
    title: row.title,
    bonusAmount: row.bonusAmount,
    wageringMultiplier: row.wageringMultiplier,
    rtp: row.rtp,
    contributionPct: row.contributionPct,
    status: row.status,
    expectedEv: row.expectedEv,
    actualProfit: row.actualProfit,
    notes: row.notes,
    game: row.game,
    expiresAt: row.expiresAt,
    seriesId: row.seriesId,
    instanceDate: row.instanceDate,
    offerUrl: row.offerUrl,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}
