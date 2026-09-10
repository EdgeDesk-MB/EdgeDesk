import type {
  AccountRow,
  BalanceTransactionRow,
  BetRow,
  CasinoGameRow,
  CasinoOfferComponentRow,
  CasinoOfferRow,
  CasinoOfferSeriesComponentRow,
  CasinoOfferSeriesRow,
  EventRow,
  ExchangeRow,
  HistoryRow,
  OfferRow,
  OfferSeriesRow,
} from "@/lib/db/schema";
import type {
  AccountRow as PgAccountRow,
  BalanceTransactionRow as PgBalanceTransactionRow,
  BetRow as PgBetRow,
  CasinoGameRow as PgCasinoGameRow,
  CasinoOfferComponentRow as PgCasinoOfferComponentRow,
  CasinoOfferRow as PgCasinoOfferRow,
  CasinoOfferSeriesComponentRow as PgCasinoOfferSeriesComponentRow,
  CasinoOfferSeriesRow as PgCasinoOfferSeriesRow,
  EventRow as PgEventRow,
  ExchangeRow as PgExchangeRow,
  HistoryRow as PgHistoryRow,
  OfferRow as PgOfferRow,
  OfferSeriesRow as PgOfferSeriesRow,
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
    htHomeScore: row.htHomeScore,
    htAwayScore: row.htAwayScore,
    lineups: row.lineups,
    tapeFetchedAt: row.tapeFetchedAt,
    simScript: row.simScript,
    simStartedAt: row.simStartedAt,
    resultPostedAt: row.resultPostedAt,
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
    importFingerprint: row.importFingerprint ?? null,
    importMeta: row.importMeta ?? null,
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

export function toSqliteOfferSeriesRow(row: PgOfferSeriesRow): OfferSeriesRow {
  return {
    id: row.id,
    recurrenceEnabled: row.recurrenceEnabled,
    recurrenceStoppedFrom: row.recurrenceStoppedFrom,
    skippedDatesJson: row.skippedDatesJson,
    ruleJson: row.ruleJson,
    templateExpiresAt: row.templateExpiresAt,
    horizonDays: row.horizonDays,
    bookmaker: row.bookmaker,
    title: row.title,
    description: row.description,
    expectedProfit: row.expectedProfit,
    sport: row.sport,
    offerType: row.offerType,
    scopeCourse: row.scopeCourse,
    scopeRaceId: row.scopeRaceId,
    scopeRaceLabel: row.scopeRaceLabel,
    rules: row.rules,
    offerUrl: row.offerUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toSqliteExchangeRow(row: PgExchangeRow): ExchangeRow {
  return {
    id: row.id,
    name: row.name,
    commissionPct: row.commissionPct,
    brandColor: row.brandColor,
    backColor: row.backColor,
    layColor: row.layColor,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
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

export function toSqliteCasinoOfferComponentRow(
  row: PgCasinoOfferComponentRow
): CasinoOfferComponentRow {
  return {
    id: row.id,
    casinoOfferId: row.casinoOfferId,
    componentType: row.componentType,
    amount: row.amount,
    wageringMultiplier: row.wageringMultiplier,
    rtp: row.rtp,
    contributionPct: row.contributionPct,
    spins: row.spins,
    spinValue: row.spinValue,
    chipCount: row.chipCount,
    chipValue: row.chipValue,
    houseEdgePreset: row.houseEdgePreset,
    cashbackPct: row.cashbackPct,
    cashbackCap: row.cashbackCap,
    game: row.game,
    eligibleGamesJson: row.eligibleGamesJson,
    expectedEv: row.expectedEv,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  };
}

export function toSqliteCasinoOfferSeriesRow(
  row: PgCasinoOfferSeriesRow
): CasinoOfferSeriesRow {
  return {
    id: row.id,
    recurrenceEnabled: row.recurrenceEnabled,
    recurrenceStoppedFrom: row.recurrenceStoppedFrom,
    skippedDatesJson: row.skippedDatesJson,
    ruleJson: row.ruleJson,
    templateExpiresAt: row.templateExpiresAt,
    horizonDays: row.horizonDays,
    casino: row.casino,
    title: row.title,
    notes: row.notes,
    offerUrl: row.offerUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toSqliteCasinoOfferSeriesComponentRow(
  row: PgCasinoOfferSeriesComponentRow
): CasinoOfferSeriesComponentRow {
  return {
    id: row.id,
    seriesId: row.seriesId,
    componentType: row.componentType,
    amount: row.amount,
    wageringMultiplier: row.wageringMultiplier,
    rtp: row.rtp,
    contributionPct: row.contributionPct,
    spins: row.spins,
    spinValue: row.spinValue,
    chipCount: row.chipCount,
    chipValue: row.chipValue,
    houseEdgePreset: row.houseEdgePreset,
    cashbackPct: row.cashbackPct,
    cashbackCap: row.cashbackCap,
    game: row.game,
    eligibleGamesJson: row.eligibleGamesJson,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  };
}

export function toSqliteCasinoGameRow(row: PgCasinoGameRow): CasinoGameRow {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    rtp: row.rtp,
    source: row.source,
    updatedAt: row.updatedAt,
  };
}
