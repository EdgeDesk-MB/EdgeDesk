import "server-only";
import { and, gte, isNotNull, sql } from "drizzle-orm";
import {
  emptyActivityDaily,
  emptyActivityStamps,
  type ActivityDaily,
  type ActivityStamps,
} from "@/lib/admin/activity-charts";
import { SERIES_COMPARE_DAYS } from "@/lib/admin/series";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { getNeonDb } from "@/lib/db/neon";
import { bets, offers, history } from "@/lib/db/schema.pg";
import { listAppUsers, type AdminUserRow } from "@/lib/services/app-users";

export type DeskActivityRow = {
  clerkUserId: string;
  email: string | null;
  plan: string;
  admin: boolean;
  bets: number;
  offers: number;
  history: number;
};

export type ActivityOverview = {
  available: boolean;
  note: string | null;
  rows: DeskActivityRow[];
  daily: ActivityDaily;
  stamps: ActivityStamps;
};

async function countsByUser(
  column: typeof bets.clerkUserId | typeof offers.clerkUserId | typeof history.clerkUserId,
  table: typeof bets | typeof offers | typeof history
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
  table: typeof bets | typeof offers | typeof history,
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

export async function loadActivityOverview(): Promise<ActivityOverview> {
  const users = await listAppUsers();
  const now = new Date();
  if (!isNeonDesk()) {
    return {
      available: false,
      note: "Desk volume is per-account on this machine’s SQLite file. Activity totals need EDGEWAYS_DESK_BACKEND=neon on the hosted desk.",
      rows: users.map((user) => emptyRow(user)),
      daily: emptyActivityDaily(now),
      stamps: emptyActivityStamps(),
    };
  }

  try {
    const cutoff = now.getTime() - SERIES_COMPARE_DAYS * 24 * 60 * 60 * 1000;
    const [betMap, offerMap, historyMap, betStamps, offerStamps, historyStamps] =
      await Promise.all([
        countsByUser(bets.clerkUserId, bets),
        countsByUser(offers.clerkUserId, offers),
        countsByUser(history.clerkUserId, history),
        createdStampsSince(bets, cutoff),
        createdStampsSince(offers, cutoff),
        createdStampsSince(history, cutoff),
      ]);
    return {
      available: true,
      note: "Counts only. Open a customer desk to see bets, wallets, or P&L.",
      rows: users.map((user) => ({
        clerkUserId: user.clerkUserId,
        email: user.email,
        plan: user.plan,
        admin: user.admin,
        bets: betMap.get(user.clerkUserId) ?? 0,
        offers: offerMap.get(user.clerkUserId) ?? 0,
        history: historyMap.get(user.clerkUserId) ?? 0,
      })),
      daily: emptyActivityDaily(now),
      stamps: {
        bets: betStamps,
        offers: offerStamps,
        history: historyStamps,
      },
    };
  } catch (error) {
    return {
      available: false,
      note:
        error instanceof Error
          ? error.message
          : "Could not read hosted desk volume.",
      rows: users.map((user) => emptyRow(user)),
      daily: emptyActivityDaily(now),
      stamps: emptyActivityStamps(),
    };
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
    history: 0,
  };
}
