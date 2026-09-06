/**
 * Resolve a back-bet venue as a bookie or exchange wallet.
 * Add bet lets you pick Betdaq as the back; ledger used to force a bookie.
 */
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";

export type VenueKind = "bookie" | "exchange";

export type NamedVenueAccount = {
  name: string;
  type: string;
  isActive?: number | null;
};

/**
 * Kind to create when no wallet exists yet.
 * Sportsbook names stay bookies ("Betfair Sportsbook"). Plain exchange
 * brands ("Betdaq", "Betfair") stay exchanges.
 */
export function inferBackVenueKind(name: string): VenueKind {
  const trimmed = name.trim();
  if (!trimmed) return "bookie";
  if (/\bsportsbook\b/i.test(trimmed)) return "bookie";
  const key = trimmed.toLowerCase();
  if (EXCHANGE_PRESETS.some((p) => p.name.toLowerCase() === key)) return "exchange";
  if (/\bexchange\b/i.test(trimmed)) return "exchange";
  if (/\b(betdaq|smarkets|matchbook|betconnect)\b/i.test(trimmed)) return "exchange";
  return "bookie";
}

/** Active bookie or exchange with this name. If both exist, prefer inferred kind. */
export function findVenueBalanceAccount<T extends NamedVenueAccount>(
  accounts: T[] | undefined,
  name: string
): T | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  const matches = (accounts ?? []).filter(
    (a) =>
      (a.type === "bookie" || a.type === "exchange") &&
      a.name.toLowerCase() === q &&
      a.isActive !== 0
  );
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  const prefer = inferBackVenueKind(name);
  return matches.find((a) => a.type === prefer) ?? matches[0];
}

/** Kind for /api/accounts/ensure from Add bet top-up. */
export function backVenueKind(
  accounts: NamedVenueAccount[] | undefined,
  name: string
): VenueKind {
  const found = findVenueBalanceAccount(accounts, name);
  if (found?.type === "bookie" || found?.type === "exchange") return found.type;
  return inferBackVenueKind(name);
}

/** Placement debit on the back venue, not the lay-liability row. */
export function isBackPlacementDebit(tx: {
  category: string;
  amount: number;
  note?: string | null;
}): boolean {
  if (!(tx.amount < 0)) return false;
  if (String(tx.note ?? "").includes("Lay liability")) return false;
  return tx.category === "bet_stake" || tx.category === "free_bet";
}
