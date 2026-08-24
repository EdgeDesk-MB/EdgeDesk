import "server-only";
import { eq } from "drizzle-orm";
import { db, operatorSettings } from "@/lib/db";
import { getNeonDb } from "@/lib/db/neon";
import { operatorSettings as pgOperatorSettings } from "@/lib/db/schema.pg";
import { ensureNeonOperatorSettingsTable } from "@/lib/services/app-users";

const BANNER_KEY = "maintenance_banner";

/** Keep the banner to one readable line on every surface. */
export const MAX_BANNER_MESSAGE_LENGTH = 280;

export type MaintenanceBanner = {
  enabled: boolean;
  message: string;
};

const DEFAULT_BANNER: MaintenanceBanner = {
  enabled: false,
  message: "Edgeways is under maintenance. The desk will be back shortly.",
};

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function parseBanner(raw: string | null | undefined): MaintenanceBanner {
  if (!raw) return DEFAULT_BANNER;
  try {
    const parsed = JSON.parse(raw) as Partial<MaintenanceBanner>;
    return {
      enabled: Boolean(parsed.enabled),
      message:
        typeof parsed.message === "string" && parsed.message.trim()
          ? parsed.message.trim()
          : DEFAULT_BANNER.message,
    };
  } catch {
    return DEFAULT_BANNER;
  }
}

export async function readMaintenanceBanner(): Promise<MaintenanceBanner> {
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    const rows = await getNeonDb()
      .select()
      .from(pgOperatorSettings)
      .where(eq(pgOperatorSettings.key, BANNER_KEY))
      .limit(1);
    return parseBanner(rows[0]?.value);
  }
  const row = db
    .select()
    .from(operatorSettings)
    .where(eq(operatorSettings.key, BANNER_KEY))
    .get();
  return parseBanner(row?.value);
}

export async function writeMaintenanceBanner(
  banner: MaintenanceBanner
): Promise<MaintenanceBanner> {
  const trimmed =
    typeof banner.message === "string" ? banner.message.trim() : "";
  const next: MaintenanceBanner = {
    enabled: Boolean(banner.enabled),
    message:
      (trimmed || DEFAULT_BANNER.message).slice(0, MAX_BANNER_MESSAGE_LENGTH),
  };
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
