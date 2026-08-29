import "server-only";
import { and, gte, isNotNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import {
  emptyActivityDaily,
  emptyActivityStamps,
  type ActivityDaily,
  type ActivityStamps,
} from "@/lib/admin/activity-charts";
import {
  emptyActivityMix,
  normaliseActivityKey,
  type ActivityKeyedCount,
  type ActivityMix,
} from "@/lib/admin/activity-mix";
import { SERIES_COMPARE_DAYS } from "@/lib/admin/series";
import { getNeonDb } from "@/lib/db/neon";
import { bets, offers, casinoOffers } from "@/lib/db/schema.pg";
import { listAppUsers, type AdminUserRow } from "@/lib/services/app-users";

export type DeskActivityRow = {
  clerkUserId: string;
  email: string | null;
  plan: string;
  admin: boolean;
  bets: number;
  offers: number;
  casino: number;
};

export type ActivityOverview = {
  available: boolean;
  note: string | null;
  rows: DeskActivityRow[];
  daily: ActivityDaily;
  stamps: ActivityStamps;
  mix: ActivityMix;
};

type VolumeTable = typeof bets | typeof offers | typeof casinoOffers;
type VolumeUserColumn =
  | typeof bets.clerkUserId
  | typeof offers.clerkUserId
  | typeof casinoOffers.clerkUserId;

/**
 * Admin Activity is a read of hosted per-account volume. It uses DATABASE_URL
 * the same way waitlist and app_users do. EDGEWAYS_DESK_BACKEND=neon is only
 * for writing this machine's desk to Postgres, not for this read.
 */
function usesHostedVolume(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function countsByUser(
  column: VolumeUserColumn,
  table: VolumeTable
): Promise<Map<string, number>> {
  const db = getNeonDb();
  const rows = await db
    .select({
      clerkUserId: column,
      n: sql<number>`count(*)::int`,
    })
    .from(table)
    .groupBy(column);
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.clerkUserId) map.set(row.clerkUserId, Number(row.n) || 0);
  }
  return map;
}

async function createdStampsSince(
  table: VolumeTable,
  cutoff: number
): Promise<ActivityStamps["bets"]> {
  const db = getNeonDb();
  const rows = await db
    .select({ createdAt: table.createdAt, clerkUserId: table.clerkUserId })
    .from(table)
    .where(and(isNotNull(table.clerkUserId), gte(table.createdAt, cutoff)));
  const stamps: ActivityStamps["bets"] = [];
  for (const row of rows) {
    if (
      Number.isFinite(row.createdAt) &&
      row.createdAt > 0 &&
      row.clerkUserId
    ) {
      stamps.push({ at: row.createdAt, clerkUserId: row.clerkUserId });
    }
  }
  return stamps;
}

function keyedCounts(
  rows: Array<{ clerkUserId: string | null; key: string | null; n: number }>
): ActivityKeyedCount[] {
  const out: ActivityKeyedCount[] = [];
  for (const row of rows) {
    if (!row.clerkUserId) continue;
    const n = Number(row.n) || 0;
    if (n <= 0) continue;
    out.push({
      clerkUserId: row.clerkUserId,
      key: normaliseActivityKey(row.key),
      n,
    });
  }
  return out;
}

async function countsByUserKey(
  table: VolumeTable,
  userCol: VolumeUserColumn,
  keyExpr: SQL<string> | PgColumn
): Promise<ActivityKeyedCount[]> {
  const db = getNeonDb();
  const rows = await db
    .select({
      clerkUserId: userCol,
      key: keyExpr,
      n: sql<number>`count(*)::int`,
    })
    .from(table)
    .where(isNotNull(userCol))
    .groupBy(userCol, keyExpr);
  return keyedCounts(rows);
}

const unsetText = (column: PgColumn) =>
  sql<string>`coalesce(nullif(btrim(${column}), ''), 'unset')`;

async function loadActivityMix(): Promise<ActivityMix> {
  const [
    betTypes,
    betSports,
    betStatuses,
    betPurposes,
    betSources,
    betCampaigns,
    betBookmakers,
    offerSports,
    offerTypes,
    offerStatuses,
    offerSources,
    offerBookmakers,
    casinoBrands,
    casinoStatuses,
  ] = await Promise.all([
    countsByUserKey(bets, bets.clerkUserId, bets.betType),
    countsByUserKey(bets, bets.clerkUserId, unsetText(bets.sport)),
    countsByUserKey(bets, bets.clerkUserId, bets.status),
    countsByUserKey(
      bets,
      bets.clerkUserId,
      sql<string>`case when ${bets.purpose} = 'mug' then 'mug' else 'edge' end`
    ),
    countsByUserKey(
      bets,
      bets.clerkUserId,
      sql<string>`case when ${bets.source} = 'import' then 'import' when ${bets.quickLogged} is not null then 'quick' else 'typed' end`
    ),
    countsByUserKey(
      bets,
      bets.clerkUserId,
      sql<string>`case when ${bets.offerId} is not null then 'linked' else 'none' end`
    ),
    countsByUserKey(bets, bets.clerkUserId, unsetText(bets.bookmaker)),
    countsByUserKey(offers, offers.clerkUserId, unsetText(offers.sport)),
    countsByUserKey(offers, offers.clerkUserId, unsetText(offers.offerType)),
    countsByUserKey(offers, offers.clerkUserId, offers.status),
    countsByUserKey(
      offers,
      offers.clerkUserId,
      sql<string>`case when ${offers.source} = 'email' then 'email' else 'typed' end`
    ),
    countsByUserKey(offers, offers.clerkUserId, unsetText(offers.bookmaker)),
    countsByUserKey(
      casinoOffers,
      casinoOffers.clerkUserId,
      unsetText(casinoOffers.casino)
    ),
    countsByUserKey(casinoOffers, casinoOffers.clerkUserId, casinoOffers.status),
  ]);
  return {
    betTypes,
    betSports,
    betStatuses,
    betPurposes,
    betSources,
    betCampaigns,
    betBookmakers,
    offerSports,
    offerTypes,
    offerStatuses,
    offerSources,
    offerBookmakers,
    casinoBrands,
    casinoStatuses,
  };
}

function emptyOverview(
  users: AdminUserRow[],
  now: Date,
  note: string
): ActivityOverview {
  return {
    available: false,
    note,
    rows: users.map((user) => emptyRow(user)),
    daily: emptyActivityDaily(now),
    stamps: emptyActivityStamps(),
    mix: emptyActivityMix(),
  };
}

export async function loadActivityOverview(): Promise<ActivityOverview> {
  const users = await listAppUsers();
  const now = new Date();
  if (!usesHostedVolume()) {
    return emptyOverview(
      users,
      now,
      "Activity totals come from hosted Postgres. Set DATABASE_URL to read live per-account volume."
    );
  }

  try {
    const cutoff = now.getTime() - SERIES_COMPARE_DAYS * 24 * 60 * 60 * 1000;
    const [
      betMap,
      offerMap,
      casinoMap,
      betStamps,
      offerStamps,
      casinoStamps,
      mix,
    ] = await Promise.all([
      countsByUser(bets.clerkUserId, bets),
      countsByUser(offers.clerkUserId, offers),
      countsByUser(casinoOffers.clerkUserId, casinoOffers),
      createdStampsSince(bets, cutoff),
      createdStampsSince(offers, cutoff),
      createdStampsSince(casinoOffers, cutoff),
      loadActivityMix(),
    ]);
    return {
      available: true,
      note: "Counts only. Category mix is fleet volume, not another desk's bets, wallets, or P&L.",
      rows: users.map((user) => ({
        clerkUserId: user.clerkUserId,
        email: user.email,
        plan: user.plan,
        admin: user.admin,
        bets: betMap.get(user.clerkUserId) ?? 0,
        offers: offerMap.get(user.clerkUserId) ?? 0,
        casino: casinoMap.get(user.clerkUserId) ?? 0,
      })),
      daily: emptyActivityDaily(now),
      stamps: {
        bets: betStamps,
        offers: offerStamps,
        casino: casinoStamps,
      },
      mix,
    };
  } catch (error) {
    return emptyOverview(
      users,
      now,
      error instanceof Error
        ? error.message
        : "Could not read hosted desk volume."
    );
  }
}

function emptyRow(user: AdminUserRow): DeskActivityRow {
  return {
    clerkUserId: user.clerkUserId,
    email: user.email,
    plan: user.plan,
    admin: user.admin,
    bets: 0,
    offers: 0,
    casino: 0,
  };
}
