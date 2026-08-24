import "server-only";
import { sql } from "drizzle-orm";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { getNeonDb } from "@/lib/db/neon";
import { bets, offers, history } from "@/lib/db/schema.pg";
import { listAppUsers, type AdminUserRow } from "@/lib/services/app-users";

export type DeskActivityRow = {
  clerkUserId: string;
  email: string | null;
  plan: string;
  bets: number;
  offers: number;
  history: number;
};

export type ActivityOverview = {
  available: boolean;
  note: string | null;
  rows: DeskActivityRow[];
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

export async function loadActivityOverview(): Promise<ActivityOverview> {
  const users = await listAppUsers();
  if (!isNeonDesk()) {
    return {
      available: false,
      note: "Desk volume is per-account on this machine’s SQLite file. Activity totals need EDGEWAYS_DESK_BACKEND=neon on the hosted desk.",
      rows: users.map((user) => emptyRow(user)),
    };
  }

  try {
    const [betMap, offerMap, historyMap] = await Promise.all([
      countsByUser(bets.clerkUserId, bets),
      countsByUser(offers.clerkUserId, offers),
      countsByUser(history.clerkUserId, history),
    ]);
    return {
      available: true,
      note: "Counts only. Open a customer desk to see bets, wallets, or P&L.",
      rows: users.map((user) => ({
        clerkUserId: user.clerkUserId,
        email: user.email,
        plan: user.plan,
        bets: betMap.get(user.clerkUserId) ?? 0,
        offers: offerMap.get(user.clerkUserId) ?? 0,
        history: historyMap.get(user.clerkUserId) ?? 0,
      })),
    };
  } catch (error) {
    return {
      available: false,
      note:
        error instanceof Error
          ? error.message
          : "Could not read hosted desk volume.",
      rows: users.map((user) => emptyRow(user)),
    };
  }
}

function emptyRow(user: AdminUserRow): DeskActivityRow {
  return {
    clerkUserId: user.clerkUserId,
    email: user.email,
    plan: user.plan,
    bets: 0,
    offers: 0,
    history: 0,
  };
}
