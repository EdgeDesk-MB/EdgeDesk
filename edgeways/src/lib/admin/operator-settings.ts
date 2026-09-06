import "server-only";
import { eq } from "drizzle-orm";
import { db, operatorSettings } from "@/lib/db";
import { getNeonDb } from "@/lib/db/neon";
import { operatorSettings as pgOperatorSettings } from "@/lib/db/schema.pg";
import { ensureNeonOperatorSettingsTable } from "@/lib/services/app-users";
import {
  type AppUpdateSettings,
  normalizeAppUpdate,
  parseAppUpdate,
} from "@/lib/admin/app-update-shared";
import {
  type MaintenanceBanner,
  normalizeMaintenanceBanner,
  parseMaintenanceBanner,
} from "@/lib/admin/maintenance-banner-shared";
import {
  getOperatorChromeEnv,
  operatorChromeSettingKey,
  operatorChromeUsesNeon,
} from "@/lib/admin/operator-chrome-env";

export {
  DEFAULT_BANNER,
  MAX_BANNER_MESSAGE_LENGTH,
  parseMaintenanceBanner,
  type MaintenanceBanner,
  type SiteBannerKind,
} from "@/lib/admin/maintenance-banner-shared";
export {
  DEFAULT_APP_UPDATE,
  parseAppUpdate,
  type AppUpdateSettings,
} from "@/lib/admin/app-update-shared";

const BANNER_KEY_BASE = "maintenance_banner";
const APP_UPDATE_KEY_BASE = "app_update";

function chromeKey(base: string): string {
  return operatorChromeSettingKey(base, getOperatorChromeEnv());
}

async function readChromeValue(base: string): Promise<string | undefined> {
  const key = chromeKey(base);
  if (operatorChromeUsesNeon()) {
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

async function writeChromeValue(base: string, value: string): Promise<void> {
  const key = chromeKey(base);
  const now = Date.now();
  if (operatorChromeUsesNeon()) {
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

export async function readMaintenanceBanner(): Promise<MaintenanceBanner> {
  return parseMaintenanceBanner(await readChromeValue(BANNER_KEY_BASE));
}

export async function writeMaintenanceBanner(
  banner: Partial<MaintenanceBanner>
): Promise<MaintenanceBanner> {
  const next = normalizeMaintenanceBanner(banner);
  await writeChromeValue(BANNER_KEY_BASE, JSON.stringify(next));
  return next;
}

export async function readAppUpdateSettings(): Promise<AppUpdateSettings> {
  return parseAppUpdate(await readChromeValue(APP_UPDATE_KEY_BASE));
}

export async function writeAppUpdateSettings(
  update: Partial<AppUpdateSettings>
): Promise<AppUpdateSettings> {
  const next = normalizeAppUpdate(update);
  await writeChromeValue(APP_UPDATE_KEY_BASE, JSON.stringify(next));
  return next;
}
