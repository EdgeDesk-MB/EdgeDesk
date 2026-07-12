import { normalizeAccessStatus } from "@/lib/accounts/access";
import type { AccountRow } from "@/lib/db/schema";

/**
 * Bookie names the operator can still place with (active + available).
 * Empty set = no wallets configured → do not filter (show everything).
 */
export function availableBookieNames(
  accounts: Array<Pick<AccountRow, "name" | "type" | "isActive" | "accessStatus">>
): Set<string> {
  const names = new Set<string>();
  for (const a of accounts) {
    if (a.type !== "bookie" || !a.isActive) continue;
    if (normalizeAccessStatus(a.accessStatus) !== "available") continue;
    names.add(a.name.trim().toLowerCase());
  }
  return names;
}

/** True if offer has no bookie, or bookie is in the available set, or set is empty. */
export function offerMatchesAvailableBookies(
  bookmaker: string | null | undefined,
  available: Set<string>
): boolean {
  if (available.size === 0) return true;
  const name = bookmaker?.trim().toLowerCase();
  if (!name) return true; // untagged - keep visible
  return available.has(name);
}
