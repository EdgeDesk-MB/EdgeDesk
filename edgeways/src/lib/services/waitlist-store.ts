/**
 * Waitlist persistence: Neon when DATABASE_URL is set (Vercel / hosted),
 * SQLite otherwise (local Mac + Vitest).
 */
import "server-only";
import { desc, eq } from "drizzle-orm";
import {
  db as sqliteDb,
  waitlistSignups as sqliteWaitlist,
  type WaitlistSignupRow as SqliteWaitlistRow,
} from "@/lib/db";
import { getNeonDb } from "@/lib/db/neon";
import { waitlistSignups as pgWaitlist } from "@/lib/db/schema.pg";

export type WaitlistRow = {
  id: number;
  email: string;
  confirmTokenHash: string;
  createdAt: number;
  confirmedAt: number | null;
  confirmSentAt: number | null;
  unsubscribedAt: number | null;
};

/** Hosted Postgres when DATABASE_URL is present (production waitlist path). */
export function usesNeonWaitlist(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function fromSqlite(row: SqliteWaitlistRow): WaitlistRow {
  return {
    id: row.id,
    email: row.email,
    confirmTokenHash: row.confirmTokenHash,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt ?? null,
    confirmSentAt: row.confirmSentAt ?? null,
    unsubscribedAt: row.unsubscribedAt ?? null,
  };
}

export async function findWaitlistByEmail(
  email: string
): Promise<WaitlistRow | undefined> {
  if (usesNeonWaitlist()) {
    const rows = await getNeonDb()
      .select()
      .from(pgWaitlist)
      .where(eq(pgWaitlist.email, email))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      email: row.email,
      confirmTokenHash: row.confirmTokenHash,
      createdAt: row.createdAt,
      confirmedAt: row.confirmedAt ?? null,
      confirmSentAt: row.confirmSentAt ?? null,
      unsubscribedAt: row.unsubscribedAt ?? null,
    };
  }

  const row = sqliteDb
    .select()
    .from(sqliteWaitlist)
    .where(eq(sqliteWaitlist.email, email))
    .get() as SqliteWaitlistRow | undefined;
  return row ? fromSqlite(row) : undefined;
}

export async function findWaitlistByTokenHash(
  tokenHash: string
): Promise<WaitlistRow | undefined> {
  if (usesNeonWaitlist()) {
    const rows = await getNeonDb()
      .select()
      .from(pgWaitlist)
      .where(eq(pgWaitlist.confirmTokenHash, tokenHash))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      email: row.email,
      confirmTokenHash: row.confirmTokenHash,
      createdAt: row.createdAt,
      confirmedAt: row.confirmedAt ?? null,
      confirmSentAt: row.confirmSentAt ?? null,
      unsubscribedAt: row.unsubscribedAt ?? null,
    };
  }

  const row = sqliteDb
    .select()
    .from(sqliteWaitlist)
    .where(eq(sqliteWaitlist.confirmTokenHash, tokenHash))
    .get() as SqliteWaitlistRow | undefined;
  return row ? fromSqlite(row) : undefined;
}

export async function insertWaitlistSignup(input: {
  email: string;
  confirmTokenHash: string;
  createdAt: number;
  confirmedAt: number;
  confirmSentAt: number;
}): Promise<void> {
  if (usesNeonWaitlist()) {
    await getNeonDb().insert(pgWaitlist).values({
      email: input.email,
      confirmTokenHash: input.confirmTokenHash,
      createdAt: input.createdAt,
      confirmedAt: input.confirmedAt,
      confirmSentAt: input.confirmSentAt,
      unsubscribedAt: null,
    });
    return;
  }

  sqliteDb
    .insert(sqliteWaitlist)
    .values({
      email: input.email,
      confirmTokenHash: input.confirmTokenHash,
      createdAt: input.createdAt,
      confirmedAt: input.confirmedAt,
      confirmSentAt: input.confirmSentAt,
      unsubscribedAt: null,
    })
    .run();
}

export async function updateWaitlistSignup(
  id: number,
  patch: {
    confirmTokenHash?: string;
    confirmedAt?: number | null;
    confirmSentAt?: number | null;
    unsubscribedAt?: number | null;
  }
): Promise<void> {
  if (usesNeonWaitlist()) {
    await getNeonDb()
      .update(pgWaitlist)
      .set(patch)
      .where(eq(pgWaitlist.id, id));
    return;
  }

  sqliteDb
    .update(sqliteWaitlist)
    .set(patch)
    .where(eq(sqliteWaitlist.id, id))
    .run();
}

export async function listWaitlistSignups(limit = 100): Promise<WaitlistRow[]> {
  const cap = Math.min(Math.max(limit, 1), 500);
  if (usesNeonWaitlist()) {
    const rows = await getNeonDb()
      .select()
      .from(pgWaitlist)
      .orderBy(desc(pgWaitlist.createdAt))
      .limit(cap);
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      confirmTokenHash: row.confirmTokenHash,
      createdAt: row.createdAt,
      confirmedAt: row.confirmedAt ?? null,
      confirmSentAt: row.confirmSentAt ?? null,
      unsubscribedAt: row.unsubscribedAt ?? null,
    }));
  }
  const rows = sqliteDb
    .select()
    .from(sqliteWaitlist)
    .orderBy(desc(sqliteWaitlist.createdAt))
    .limit(cap)
    .all() as SqliteWaitlistRow[];
  return rows.map(fromSqlite);
}
