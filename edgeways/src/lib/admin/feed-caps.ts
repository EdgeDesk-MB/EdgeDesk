/**
 * Operator-tunable feed caps, stored in operator_settings so the daily ceiling
 * can be raised from /admin/feeds when the provider plan is upgraded — no
 * deploy. Football's cap is the hard spend guard in services/apifootball.ts;
 * racing's is a soft alert threshold on the monitor (its real provider limit
 * is per-second, not per-day).
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db, operatorSettings } from "@/lib/db";
import { getNeonDb } from "@/lib/db/neon";
import { operatorSettings as pgOperatorSettings } from "@/lib/db/schema.pg";
import { ensureNeonOperatorSettingsTable } from "@/lib/services/app-users";
import { DAILY_BUDGET } from "@/lib/services/apifootball";

const FEED_CAPS_KEY = "feed_caps";

export type FeedCaps = {
  /** Hard daily request cap for API-Football spend. */
  football: number;
  /** Soft daily alert threshold for Racing API requests. */
  racing: number;
};

export const DEFAULT_FEED_CAPS: FeedCaps = {
  football: DAILY_BUDGET,
  racing: 1000,
};

export const MAX_FEED_CAP = 100_000;

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function parseFeedCaps(raw: string | null | undefined): FeedCaps {
  if (!raw) return DEFAULT_FEED_CAPS;
  try {
    const parsed = JSON.parse(raw) as Partial<FeedCaps>;
    return {
      football: clampCap(parsed.football, DEFAULT_FEED_CAPS.football),
      racing: clampCap(parsed.racing, DEFAULT_FEED_CAPS.racing),
    };
  } catch {
    return DEFAULT_FEED_CAPS;
  }
}

function clampCap(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_FEED_CAP, Math.max(1, Math.floor(value)));
}

export async function readFeedCaps(): Promise<FeedCaps> {
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    const rows = await getNeonDb()
      .select()
      .from(pgOperatorSettings)
      .where(eq(pgOperatorSettings.key, FEED_CAPS_KEY))
      .limit(1);
    return parseFeedCaps(rows[0]?.value);
  }
  const row = db
    .select()
    .from(operatorSettings)
    .where(eq(operatorSettings.key, FEED_CAPS_KEY))
    .get();
  return parseFeedCaps(row?.value);
}

export async function writeFeedCaps(caps: FeedCaps): Promise<FeedCaps> {
  const next: FeedCaps = {
    football: clampCap(caps.football, DEFAULT_FEED_CAPS.football),
    racing: clampCap(caps.racing, DEFAULT_FEED_CAPS.racing),
  };
  const value = JSON.stringify(next);
  const now = Date.now();
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    await getNeonDb()
      .insert(pgOperatorSettings)
      .values({ key: FEED_CAPS_KEY, value, updatedAt: now })
      .onConflictDoUpdate({
        target: pgOperatorSettings.key,
        set: { value, updatedAt: now },
      });
    return next;
  }
  db.insert(operatorSettings)
    .values({ key: FEED_CAPS_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: operatorSettings.key,
      set: { value, updatedAt: now },
    })
    .run();
  return next;
}
