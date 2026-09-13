import "server-only";
import { desc, eq, inArray, isNull, lt } from "drizzle-orm";
import {
  assembleLiveBundles,
  type AssembledLiveBundles,
} from "@/lib/admin/live-ingest";
import {
  adminLiveLogDedupe,
  type LiveBundle,
  type LiveEventTone,
} from "@/lib/admin/live-bundle";
import {
  ADMIN_LIVE_LOG_CAP,
  ADMIN_LIVE_LOG_INGEST_DEBOUNCE_MS,
  ADMIN_LIVE_LOG_MAX_AGE_MS,
  type AdminLiveLogList,
  type AdminLiveLogRow,
} from "@/lib/admin/live-log-shared";
import { londonDayRangeMs, londonYmd } from "@/lib/admin/activity-day";
import {
  liveBundleConfigFromSettings,
  readAdminLiveLogCursor,
  readAdminLiveSettings,
  writeAdminLiveLogCursor,
} from "@/lib/admin/live-settings";
import { db, adminLiveLog as sqliteLog } from "@/lib/db";
import { getNeonDb, getNeonSql } from "@/lib/db/neon";
import { adminLiveLog as pgLog } from "@/lib/db/schema.pg";

export type { AdminLiveLogList, AdminLiveLogRow } from "@/lib/admin/live-log-shared";

export type AdminLiveIngestResult = {
  skipped: string | null;
  recorded: number;
  bundles: number;
};

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

let neonTableReady = false;
let lastIngestAt = 0;

export function resetAdminLiveLogIngestDebounceForTests(): void {
  lastIngestAt = 0;
}

async function ensureNeonAdminLiveLogTable(): Promise<void> {
  if (neonTableReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS admin_live_log (
      id SERIAL PRIMARY KEY,
      dedupe TEXT NOT NULL,
      kind TEXT NOT NULL,
      tone TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      href TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      read_at BIGINT
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS admin_live_log_dedupe_unique ON admin_live_log (dedupe)`;
  await sql`CREATE INDEX IF NOT EXISTS admin_live_log_updated_idx ON admin_live_log (updated_at)`;
  neonTableReady = true;
}

function asTone(value: string): LiveEventTone {
  if (value === "warning" || value === "error") return value;
  return "success";
}

function toRow(row: {
  id: number;
  dedupe: string;
  kind: string;
  tone: string;
  title: string;
  body: string | null;
  href: string;
  count: number;
  createdAt: number;
  updatedAt: number;
  readAt: number | null;
}): AdminLiveLogRow {
  return {
    id: row.id,
    dedupe: row.dedupe,
    kind: row.kind,
    tone: asTone(row.tone),
    title: row.title,
    body: row.body,
    href: row.href,
    count: row.count,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    readAt: row.readAt,
  };
}

async function findByDedupe(dedupe: string): Promise<AdminLiveLogRow | null> {
  if (usesHostedPostgres()) {
    await ensureNeonAdminLiveLogTable();
    const rows = await getNeonDb()
      .select()
      .from(pgLog)
      .where(eq(pgLog.dedupe, dedupe))
      .limit(1);
    return rows[0] ? toRow(rows[0]) : null;
  }
  const row = db
    .select()
    .from(sqliteLog)
    .where(eq(sqliteLog.dedupe, dedupe))
    .get();
  return row ? toRow(row) : null;
}

async function insertRow(values: {
  dedupe: string;
  kind: string;
  tone: LiveEventTone;
  title: string;
  body: string | null;
  href: string;
  count: number;
  createdAt: number;
  updatedAt: number;
  readAt: number | null;
}): Promise<void> {
  if (usesHostedPostgres()) {
    await ensureNeonAdminLiveLogTable();
    await getNeonDb().insert(pgLog).values(values);
    return;
  }
  db.insert(sqliteLog).values(values).run();
}

async function updateCoalesceRow(
  id: number,
  values: {
    kind: string;
    tone: LiveEventTone;
    title: string;
    body: string | null;
    href: string;
    count: number;
    updatedAt: number;
    readAt: number | null;
  }
): Promise<void> {
  if (usesHostedPostgres()) {
    await ensureNeonAdminLiveLogTable();
    await getNeonDb().update(pgLog).set(values).where(eq(pgLog.id, id));
    return;
  }
  db.update(sqliteLog).set(values).where(eq(sqliteLog.id, id)).run();
}

export async function recordAdminLiveBundles(
  bundles: LiveBundle[],
  now = Date.now()
): Promise<number> {
  let recorded = 0;
  for (const bundle of bundles) {
    const dedupe = adminLiveLogDedupe(bundle, now);
    const existing = await findByDedupe(dedupe);
    const body = bundle.body ?? null;
    const readAt = bundle.tone === "success" ? now : null;
    if (!existing) {
      await insertRow({
        dedupe,
        kind: bundle.kind,
        tone: bundle.tone,
        title: bundle.title,
        body,
        href: bundle.href,
        count: bundle.count,
        createdAt: bundle.at ?? now,
        updatedAt: now,
        readAt,
      });
      recorded += 1;
      continue;
    }
    if (!bundle.coalesceKey) continue;
    await updateCoalesceRow(existing.id, {
      kind: bundle.kind,
      tone: bundle.tone,
      title: bundle.title,
      body,
      href: bundle.href,
      count: bundle.count,
      updatedAt: now,
      readAt: bundle.tone === "success" ? existing.readAt : null,
    });
    recorded += 1;
  }
  await pruneAdminLiveLog(now);
  return recorded;
}

export async function pruneAdminLiveLog(now = Date.now()): Promise<void> {
  const cutoff = now - ADMIN_LIVE_LOG_MAX_AGE_MS;
  if (usesHostedPostgres()) {
    await ensureNeonAdminLiveLogTable();
    const neon = getNeonDb();
    await neon.delete(pgLog).where(lt(pgLog.createdAt, cutoff));
    const extras = await neon
      .select({ id: pgLog.id })
      .from(pgLog)
      .orderBy(desc(pgLog.updatedAt))
      .offset(ADMIN_LIVE_LOG_CAP)
      .limit(500);
    if (extras.length > 0) {
      await neon.delete(pgLog).where(
        inArray(
          pgLog.id,
          extras.map((row) => row.id)
        )
      );
    }
    return;
  }
  db.delete(sqliteLog).where(lt(sqliteLog.createdAt, cutoff)).run();
  const extras = db
    .select({ id: sqliteLog.id })
    .from(sqliteLog)
    .orderBy(desc(sqliteLog.updatedAt))
    .limit(500)
    .offset(ADMIN_LIVE_LOG_CAP)
    .all();
  if (extras.length > 0) {
    db.delete(sqliteLog)
      .where(
        inArray(
          sqliteLog.id,
          extras.map((row) => row.id)
        )
      )
      .run();
  }
}

export async function listAdminLiveLog(): Promise<AdminLiveLogList> {
  const fetchLimit = ADMIN_LIVE_LOG_CAP + 1;
  if (usesHostedPostgres()) {
    await ensureNeonAdminLiveLogTable();
    const rows = await getNeonDb()
      .select()
      .from(pgLog)
      .orderBy(desc(pgLog.updatedAt))
      .limit(fetchLimit);
    const truncated = rows.length > ADMIN_LIVE_LOG_CAP;
    const mapped = rows.slice(0, ADMIN_LIVE_LOG_CAP).map(toRow);
    return {
      rows: mapped,
      unread: mapped.filter((row) => row.readAt == null).length,
      truncated,
    };
  }
  const rows = db
    .select()
    .from(sqliteLog)
    .orderBy(desc(sqliteLog.updatedAt))
    .limit(fetchLimit)
    .all();
  const truncated = rows.length > ADMIN_LIVE_LOG_CAP;
  const mapped = rows.slice(0, ADMIN_LIVE_LOG_CAP).map(toRow);
  return {
    rows: mapped,
    unread: mapped.filter((row) => row.readAt == null).length,
    truncated,
  };
}

export async function markAdminLiveLogRead(
  input: { id: number } | { all: true },
  now = Date.now()
): Promise<number> {
  if (usesHostedPostgres()) {
    await ensureNeonAdminLiveLogTable();
    const neon = getNeonDb();
    if ("all" in input) {
      const updated = await neon
        .update(pgLog)
        .set({ readAt: now })
        .where(isNull(pgLog.readAt))
        .returning({ id: pgLog.id });
      return updated.length;
    }
    const updated = await neon
      .update(pgLog)
      .set({ readAt: now })
      .where(eq(pgLog.id, input.id))
      .returning({ id: pgLog.id });
    return updated.length;
  }
  if ("all" in input) {
    const result = db
      .update(sqliteLog)
      .set({ readAt: now })
      .where(isNull(sqliteLog.readAt))
      .run();
    return result.changes;
  }
  const result = db
    .update(sqliteLog)
    .set({ readAt: now })
    .where(eq(sqliteLog.id, input.id))
    .run();
  return result.changes;
}

/**
 * First run backfills one bundle window so Live is not empty.
 * Later ticks only record what is new since the log cursor.
 * Debounced so the Live page poll does not double the snapshot.
 */
export async function ingestAdminLiveLog(input?: {
  now?: number;
  force?: boolean;
  pingNeon?: boolean;
}): Promise<AdminLiveIngestResult & { assembled?: AssembledLiveBundles }> {
  const now = input?.now ?? Date.now();
  if (
    !input?.force &&
    lastIngestAt > 0 &&
    now - lastIngestAt < ADMIN_LIVE_LOG_INGEST_DEBOUNCE_MS
  ) {
    return { skipped: "debounce", recorded: 0, bundles: 0 };
  }

  const [settings, cursor] = await Promise.all([
    readAdminLiveSettings(),
    readAdminLiveLogCursor(),
  ]);
  const config = liveBundleConfigFromSettings(settings);
  const todayStart =
    londonDayRangeMs(londonYmd(new Date(now)))?.start ?? now - 86_400_000;
  const since =
    cursor.since > 0
      ? input?.force
        ? Math.min(cursor.since, todayStart)
        : cursor.since
      : todayStart;

  const assembled = await assembleLiveBundles({
    since,
    now,
    pingNeon: input?.pingNeon === true,
    critical: cursor.critical,
    config,
    purpose: "log",
  });
  const recorded = await recordAdminLiveBundles(assembled.bundles, now);
  await writeAdminLiveLogCursor({
    since: assembled.snapshotNow,
    critical: assembled.memory.critical,
  });
  lastIngestAt = now;
  return {
    skipped: null,
    recorded,
    bundles: assembled.bundles.length,
    assembled,
  };
}
