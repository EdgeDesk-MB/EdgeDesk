/**
 * Hosted desk settings on Neon (EDGE-47). JSON blob on app_users.
 * Never opens SQLite. Vercel cannot mkdir the Mac `data/` folder.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { ensureAppUser, ensureNeonDeskSettingsColumn } from "@/lib/services/app-users";
import type { AppSettings } from "@/lib/services/settings-shared";
import {
  mergeAppSettings,
  parseStoredSettings,
  type AppSettingsPatch,
} from "@/lib/services/settings-merge";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { getNeonDb } from "@/lib/db/neon";
import { appUsers as pgUsers } from "@/lib/db/schema.pg";

export async function getNeonDeskSettings(): Promise<AppSettings> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return parseStoredSettings(null);
  return getNeonDeskSettingsForUser(clerkUserId);
}

/**
 * Explicit-owner settings read for system processes (EDGE-110): the leased
 * feed poller has no desk actor but needs each owner's alert prefs.
 */
export async function getNeonDeskSettingsForUser(
  clerkUserId: string
): Promise<AppSettings> {
  await ensureNeonDeskSettingsColumn();
  const rows = await getNeonDb()
    .select({ deskSettings: pgUsers.deskSettings })
    .from(pgUsers)
    .where(eq(pgUsers.clerkUserId, clerkUserId))
    .limit(1);
  return parseStoredSettings(rows[0]?.deskSettings ?? null);
}

export async function patchNeonDeskSettings(
  patch: AppSettingsPatch
): Promise<AppSettings> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) {
    throw new Error("Sign in to save settings.");
  }

  await ensureAppUser({ clerkUserId });
  await ensureNeonDeskSettingsColumn();
  const current = await getNeonDeskSettings();
  const next = mergeAppSettings(current, patch);
  const now = Date.now();

  await getNeonDb()
    .update(pgUsers)
    .set({
      deskSettings: JSON.stringify(next),
      updatedAt: now,
    })
    .where(eq(pgUsers.clerkUserId, clerkUserId));

  return next;
}
