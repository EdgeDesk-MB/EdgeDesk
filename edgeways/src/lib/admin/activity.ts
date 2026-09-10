import "server-only";
import { and, eq, gte, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import {
  emptyActivityDaily,
  emptyActivityStamps,
  type ActivityDaily,
  type ActivityStamps,
} from "@/lib/admin/activity-charts";
import {
  londonDayRangeMs,
  resolveActivityMixDay,
  type ActivityDayRange,
} from "@/lib/admin/activity-day";
import {
  emptyActivityMix,
  normaliseActivityKey,
  type ActivityKeyedCount,
  type ActivityMix,
} from "@/lib/admin/activity-mix";
import {
  emptyActivityPinDesks,
  type ActivityPinDesk,
} from "@/lib/admin/activity-pins";
import { SERIES_COMPARE_DAYS } from "@/lib/admin/series";
import { getNeonDb } from "@/lib/db/neon";
import { listNeonDeskFavouritePins } from "@/lib/db/neon-desk-settings";
import { bets, casinoOffers, events, offers } from "@/lib/db/schema.pg";
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

function volumeWhere(
  userCol: VolumeUserColumn,
  createdAt: VolumeTable["createdAt"],
  range?: ActivityDayRange
) {
  if (!range) return isNotNull(userCol);
  return and(
    isNotNull(userCol),
    gte(createdAt, range.start),
    lt(createdAt, range.endExclusive)
  );
}

async function countsByUserKey(
  table: VolumeTable,
  userCol: VolumeUserColumn,
  keyExpr: SQL<string> | PgColumn,
  range?: ActivityDayRange
): Promise<ActivityKeyedCount[]> {
  const db = getNeonDb();
  const rows = await db
    .select({
      clerkUserId: userCol,
      key: keyExpr,
      n: sql<number>`count(*)::int`,
    })
    .from(table)
    .where(volumeWhere(userCol, table.createdAt, range))
    .groupBy(userCol, keyExpr);
  return keyedCounts(rows);
}

const unsetText = (column: PgColumn) =>
  sql<string>`coalesce(nullif(btrim(${column}), ''), 'unset')`;

/** Keep in step with `resolveActivitySport` in activity-mix.ts. */
const resolvedBetSport = sql<string>`coalesce(
  nullif(btrim(${events.sport}), ''),
  nullif(btrim(${bets.sport}), ''),
  nullif(btrim(${offers.sport}), ''),
  case
    when ${bets.market} in ('win', 'place', 'each_way', 'extra_place') then 'horse_racing'
    when ${bets.market} in ('match_winner', 'set_betting') then 'tennis'
    when ${bets.market} in ('outright', 'top_finish') then 'golf'
    else 'football'
  end
)`;

async function countsByResolvedBetSport(
  range?: ActivityDayRange
): Promise<ActivityKeyedCount[]> {
  const db = getNeonDb();
  const rows = await db
    .select({
      clerkUserId: bets.clerkUserId,
      key: resolvedBetSport,
      n: sql<number>`count(*)::int`,
    })
    .from(bets)
    .leftJoin(events, eq(bets.eventId, events.id))
    .leftJoin(offers, eq(bets.offerId, offers.id))
    .where(volumeWhere(bets.clerkUserId, bets.createdAt, range))
    .groupBy(bets.clerkUserId, resolvedBetSport);
  return keyedCounts(rows);
}

async function queryActivityMix(range?: ActivityDayRange): Promise<ActivityMix> {
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
    countsByUserKey(bets, bets.clerkUserId, bets.betType, range),
    countsByResolvedBetSport(range),
    countsByUserKey(bets, bets.clerkUserId, bets.status, range),
    countsByUserKey(
      bets,
      bets.clerkUserId,
      sql<string>`case when ${bets.purpose} = 'mug' then 'mug' else 'edge' end`,
      range
    ),
    countsByUserKey(
      bets,
      bets.clerkUserId,
      sql<string>`case when ${bets.source} = 'import' then 'import' when ${bets.quickLogged} is not null then 'quick' else 'typed' end`,
      range
    ),
    countsByUserKey(
      bets,
      bets.clerkUserId,
      sql<string>`case when ${bets.offerId} is not null then 'linked' else 'none' end`,
      range
    ),
    countsByUserKey(bets, bets.clerkUserId, unsetText(bets.bookmaker), range),
    countsByUserKey(offers, offers.clerkUserId, unsetText(offers.sport), range),
    countsByUserKey(offers, offers.clerkUserId, unsetText(offers.offerType), range),
    countsByUserKey(offers, offers.clerkUserId, offers.status, range),
    countsByUserKey(
      offers,
      offers.clerkUserId,
      sql<string>`case when ${offers.source} = 'email' then 'email' else 'typed' end`,
      range
    ),
    countsByUserKey(offers, offers.clerkUserId, unsetText(offers.bookmaker), range),
    countsByUserKey(
      casinoOffers,
      casinoOffers.clerkUserId,
      unsetText(casinoOffers.casino),
      range
    ),
    countsByUserKey(
      casinoOffers,
      casinoOffers.clerkUserId,
      casinoOffers.status,
      range
    ),
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

export async function loadActivityPins(): Promise<ActivityPinDesk[]> {
  if (!usesHostedVolume()) return emptyActivityPinDesks();
  try {
    return await listNeonDeskFavouritePins();
  } catch {
    return emptyActivityPinDesks();
  }
}

export async function loadActivityMixForDay(ymd: string): Promise<ActivityMix> {
  if (!usesHostedVolume()) return emptyActivityMix();
  const range = londonDayRangeMs(resolveActivityMixDay(ymd));
  if (!range) return emptyActivityMix();
  try {
    return await queryActivityMix(range);
  } catch {
    return emptyActivityMix();
  }
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
      queryActivityMix(),
    ]);
    return {
      available: true,
      note: "Counts only. Category mix is that day's created rows, not another desk's bets, wallets, or P&L.",
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
