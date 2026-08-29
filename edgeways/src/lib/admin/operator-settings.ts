import "server-only";
import { eq } from "drizzle-orm";
import { db, operatorSettings } from "@/lib/db";
import { getNeonDb } from "@/lib/db/neon";
import { operatorSettings as pgOperatorSettings } from "@/lib/db/schema.pg";
import { ensureNeonOperatorSettingsTable } from "@/lib/services/app-users";
import {
  type MaintenanceBanner,
  normalizeMaintenanceBanner,
  parseMaintenanceBanner,
} from "@/lib/admin/maintenance-banner-shared";

export {
  DEFAULT_BANNER,
  MAX_BANNER_MESSAGE_LENGTH,
  parseMaintenanceBanner,
  type MaintenanceBanner,
  type SiteBannerKind,
} from "@/lib/admin/maintenance-banner-shared";

const BANNER_KEY = "maintenance_banner";

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function readMaintenanceBanner(): Promise<MaintenanceBanner> {
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    const rows = await getNeonDb()
      .select()
      .from(pgOperatorSettings)
      .where(eq(pgOperatorSettings.key, BANNER_KEY))
      .limit(1);
    return parseMaintenanceBanner(rows[0]?.value);
  }
  const row = db
    .select()
    .from(operatorSettings)
    .where(eq(operatorSettings.key, BANNER_KEY))
    .get();
  return parseMaintenanceBanner(row?.value);
}

export async function writeMaintenanceBanner(
  banner: Partial<MaintenanceBanner>
): Promise<MaintenanceBanner> {
  const next = normalizeMaintenanceBanner(banner);
  const value = JSON.stringify(next);
  const now = Date.now();
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    await getNeonDb()
      .insert(pgOperatorSettings)
      .values({ key: BANNER_KEY, value, updatedAt: now })
      .onConflictDoUpdate({
        target: pgOperatorSettings.key,
        set: { value, updatedAt: now },
      });
    return next;
  }
  db.insert(operatorSettings)
    .values({ key: BANNER_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: operatorSettings.key,
      set: { value, updatedAt: now },
    })
    .run();
  return next;
}
