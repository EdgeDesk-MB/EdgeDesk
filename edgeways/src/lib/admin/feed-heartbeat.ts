import "server-only";
import { eq } from "drizzle-orm";
import { db, operatorSettings } from "@/lib/db";
import { getNeonDb } from "@/lib/db/neon";
import { operatorSettings as pgOperatorSettings } from "@/lib/db/schema.pg";
import { ensureNeonOperatorSettingsTable } from "@/lib/services/app-users";

/**
 * Last-known outcome per feed, so the admin card can say "failing since 4am"
 * rather than only "worked just now". Stored in operator_settings as JSON —
 * global coordination data, no clerk scoping. Recorded on every manual test
 * and (where the poller reports) on scheduled polls.
 */

export type FeedHeartbeatKind = "football" | "racing" | "exchange";

export type FeedHeartbeat = {
  /** Epoch ms of the last check that succeeded. */
  lastOkAt: number | null;
  /** Epoch ms of the last check that failed. */
  lastErrorAt: number | null;
  /** Last error message, cleared on the next success. */
  lastError: string | null;
};

const KEY_PREFIX = "feed_heartbeat_";

const EMPTY: FeedHeartbeat = {
  lastOkAt: null,
  lastErrorAt: null,
  lastError: null,
};

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function parseHeartbeat(raw: string | null | undefined): FeedHeartbeat {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<FeedHeartbeat>;
    return {
      lastOkAt: Number.isFinite(parsed.lastOkAt) ? Number(parsed.lastOkAt) : null,
      lastErrorAt: Number.isFinite(parsed.lastErrorAt) ? Number(parsed.lastErrorAt) : null,
      lastError:
        typeof parsed.lastError === "string" && parsed.lastError.trim()
          ? parsed.lastError.trim()
          : null,
    };
  } catch {
    return EMPTY;
  }
}

export async function readFeedHeartbeat(
  kind: FeedHeartbeatKind
): Promise<FeedHeartbeat> {
  const key = `${KEY_PREFIX}${kind}`;
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    const rows = await getNeonDb()
      .select()
      .from(pgOperatorSettings)
      .where(eq(pgOperatorSettings.key, key))
      .limit(1);
    return parseHeartbeat(rows[0]?.value);
  }
  const row = db
    .select()
    .from(operatorSettings)
    .where(eq(operatorSettings.key, key))
    .get();
  return parseHeartbeat(row?.value);
}

export async function readAllFeedHeartbeats(): Promise<
  Record<FeedHeartbeatKind, FeedHeartbeat>
> {
  const [football, racing, exchange] = await Promise.all([
    readFeedHeartbeat("football"),
    readFeedHeartbeat("racing"),
    readFeedHeartbeat("exchange"),
  ]);
  return { football, racing, exchange };
}

export async function recordFeedHeartbeat(
  kind: FeedHeartbeatKind,
  outcome: { ok: boolean; message?: string },
  now: number = Date.now()
): Promise<void> {
  const existing = await readFeedHeartbeat(kind);
  const next: FeedHeartbeat = outcome.ok
    ? { lastOkAt: now, lastErrorAt: existing.lastErrorAt, lastError: null }
    : {
        lastOkAt: existing.lastOkAt,
        lastErrorAt: now,
        lastError: outcome.message?.trim() || "Check failed.",
      };
  const key = `${KEY_PREFIX}${kind}`;
  const value = JSON.stringify(next);
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    await getNeonDb()
      .insert(pgOperatorSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: pgOperatorSettings.key,
        set: { value, updatedAt: now },
      });
    return;
  }
  db.insert(operatorSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: operatorSettings.key,
      set: { value, updatedAt: now },
    })
    .run();
}
