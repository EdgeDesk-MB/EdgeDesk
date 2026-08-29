import "server-only";
import { eq } from "drizzle-orm";
import { db, operatorSettings } from "@/lib/db";
import { getNeonDb } from "@/lib/db/neon";
import { operatorSettings as pgOperatorSettings } from "@/lib/db/schema.pg";
import { ensureNeonOperatorSettingsTable } from "@/lib/services/app-users";
import {
  parseAdminLivePushCursor,
  parseAdminLiveSettings,
  type AdminLivePushCursor,
  type AdminLiveSettings,
} from "@/lib/admin/live-settings-shared";

export {
  DEFAULT_ADMIN_LIVE_SETTINGS,
  EMPTY_ADMIN_LIVE_PUSH_CURSOR,
  liveBundleConfigFromSettings,
  parseAdminLivePushCursor,
  parseAdminLiveSettings,
  type AdminLivePushCursor,
  type AdminLiveSettings,
} from "@/lib/admin/live-settings-shared";

const LIVE_SETTINGS_KEY = "admin_live";
const LIVE_PUSH_CURSOR_KEY = "admin_live_push_cursor";
const LIVE_LOG_CURSOR_KEY = "admin_live_log_cursor";

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function readOperatorValue(key: string): Promise<string | undefined> {
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    const rows = await getNeonDb()
      .select()
      .from(pgOperatorSettings)
      .where(eq(pgOperatorSettings.key, key))
      .limit(1);
    return rows[0]?.value;
  }
  return db
    .select()
    .from(operatorSettings)
    .where(eq(operatorSettings.key, key))
    .get()?.value;
}

async function writeOperatorValue(key: string, value: string): Promise<void> {
  const now = Date.now();
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

export async function readAdminLiveSettings(): Promise<AdminLiveSettings> {
  return parseAdminLiveSettings(await readOperatorValue(LIVE_SETTINGS_KEY));
}

export async function writeAdminLiveSettings(
  patch: Partial<AdminLiveSettings>
): Promise<AdminLiveSettings> {
  const current = await readAdminLiveSettings();
  const next = parseAdminLiveSettings(JSON.stringify({ ...current, ...patch }));
  await writeOperatorValue(LIVE_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function readAdminLivePushCursor(): Promise<AdminLivePushCursor> {
  return parseAdminLivePushCursor(await readOperatorValue(LIVE_PUSH_CURSOR_KEY));
}

export async function writeAdminLivePushCursor(
  cursor: AdminLivePushCursor
): Promise<AdminLivePushCursor> {
  const next: AdminLivePushCursor = {
    since: Math.max(0, Math.floor(cursor.since)),
    critical: { ...cursor.critical },
  };
  await writeOperatorValue(LIVE_PUSH_CURSOR_KEY, JSON.stringify(next));
  return next;
}

export async function readAdminLiveLogCursor(): Promise<AdminLivePushCursor> {
  return parseAdminLivePushCursor(await readOperatorValue(LIVE_LOG_CURSOR_KEY));
}

export async function writeAdminLiveLogCursor(
  cursor: AdminLivePushCursor
): Promise<AdminLivePushCursor> {
  const next: AdminLivePushCursor = {
    since: Math.max(0, Math.floor(cursor.since)),
    critical: { ...cursor.critical },
  };
  await writeOperatorValue(LIVE_LOG_CURSOR_KEY, JSON.stringify(next));
  return next;
}
