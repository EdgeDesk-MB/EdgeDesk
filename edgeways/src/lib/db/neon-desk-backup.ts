/**
 * Hosted desk backup/restore on Neon (EDGE-47). One JSON bundle shape is
 * shared with the SQLite dump (snake_case table keys) so a localhost export
 * restores onto the hosted desk and vice versa.
 *
 * neon-http has no interactive transactions, so restore is insert-first,
 * delete-old-last: a failed insert leaves the existing desk untouched; a
 * failed delete leaves duplicates, which a re-run resolves.
 */
import "server-only";

import { and, eq, notInArray } from "drizzle-orm";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import {
  accounts as pgAccounts,
  balanceTransactions as pgBalanceTransactions,
  bets as pgBets,
  casinoGames as pgCasinoGames,
  casinoOfferComponents as pgCasinoOfferComponents,
  casinoOfferSeries as pgCasinoOfferSeries,
  casinoOfferSeriesComponents as pgCasinoOfferSeriesComponents,
  casinoOffers as pgCasinoOffers,
  history as pgHistory,
  offerEvSnapshots as pgOfferEvSnapshots,
  offerSeries as pgOfferSeries,
  offers as pgOffers,
} from "@/lib/db/schema.pg";
import { APP_VERSION } from "@/lib/app-version";

export const HOSTED_BACKUP_TABLES = [
  "offer_series",
  "offers",
  "offer_ev_snapshots",
  "accounts",
  "bets",
  "balance_transactions",
  "history",
  "casino_offers",
  "casino_offer_series",
  "casino_offer_components",
  "casino_offer_series_components",
  "casino_games",
] as const;

type Row = Record<string, unknown>;
export type BackupTables = Record<string, Row[]>;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Serialise a camelCase Neon row to the snake_case SQLite dump shape. */
function snake(row: Row, keys: Array<[string, string]>): Row {
  const out: Row = {};
  for (const [camel, snakeKey] of keys) {
    out[snakeKey] = row[camel] ?? null;
  }
  return out;
}

const OFFER_KEYS: Array<[string, string]> = [
  ["id", "id"], ["bookmaker", "bookmaker"], ["title", "title"],
  ["description", "description"], ["expectedProfit", "expected_profit"],
  ["status", "status"], ["expiresAt", "expires_at"], ["createdAt", "created_at"],
  ["completedAt", "completed_at"], ["startsOn", "starts_on"], ["sport", "sport"],
  ["offerType", "offer_type"], ["scopeCourse", "scope_course"],
  ["eventDate", "event_date"], ["scopeRaceId", "scope_race_id"],
  ["scopeRaceLabel", "scope_race_label"], ["rules", "rules"],
  ["seriesId", "series_id"], ["instanceDate", "instance_date"],
  ["source", "source"], ["offerUrl", "offer_url"],
];

const ACCOUNT_KEYS: Array<[string, string]> = [
  ["id", "id"], ["name", "name"], ["type", "type"], ["exchangeId", "exchange_id"],
  ["fundedByAccountId", "funded_by_account_id"], ["brandColor", "brand_color"],
  ["owner", "owner"], ["isActive", "is_active"], ["accessStatus", "access_status"],
  ["notes", "notes"], ["wrRemaining", "wr_remaining"], ["wrMinOdds", "wr_min_odds"],
  ["wrType", "wr_type"], ["health", "health"],
  ["healthUpdatedAt", "health_updated_at"], ["createdAt", "created_at"],
];

const BET_KEYS: Array<[string, string]> = [
  ["id", "id"], ["eventId", "event_id"], ["label", "label"], ["market", "market"],
  ["selection", "selection"], ["betType", "bet_type"], ["bookmaker", "bookmaker"],
  ["exchangeId", "exchange_id"], ["backStake", "back_stake"],
  ["backOdds", "back_odds"], ["layStake", "lay_stake"], ["layOdds", "lay_odds"],
  ["commission", "commission"], ["earlyPayout", "early_payout"],
  ["refundAmount", "refund_amount"], ["refundRetention", "refund_retention"],
  ["legs", "legs"], ["triggerText", "trigger_text"], ["triggerRule", "trigger_rule"],
  ["status", "status"], ["expectedProfit", "expected_profit"],
  ["actualProfit", "actual_profit"], ["notes", "notes"],
  ["balanceLedgered", "balance_ledgered"], ["balanceSettled", "balance_settled"],
  ["createdAt", "created_at"], ["settledAt", "settled_at"],
  ["offerId", "offer_id"], ["quickLogged", "quick_logged"], ["source", "source"],
  ["purpose", "purpose"], ["sport", "sport"],
  ["importFingerprint", "import_fingerprint"], ["importMeta", "import_meta"],
];

const TX_KEYS: Array<[string, string]> = [
  ["id", "id"], ["accountId", "account_id"], ["amount", "amount"],
  ["category", "category"], ["betId", "bet_id"],
  ["casinoOfferId", "casino_offer_id"], ["transferGroupId", "transfer_group_id"],
  ["pending", "pending"], ["note", "note"], ["createdAt", "created_at"],
  ["confirmedAt", "confirmed_at"], ["affectPnl", "affect_pnl"],
  ["expiresAt", "expires_at"],
];

const HISTORY_KEYS: Array<[string, string]> = [
  ["id", "id"], ["dedupe", "dedupe"], ["kind", "kind"], ["eventId", "event_id"],
  ["betId", "bet_id"], ["minute", "minute"], ["title", "title"],
  ["detail", "detail"], ["note", "note"], ["amount", "amount"],
  ["createdAt", "created_at"],
];

const CASINO_OFFER_KEYS: Array<[string, string]> = [
  ["id", "id"], ["casino", "casino"], ["title", "title"],
  ["bonusAmount", "bonus_amount"], ["wageringMultiplier", "wagering_multiplier"],
  ["rtp", "rtp"], ["contributionPct", "contribution_pct"], ["status", "status"],
  ["expectedEv", "expected_ev"], ["actualProfit", "actual_profit"],
  ["notes", "notes"], ["game", "game"], ["expiresAt", "expires_at"],
  ["seriesId", "series_id"], ["instanceDate", "instance_date"],
  ["offerUrl", "offer_url"], ["createdAt", "created_at"],
  ["completedAt", "completed_at"],
];

const CASINO_SERIES_KEYS: Array<[string, string]> = [
  ["id", "id"], ["recurrenceEnabled", "recurrence_enabled"],
  ["recurrenceStoppedFrom", "recurrence_stopped_from"],
  ["skippedDatesJson", "skipped_dates_json"], ["ruleJson", "rule_json"],
  ["templateExpiresAt", "template_expires_at"], ["horizonDays", "horizon_days"],
  ["casino", "casino"], ["title", "title"], ["notes", "notes"],
  ["offerUrl", "offer_url"], ["createdAt", "created_at"],
  ["updatedAt", "updated_at"],
];

const CASINO_COMPONENT_KEYS: Array<[string, string]> = [
  ["id", "id"], ["casinoOfferId", "casino_offer_id"],
  ["componentType", "component_type"], ["amount", "amount"],
  ["wageringMultiplier", "wagering_multiplier"], ["rtp", "rtp"],
  ["contributionPct", "contribution_pct"], ["spins", "spins"],
  ["spinValue", "spin_value"], ["chipCount", "chip_count"],
  ["chipValue", "chip_value"], ["houseEdgePreset", "house_edge_preset"],
  ["cashbackPct", "cashback_pct"], ["cashbackCap", "cashback_cap"],
  ["game", "game"], ["eligibleGamesJson", "eligible_games_json"],
  ["expectedEv", "expected_ev"], ["sortOrder", "sort_order"],
  ["createdAt", "created_at"],
];

const CASINO_SERIES_COMPONENT_KEYS: Array<[string, string]> = [
  ["id", "id"], ["seriesId", "series_id"],
  ["componentType", "component_type"], ["amount", "amount"],
  ["wageringMultiplier", "wagering_multiplier"], ["rtp", "rtp"],
  ["contributionPct", "contribution_pct"], ["spins", "spins"],
  ["spinValue", "spin_value"], ["chipCount", "chip_count"],
  ["chipValue", "chip_value"], ["houseEdgePreset", "house_edge_preset"],
  ["cashbackPct", "cashback_pct"], ["cashbackCap", "cashback_cap"],
  ["game", "game"], ["eligibleGamesJson", "eligible_games_json"],
  ["sortOrder", "sort_order"], ["createdAt", "created_at"],
];

const CASINO_GAME_KEYS: Array<[string, string]> = [
  ["id", "id"], ["name", "name"], ["provider", "provider"], ["rtp", "rtp"],
  ["source", "source"], ["updatedAt", "updated_at"],
];

const OFFER_SERIES_KEYS: Array<[string, string]> = [
  ["id", "id"], ["recurrenceEnabled", "recurrence_enabled"],
  ["recurrenceStoppedFrom", "recurrence_stopped_from"],
  ["skippedDatesJson", "skipped_dates_json"], ["ruleJson", "rule_json"],
  ["templateExpiresAt", "template_expires_at"], ["horizonDays", "horizon_days"],
  ["bookmaker", "bookmaker"], ["title", "title"], ["description", "description"],
  ["expectedProfit", "expected_profit"], ["sport", "sport"],
  ["offerType", "offer_type"], ["scopeCourse", "scope_course"],
  ["scopeRaceId", "scope_race_id"], ["scopeRaceLabel", "scope_race_label"],
  ["rules", "rules"], ["offerUrl", "offer_url"],
  ["createdAt", "created_at"], ["updatedAt", "updated_at"],
];

const EV_SNAPSHOT_KEYS: Array<[string, string]> = [
  ["id", "id"], ["offerId", "offer_id"], ["version", "version"],
  ["lockedAt", "locked_at"], ["expectedProfit", "expected_profit"],
  ["basis", "basis"], ["inputsJson", "inputs_json"],
  ["realizedProfit", "realized_profit"], ["capturePct", "capture_pct"],
  ["commissionDrag", "commission_drag"], ["settledAt", "settled_at"],
  ["mistakeTag", "mistake_tag"],
];

export async function neonDeskBackupBundle(): Promise<{
  app: string;
  exportedAt: string;
  tables: BackupTables;
}> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to download a backup.");
  }
  const db = getNeonDb();
  const [
    series,
    offers,
    snapshots,
    accounts,
    bets,
    txs,
    history,
    cOffers,
    cSeries,
    cComponents,
    cSeriesComponents,
    cGames,
  ] = await Promise.all([
    db.select().from(pgOfferSeries).where(eq(pgOfferSeries.clerkUserId, clerkUserId)),
    db.select().from(pgOffers).where(eq(pgOffers.clerkUserId, clerkUserId)),
    db.select().from(pgOfferEvSnapshots).where(eq(pgOfferEvSnapshots.clerkUserId, clerkUserId)),
    db.select().from(pgAccounts).where(eq(pgAccounts.clerkUserId, clerkUserId)),
    db.select().from(pgBets).where(eq(pgBets.clerkUserId, clerkUserId)),
    db
      .select()
      .from(pgBalanceTransactions)
      .where(eq(pgBalanceTransactions.clerkUserId, clerkUserId)),
    db.select().from(pgHistory).where(eq(pgHistory.clerkUserId, clerkUserId)),
    db.select().from(pgCasinoOffers).where(eq(pgCasinoOffers.clerkUserId, clerkUserId)),
    db.select().from(pgCasinoOfferSeries).where(eq(pgCasinoOfferSeries.clerkUserId, clerkUserId)),
    db.select().from(pgCasinoOfferComponents).where(eq(pgCasinoOfferComponents.clerkUserId, clerkUserId)),
    db.select().from(pgCasinoOfferSeriesComponents).where(eq(pgCasinoOfferSeriesComponents.clerkUserId, clerkUserId)),
    db.select().from(pgCasinoGames).where(eq(pgCasinoGames.clerkUserId, clerkUserId)),
  ]);
  return {
    app: APP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      offer_series: series.map((r) => snake(r as unknown as Row, OFFER_SERIES_KEYS)),
      offers: offers.map((r) => snake(r as unknown as Row, OFFER_KEYS)),
      offer_ev_snapshots: snapshots.map((r) => snake(r as unknown as Row, EV_SNAPSHOT_KEYS)),
      accounts: accounts.map((r) => snake(r as unknown as Row, ACCOUNT_KEYS)),
      bets: bets.map((r) => snake(r as unknown as Row, BET_KEYS)),
      balance_transactions: txs.map((r) => snake(r as unknown as Row, TX_KEYS)),
      history: history.map((r) => snake(r as unknown as Row, HISTORY_KEYS)),
      casino_offers: cOffers.map((r) => snake(r as unknown as Row, CASINO_OFFER_KEYS)),
      casino_offer_series: cSeries.map((r) => snake(r as unknown as Row, CASINO_SERIES_KEYS)),
      casino_offer_components: cComponents.map((r) => snake(r as unknown as Row, CASINO_COMPONENT_KEYS)),
      casino_offer_series_components: cSeriesComponents.map((r) => snake(r as unknown as Row, CASINO_SERIES_COMPONENT_KEYS)),
      casino_games: cGames.map((r) => snake(r as unknown as Row, CASINO_GAME_KEYS)),
    },
  };
}

/** Row counts for the restore confirm dialog. */
export function hostedBackupCounts(tables: BackupTables): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of HOSTED_BACKUP_TABLES) {
    counts[name] = Array.isArray(tables[name]) ? tables[name].length : 0;
  }
  return counts;
}

export function isHostedBackupTables(tables: unknown): tables is BackupTables {
  if (!tables || typeof tables !== "object") return false;
  const t = tables as Record<string, unknown>;
  // A valid bundle has at least one desk table and every present table is an array.
  const present = HOSTED_BACKUP_TABLES.filter((n) => t[n] !== undefined);
  return present.length > 0 && present.every((n) => Array.isArray(t[n]));
}

/**
 * Replace this login's hosted desk with the bundle contents. Ids are
 * reassigned by Neon; offer/account/bet/casino/series/snapshot
 * references are remapped. Feed-scoped ids that do not exist on the
 * hosted desk (events, racing scope ids) are nulled.
 */
export async function restoreNeonDeskBackup(
  tables: BackupTables
): Promise<Record<string, number>> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to restore a backup.");
  }
  const db = getNeonDb();

  const seriesRows = tables.offer_series ?? [];
  const offerRows = tables.offers ?? [];
  const snapshotRows = tables.offer_ev_snapshots ?? [];
  const accountRows = tables.accounts ?? [];
  const betRows = tables.bets ?? [];
  const txRows = tables.balance_transactions ?? [];
  const historyRows = tables.history ?? [];
  const casinoOfferRows = tables.casino_offers ?? [];
  const casinoSeriesRows = tables.casino_offer_series ?? [];
  const casinoComponentRows = tables.casino_offer_components ?? [];
  const casinoSeriesComponentRows = tables.casino_offer_series_components ?? [];
  const casinoGameRows = tables.casino_games ?? [];

  // 1. Sports series (before offers so series_id remaps)
  const seriesIdMap = new Map<number, number>();
  for (const r of seriesRows) {
    const title = str(r.title);
    const ruleJson = str(r.rule_json);
    if (!title || !ruleJson) continue;
    const inserted = await db
      .insert(pgOfferSeries)
      .values({
        clerkUserId,
        recurrenceEnabled: num(r.recurrence_enabled) ?? 1,
        recurrenceStoppedFrom: str(r.recurrence_stopped_from),
        skippedDatesJson: str(r.skipped_dates_json),
        ruleJson,
        templateExpiresAt: num(r.template_expires_at),
        horizonDays: num(r.horizon_days) ?? 14,
        bookmaker: str(r.bookmaker),
        title,
        description: str(r.description),
        expectedProfit: num(r.expected_profit),
        sport: str(r.sport),
        offerType: str(r.offer_type),
        scopeCourse: str(r.scope_course),
        scopeRaceId: null,
        scopeRaceLabel: str(r.scope_race_label),
        rules: str(r.rules),
        offerUrl: str(r.offer_url),
        createdAt: num(r.created_at) ?? Date.now(),
        updatedAt: num(r.updated_at) ?? Date.now(),
      })
      .returning({ id: pgOfferSeries.id });
    const oldId = num(r.id);
    if (oldId != null && inserted[0]) seriesIdMap.set(oldId, inserted[0].id);
  }

  // 2. Offers
  const offerIdMap = new Map<number, number>();
  for (const r of offerRows) {
    const title = str(r.title);
    if (!title) continue;
    const oldSeriesId = num(r.series_id);
    const inserted = await db
      .insert(pgOffers)
      .values({
        clerkUserId,
        bookmaker: str(r.bookmaker),
        title,
        description: str(r.description),
        expectedProfit: num(r.expected_profit),
        status: (str(r.status) as "planned" | "active" | "completed" | "expired") ?? "active",
        expiresAt: num(r.expires_at),
        createdAt: num(r.created_at) ?? Date.now(),
        completedAt: num(r.completed_at),
        startsOn: str(r.starts_on),
        sport: str(r.sport),
        offerType: str(r.offer_type),
        scopeCourse: str(r.scope_course),
        eventDate: str(r.event_date),
        scopeRaceId: null, // racing feed ids are not hosted
        scopeRaceLabel: str(r.scope_race_label),
        rules: str(r.rules),
        seriesId: oldSeriesId != null ? (seriesIdMap.get(oldSeriesId) ?? null) : null,
        instanceDate: str(r.instance_date),
        source: str(r.source),
        offerUrl: str(r.offer_url),
      })
      .returning({ id: pgOffers.id });
    const oldId = num(r.id);
    if (oldId != null && inserted[0]) offerIdMap.set(oldId, inserted[0].id);
  }

  // 3. EV snapshots (after offers so offer_id remaps)
  const keepSnapshotIds: number[] = [];
  for (const r of snapshotRows) {
    const oldOfferId = num(r.offer_id);
    const newOfferId = oldOfferId != null ? offerIdMap.get(oldOfferId) : undefined;
    const lockedAt = num(r.locked_at);
    const expectedProfit = num(r.expected_profit);
    const basis = str(r.basis);
    if (newOfferId == null || lockedAt == null || expectedProfit == null || !basis) continue;
    const inserted = await db
      .insert(pgOfferEvSnapshots)
      .values({
        clerkUserId,
        offerId: newOfferId,
        version: num(r.version) ?? 1,
        lockedAt,
        expectedProfit,
        basis,
        inputsJson: str(r.inputs_json),
        realizedProfit: num(r.realized_profit),
        capturePct: num(r.capture_pct),
        commissionDrag: num(r.commission_drag),
        settledAt: num(r.settled_at),
        mistakeTag: str(r.mistake_tag),
      })
      .returning({ id: pgOfferEvSnapshots.id });
    if (inserted[0]) keepSnapshotIds.push(inserted[0].id);
  }

  // 4. Accounts (funded_by self-FK remapped in a second pass)
  const accountIdMap = new Map<number, number>();
  for (const r of accountRows) {
    const name = str(r.name);
    const type = str(r.type) as "bookie" | "exchange" | "bank" | null;
    if (!name || !type) continue;
    const inserted = await db
      .insert(pgAccounts)
      .values({
        clerkUserId,
        name,
        type,
        exchangeId: num(r.exchange_id),
        fundedByAccountId: null,
        brandColor: str(r.brand_color),
        owner: str(r.owner) ?? "me",
        isActive: num(r.is_active) ?? 1,
        accessStatus:
          (str(r.access_status) as "available" | "gubbed" | "closed") ?? "available",
        notes: str(r.notes),
        wrRemaining: num(r.wr_remaining) ?? 0,
        wrMinOdds: num(r.wr_min_odds),
        wrType: (str(r.wr_type) as "stake" | "risk_win") ?? "stake",
        health: str(r.health),
        healthUpdatedAt: num(r.health_updated_at),
        createdAt: num(r.created_at) ?? Date.now(),
      })
      .returning({ id: pgAccounts.id });
    const oldId = num(r.id);
    if (oldId != null && inserted[0]) accountIdMap.set(oldId, inserted[0].id);
  }
  for (const r of accountRows) {
    const oldId = num(r.id);
    const oldFundedBy = num(r.funded_by_account_id);
    const newId = oldId != null ? accountIdMap.get(oldId) : undefined;
    const newFundedBy = oldFundedBy != null ? accountIdMap.get(oldFundedBy) : undefined;
    if (newId != null && newFundedBy != null) {
      await db
        .update(pgAccounts)
        .set({ fundedByAccountId: newFundedBy })
        .where(and(eq(pgAccounts.id, newId), eq(pgAccounts.clerkUserId, clerkUserId)));
    }
  }

  // 3. Bets
  const betIdMap = new Map<number, number>();
  for (const r of betRows) {
    const label = str(r.label);
    if (!label) continue;
    const oldOfferId = num(r.offer_id);
    const inserted = await db
      .insert(pgBets)
      .values({
        clerkUserId,
        eventId: null, // events are feed data, not hosted desk data
        label,
        market: str(r.market) ?? "match_odds",
        selection: str(r.selection) ?? "",
        betType: str(r.bet_type) ?? "qualifying",
        bookmaker: str(r.bookmaker),
        exchangeId: num(r.exchange_id),
        backStake: num(r.back_stake) ?? 0,
        backOdds: num(r.back_odds) ?? 0,
        layStake: num(r.lay_stake) ?? 0,
        layOdds: num(r.lay_odds) ?? 0,
        commission: num(r.commission) ?? 0.02,
        earlyPayout: num(r.early_payout) ?? 0,
        refundAmount: num(r.refund_amount),
        refundRetention: num(r.refund_retention),
        legs: str(r.legs),
        triggerText: str(r.trigger_text),
        triggerRule: str(r.trigger_rule),
        status:
          (str(r.status) as
            | "open" | "won" | "lost" | "void" | "early_payout"
            | "half_win" | "half_lose" | "push") ?? "open",
        expectedProfit: num(r.expected_profit),
        actualProfit: num(r.actual_profit),
        notes: str(r.notes),
        balanceLedgered: num(r.balance_ledgered) ?? 0,
        balanceSettled: num(r.balance_settled) ?? 0,
        createdAt: num(r.created_at) ?? Date.now(),
        settledAt: num(r.settled_at),
        offerId: oldOfferId != null ? (offerIdMap.get(oldOfferId) ?? null) : null,
        quickLogged: num(r.quick_logged),
        source: str(r.source),
        purpose: str(r.purpose),
        sport: str(r.sport),
        // EDGE-98: keep import idempotency across a restore, or a CSV
        // re-import duplicates every imported bet.
        importFingerprint: str(r.import_fingerprint),
        importMeta: str(r.import_meta),
      })
      .returning({ id: pgBets.id });
    const oldId = num(r.id);
    if (oldId != null && inserted[0]) betIdMap.set(oldId, inserted[0].id);
  }

  // 3b. Casino: games, then series, then offers (series_id remap), then the
  // two component tables (offer/series remap). Before the ledger so
  // balance_transactions.casino_offer_id can point at the new offer ids.
  const casinoGameIdMap = new Map<number, number>();
  const keepCasinoGameIds: number[] = [];
  for (const r of casinoGameRows) {
    const name = str(r.name);
    const rtp = num(r.rtp);
    if (!name || rtp == null) continue;
    const inserted = await db
      .insert(pgCasinoGames)
      .values({
        clerkUserId,
        name,
        provider: str(r.provider),
        rtp,
        source: str(r.source) ?? "user",
        updatedAt: num(r.updated_at) ?? Date.now(),
      })
      .onConflictDoNothing()
      .returning({ id: pgCasinoGames.id });
    const oldId = num(r.id);
    if (inserted[0]) {
      if (oldId != null) casinoGameIdMap.set(oldId, inserted[0].id);
      keepCasinoGameIds.push(inserted[0].id);
    } else {
      // (clerk_user_id, name) conflict: adopt the existing row into the keep set
      const existing = await db
        .select({ id: pgCasinoGames.id })
        .from(pgCasinoGames)
        .where(and(eq(pgCasinoGames.clerkUserId, clerkUserId), eq(pgCasinoGames.name, name)))
        .limit(1);
      if (existing[0]) {
        if (oldId != null) casinoGameIdMap.set(oldId, existing[0].id);
        keepCasinoGameIds.push(existing[0].id);
      }
    }
  }

  const casinoSeriesIdMap = new Map<number, number>();
  for (const r of casinoSeriesRows) {
    const title = str(r.title);
    const ruleJson = str(r.rule_json);
    if (!title || !ruleJson) continue;
    const inserted = await db
      .insert(pgCasinoOfferSeries)
      .values({
        clerkUserId,
        recurrenceEnabled: num(r.recurrence_enabled) ?? 1,
        recurrenceStoppedFrom: str(r.recurrence_stopped_from),
        skippedDatesJson: str(r.skipped_dates_json),
        ruleJson,
        templateExpiresAt: num(r.template_expires_at),
        horizonDays: num(r.horizon_days) ?? 14,
        casino: str(r.casino),
        title,
        notes: str(r.notes),
        offerUrl: str(r.offer_url),
        createdAt: num(r.created_at) ?? Date.now(),
        updatedAt: num(r.updated_at) ?? Date.now(),
      })
      .returning({ id: pgCasinoOfferSeries.id });
    const oldId = num(r.id);
    if (oldId != null && inserted[0]) casinoSeriesIdMap.set(oldId, inserted[0].id);
  }

  const casinoOfferIdMap = new Map<number, number>();
  for (const r of casinoOfferRows) {
    const title = str(r.title);
    if (!title) continue;
    const oldSeriesId = num(r.series_id);
    const inserted = await db
      .insert(pgCasinoOffers)
      .values({
        clerkUserId,
        casino: str(r.casino),
        title,
        bonusAmount: num(r.bonus_amount) ?? 0,
        wageringMultiplier: num(r.wagering_multiplier) ?? 0,
        rtp: num(r.rtp),
        contributionPct: num(r.contribution_pct),
        status: (str(r.status) as "planned" | "active" | "completed" | "expired") ?? "planned",
        expectedEv: num(r.expected_ev) ?? 0,
        actualProfit: num(r.actual_profit),
        notes: str(r.notes),
        game: str(r.game),
        expiresAt: num(r.expires_at),
        seriesId: oldSeriesId != null ? (casinoSeriesIdMap.get(oldSeriesId) ?? null) : null,
        instanceDate: str(r.instance_date),
        offerUrl: str(r.offer_url),
        createdAt: num(r.created_at) ?? Date.now(),
        completedAt: num(r.completed_at),
      })
      .returning({ id: pgCasinoOffers.id });
    const oldId = num(r.id);
    if (oldId != null && inserted[0]) casinoOfferIdMap.set(oldId, inserted[0].id);
  }

  const keepCasinoComponentIds: number[] = [];
  for (const r of casinoComponentRows) {
    const oldOfferId = num(r.casino_offer_id);
    const casinoOfferId = oldOfferId != null ? casinoOfferIdMap.get(oldOfferId) : undefined;
    const componentType = str(r.component_type) as
      | "qualifying_wager" | "cash" | "bonus" | "free_spins" | "golden_chips" | "cashback" | null;
    if (casinoOfferId == null || !componentType) continue;
    const inserted = await db
      .insert(pgCasinoOfferComponents)
      .values({
        clerkUserId,
        casinoOfferId,
        componentType,
        amount: num(r.amount),
        wageringMultiplier: num(r.wagering_multiplier),
        rtp: num(r.rtp),
        contributionPct: num(r.contribution_pct),
        spins: num(r.spins),
        spinValue: num(r.spin_value),
        chipCount: num(r.chip_count),
        chipValue: num(r.chip_value),
        houseEdgePreset: str(r.house_edge_preset) as "european" | "american" | "custom" | null,
        cashbackPct: num(r.cashback_pct),
        cashbackCap: num(r.cashback_cap),
        game: str(r.game),
        eligibleGamesJson: str(r.eligible_games_json),
        expectedEv: num(r.expected_ev) ?? 0,
        sortOrder: num(r.sort_order) ?? 0,
        createdAt: num(r.created_at) ?? Date.now(),
      })
      .returning({ id: pgCasinoOfferComponents.id });
    if (inserted[0]) keepCasinoComponentIds.push(inserted[0].id);
  }

  const keepCasinoSeriesComponentIds: number[] = [];
  for (const r of casinoSeriesComponentRows) {
    const oldSeriesId = num(r.series_id);
    const seriesId = oldSeriesId != null ? casinoSeriesIdMap.get(oldSeriesId) : undefined;
    const componentType = str(r.component_type) as
      | "qualifying_wager" | "cash" | "bonus" | "free_spins" | "golden_chips" | "cashback" | null;
    if (seriesId == null || !componentType) continue;
    const inserted = await db
      .insert(pgCasinoOfferSeriesComponents)
      .values({
        clerkUserId,
        seriesId,
        componentType,
        amount: num(r.amount),
        wageringMultiplier: num(r.wagering_multiplier),
        rtp: num(r.rtp),
        contributionPct: num(r.contribution_pct),
        spins: num(r.spins),
        spinValue: num(r.spin_value),
        chipCount: num(r.chip_count),
        chipValue: num(r.chip_value),
        houseEdgePreset: str(r.house_edge_preset) as "european" | "american" | "custom" | null,
        cashbackPct: num(r.cashback_pct),
        cashbackCap: num(r.cashback_cap),
        game: str(r.game),
        eligibleGamesJson: str(r.eligible_games_json),
        sortOrder: num(r.sort_order) ?? 0,
        createdAt: num(r.created_at) ?? Date.now(),
      })
      .returning({ id: pgCasinoOfferSeriesComponents.id });
    if (inserted[0]) keepCasinoSeriesComponentIds.push(inserted[0].id);
  }

  // 4. Balance ledger
  const keepTxIds: number[] = [];
  for (const r of txRows) {
    const oldAccountId = num(r.account_id);
    const accountId = oldAccountId != null ? accountIdMap.get(oldAccountId) : undefined;
    const amount = num(r.amount);
    const category = str(r.category) as
      | "top_up" | "withdrawal" | "adjustment" | "bet_stake" | "bet_settlement"
      | "casino_settlement" | "free_bet" | "transfer" | "fee" | null;
    if (accountId == null || amount == null || !category) continue;
    const oldBetId = num(r.bet_id);
    const oldCasinoOfferId = num(r.casino_offer_id);
    const inserted = await db
      .insert(pgBalanceTransactions)
      .values({
        clerkUserId,
        accountId,
        amount,
        category,
        betId: oldBetId != null ? (betIdMap.get(oldBetId) ?? null) : null,
        casinoOfferId:
          oldCasinoOfferId != null ? (casinoOfferIdMap.get(oldCasinoOfferId) ?? null) : null,
        transferGroupId: str(r.transfer_group_id),
        pending: num(r.pending) ?? 0,
        note: str(r.note),
        createdAt: num(r.created_at) ?? Date.now(),
        confirmedAt: num(r.confirmed_at),
        affectPnl: num(r.affect_pnl) ?? 0,
        expiresAt: num(r.expires_at),
      })
      .returning({ id: pgBalanceTransactions.id });
    if (inserted[0]) keepTxIds.push(inserted[0].id);
  }

  // 5. History (dedupe-keyed; a conflicting old row is adopted into the keep set)
  const keepHistoryIds: number[] = [];
  for (const r of historyRows) {
    const dedupeKey = str(r.dedupe);
    const kind = str(r.kind) as
      | "kickoff" | "goal" | "two_up" | "full_time" | "settlement"
      | "casino_settlement" | "free_bet_promo" | "bet_placed" | "balance_adjustment" | null;
    const title = str(r.title);
    if (!dedupeKey || !kind || !title) continue;
    const oldBetId = num(r.bet_id);
    const inserted = await db
      .insert(pgHistory)
      .values({
        clerkUserId,
        dedupe: dedupeKey,
        kind,
        eventId: null,
        betId: oldBetId != null ? (betIdMap.get(oldBetId) ?? null) : null,
        minute: num(r.minute),
        title,
        detail: str(r.detail),
        note: str(r.note),
        amount: num(r.amount),
        createdAt: num(r.created_at) ?? Date.now(),
      })
      .onConflictDoNothing({
        target: [pgHistory.clerkUserId, pgHistory.dedupe],
      })
      .returning({ id: pgHistory.id });
    if (inserted[0]) {
      keepHistoryIds.push(inserted[0].id);
    } else {
      const existing = await db
        .select({ id: pgHistory.id })
        .from(pgHistory)
        .where(and(eq(pgHistory.clerkUserId, clerkUserId), eq(pgHistory.dedupe, dedupeKey)))
        .limit(1);
      if (existing[0]) keepHistoryIds.push(existing[0].id);
    }
  }

  // 6. Delete the previous desk rows (everything of mine not just re-created).
  const keepOffers = [...offerIdMap.values()];
  const keepSeries = [...seriesIdMap.values()];
  const keepAccounts = [...accountIdMap.values()];
  const keepBets = [...betIdMap.values()];
  const keepCasinoOffers = [...casinoOfferIdMap.values()];
  const keepCasinoSeries = [...casinoSeriesIdMap.values()];
  // Casino children first, then parents.
  await db
    .delete(pgCasinoOfferComponents)
    .where(
      keepCasinoComponentIds.length > 0
        ? and(eq(pgCasinoOfferComponents.clerkUserId, clerkUserId), notInArray(pgCasinoOfferComponents.id, keepCasinoComponentIds))
        : eq(pgCasinoOfferComponents.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgCasinoOfferSeriesComponents)
    .where(
      keepCasinoSeriesComponentIds.length > 0
        ? and(eq(pgCasinoOfferSeriesComponents.clerkUserId, clerkUserId), notInArray(pgCasinoOfferSeriesComponents.id, keepCasinoSeriesComponentIds))
        : eq(pgCasinoOfferSeriesComponents.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgCasinoOffers)
    .where(
      keepCasinoOffers.length > 0
        ? and(eq(pgCasinoOffers.clerkUserId, clerkUserId), notInArray(pgCasinoOffers.id, keepCasinoOffers))
        : eq(pgCasinoOffers.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgCasinoOfferSeries)
    .where(
      keepCasinoSeries.length > 0
        ? and(eq(pgCasinoOfferSeries.clerkUserId, clerkUserId), notInArray(pgCasinoOfferSeries.id, keepCasinoSeries))
        : eq(pgCasinoOfferSeries.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgCasinoGames)
    .where(
      keepCasinoGameIds.length > 0
        ? and(eq(pgCasinoGames.clerkUserId, clerkUserId), notInArray(pgCasinoGames.id, keepCasinoGameIds))
        : eq(pgCasinoGames.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgHistory)
    .where(
      keepHistoryIds.length > 0
        ? and(eq(pgHistory.clerkUserId, clerkUserId), notInArray(pgHistory.id, keepHistoryIds))
        : eq(pgHistory.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgBalanceTransactions)
    .where(
      keepTxIds.length > 0
        ? and(eq(pgBalanceTransactions.clerkUserId, clerkUserId), notInArray(pgBalanceTransactions.id, keepTxIds))
        : eq(pgBalanceTransactions.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgBets)
    .where(
      keepBets.length > 0
        ? and(eq(pgBets.clerkUserId, clerkUserId), notInArray(pgBets.id, keepBets))
        : eq(pgBets.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgAccounts)
    .where(
      keepAccounts.length > 0
        ? and(eq(pgAccounts.clerkUserId, clerkUserId), notInArray(pgAccounts.id, keepAccounts))
        : eq(pgAccounts.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgOfferEvSnapshots)
    .where(
      keepSnapshotIds.length > 0
        ? and(
            eq(pgOfferEvSnapshots.clerkUserId, clerkUserId),
            notInArray(pgOfferEvSnapshots.id, keepSnapshotIds)
          )
        : eq(pgOfferEvSnapshots.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgOffers)
    .where(
      keepOffers.length > 0
        ? and(eq(pgOffers.clerkUserId, clerkUserId), notInArray(pgOffers.id, keepOffers))
        : eq(pgOffers.clerkUserId, clerkUserId)
    );
  await db
    .delete(pgOfferSeries)
    .where(
      keepSeries.length > 0
        ? and(eq(pgOfferSeries.clerkUserId, clerkUserId), notInArray(pgOfferSeries.id, keepSeries))
        : eq(pgOfferSeries.clerkUserId, clerkUserId)
    );

  return {
    offer_series: seriesIdMap.size,
    offers: offerIdMap.size,
    offer_ev_snapshots: keepSnapshotIds.length,
    accounts: accountIdMap.size,
    bets: betIdMap.size,
    balance_transactions: keepTxIds.length,
    history: keepHistoryIds.length,
    casino_offers: casinoOfferIdMap.size,
    casino_offer_series: casinoSeriesIdMap.size,
    casino_offer_components: keepCasinoComponentIds.length,
    casino_offer_series_components: keepCasinoSeriesComponentIds.length,
    casino_games: keepCasinoGameIds.length,
  };
}
