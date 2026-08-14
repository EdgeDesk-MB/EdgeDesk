/**
 * Hosted account row keyed by Clerk user id (EDGE-20 / EDGE-47).
 * Neon when DATABASE_URL is set; SQLite otherwise (local Mac + Vitest).
 */
import "server-only";
import { eq } from "drizzle-orm";
import {
  db as sqliteDb,
  appUsers as sqliteUsers,
  type AppUserRow as SqliteAppUserRow,
} from "@/lib/db";
import { getNeonDb } from "@/lib/db/neon";
import { appUsers as pgUsers } from "@/lib/db/schema.pg";

export type AppUser = {
  clerkUserId: string;
  email: string | null;
  createdAt: number;
  updatedAt: number;
};

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function fromSqlite(row: SqliteAppUserRow): AppUser {
  return {
    clerkUserId: row.clerkUserId,
    email: row.email ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function fromPg(row: {
  clerkUserId: string;
  email: string | null;
  createdAt: number;
  updatedAt: number;
}): AppUser {
  return {
    clerkUserId: row.clerkUserId,
    email: row.email ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function normaliseAppUserEmail(
  email: string | null | undefined
): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export async function findAppUserByClerkId(
  clerkUserId: string
): Promise<AppUser | undefined> {
  if (usesHostedPostgres()) {
    const rows = await getNeonDb()
      .select()
      .from(pgUsers)
      .where(eq(pgUsers.clerkUserId, clerkUserId))
      .limit(1);
    const row = rows[0];
    return row ? fromPg(row) : undefined;
  }

  const row = sqliteDb
    .select()
    .from(sqliteUsers)
    .where(eq(sqliteUsers.clerkUserId, clerkUserId))
    .get() as SqliteAppUserRow | undefined;
  return row ? fromSqlite(row) : undefined;
}

/** Insert or refresh email on an existing Clerk-keyed row. */
export async function ensureAppUser(input: {
  clerkUserId: string;
  email?: string | null;
}): Promise<AppUser> {
  const clerkUserId = input.clerkUserId.trim();
  if (!clerkUserId) {
    throw new Error("clerkUserId is required.");
  }
  const email = normaliseAppUserEmail(input.email);
  const now = Date.now();
  const existing = await findAppUserByClerkId(clerkUserId);
  const createdAt = existing?.createdAt ?? now;
  const nextEmail = email ?? existing?.email ?? null;

  if (usesHostedPostgres()) {
    await getNeonDb()
      .insert(pgUsers)
      .values({
        clerkUserId,
        email: nextEmail,
        createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: pgUsers.clerkUserId,
        set: { email: nextEmail, updatedAt: now },
      });
  } else {
    sqliteDb
      .insert(sqliteUsers)
      .values({
        clerkUserId,
        email: nextEmail,
        createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: sqliteUsers.clerkUserId,
        set: { email: nextEmail, updatedAt: now },
      })
      .run();
  }

  return {
    clerkUserId,
    email: nextEmail,
    createdAt,
    updatedAt: now,
  };
}
