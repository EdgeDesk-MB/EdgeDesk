import "server-only";
import { eq } from "drizzle-orm";
import {
  parseExcludedAccountIds,
  serializeExcludedAccountIds,
  uniqueClerkUserIds,
} from "@/lib/admin/exclude-accounts";
import { readExcludeAdmins } from "@/lib/admin/exclude-admins-server";
import { db, operatorSettings } from "@/lib/db";
import { getNeonDb } from "@/lib/db/neon";
import { operatorSettings as pgOperatorSettings } from "@/lib/db/schema.pg";
import { ensureNeonOperatorSettingsTable } from "@/lib/services/app-users";

const EXCLUDED_ACCOUNTS_KEY = "excluded_accounts";

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function readExcludedAccountIds(): Promise<string[]> {
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    const rows = await getNeonDb()
      .select()
      .from(pgOperatorSettings)
      .where(eq(pgOperatorSettings.key, EXCLUDED_ACCOUNTS_KEY))
      .limit(1);
    return parseExcludedAccountIds(rows[0]?.value);
  }
  const row = db
    .select()
    .from(operatorSettings)
    .where(eq(operatorSettings.key, EXCLUDED_ACCOUNTS_KEY))
    .get();
  return parseExcludedAccountIds(row?.value);
}

export async function writeExcludedAccountIds(
  ids: Iterable<string>
): Promise<string[]> {
  const next = uniqueClerkUserIds([...ids]);
  const value = serializeExcludedAccountIds(next);
  const now = Date.now();
  if (usesHostedPostgres()) {
    await ensureNeonOperatorSettingsTable();
    await getNeonDb()
      .insert(pgOperatorSettings)
      .values({ key: EXCLUDED_ACCOUNTS_KEY, value, updatedAt: now })
      .onConflictDoUpdate({
        target: pgOperatorSettings.key,
        set: { value, updatedAt: now },
      });
    return next;
  }
  db.insert(operatorSettings)
    .values({ key: EXCLUDED_ACCOUNTS_KEY, value, updatedAt: now })
    .onConflictDoUpdate({
      target: operatorSettings.key,
      set: { value, updatedAt: now },
    })
    .run();
  return next;
}

export async function loadAdminAccountScope(): Promise<{
  excludeAdmins: boolean;
  excludedIds: string[];
}> {
  const [excludeAdmins, excludedIds] = await Promise.all([
    readExcludeAdmins(),
    readExcludedAccountIds(),
  ]);
  return { excludeAdmins, excludedIds };
}
