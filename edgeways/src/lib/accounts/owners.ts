/**
 * Household account sets (J8) - a partner's separately-OPERATED accounts as
 * a tagged second set. Compliance framing (standing): Edgeways tracks
 * accounts operated by their owner; it never encourages operating someone
 * else's accounts.
 *
 * Attribution model (Sam, 2026-07-16): an account belongs to exactly one
 * owner; bets/offers inherit the owner through the bookmaker NAME →
 * account mapping at analytics time. Owners are an open list - any name
 * assigned to an account is an owner. When two owners hold identically-
 * named wallets the name is AMBIGUOUS: attribution falls back to 'me' and
 * the clash is surfaced so the wallets get distinct names.
 */

import { roundPence } from "@/lib/calc/money";

export const DEFAULT_OWNER = "me";

export interface OwnedAccountLike {
  name: string;
  type: string;
  owner?: string | null;
}

const norm = (name: string) => name.trim().toLowerCase();

export function accountOwner(account: Pick<OwnedAccountLike, "owner">): string {
  return account.owner?.trim() || DEFAULT_OWNER;
}

/** Distinct owners across accounts - 'me' always first, rest alphabetical. */
export function listOwners(accounts: OwnedAccountLike[]): string[] {
  const set = new Set<string>([DEFAULT_OWNER]);
  for (const a of accounts) set.add(accountOwner(a));
  return [DEFAULT_OWNER, ...[...set].filter((o) => o !== DEFAULT_OWNER).sort()];
}

export interface OwnerMapResult {
  /** normalised bookie name → owner ('me' when ambiguous) */
  ownerByName: Map<string, string>;
  /** Bookie names held by more than one owner - need distinct wallet names */
  clashes: string[];
}

export function ownerByBookmakerName(accounts: OwnedAccountLike[]): OwnerMapResult {
  const ownersPerName = new Map<string, Set<string>>();
  const displayName = new Map<string, string>();
  for (const a of accounts) {
    if (a.type !== "bookie") continue;
    const key = norm(a.name);
    displayName.set(key, a.name.trim());
    const set = ownersPerName.get(key) ?? new Set<string>();
    set.add(accountOwner(a));
    ownersPerName.set(key, set);
  }
  const ownerByName = new Map<string, string>();
  const clashes: string[] = [];
  for (const [key, owners] of ownersPerName) {
    if (owners.size === 1) {
      ownerByName.set(key, [...owners][0]);
    } else {
      ownerByName.set(key, DEFAULT_OWNER);
      clashes.push(displayName.get(key) ?? key);
    }
  }
  return { ownerByName, clashes: clashes.sort() };
}

export interface OwnerSplitBet {
  bookmaker: string | null;
  actualProfit: number | null;
  status: string;
  settledAt: number | null;
}

export interface OwnerPnlRow {
  owner: string;
  settledProfit: number;
  settledBets: number;
}

/**
 * Per-owner settled P&L. Bets at unknown bookies (no matching account)
 * attribute to 'me' so the split ALWAYS reconciles to the combined total.
 */
export function splitPnlByOwner(
  bets: OwnerSplitBet[],
  accounts: OwnedAccountLike[]
): OwnerPnlRow[] {
  const { ownerByName } = ownerByBookmakerName(accounts);
  const rows = new Map<string, { profit: number; count: number }>();
  for (const b of bets) {
    if (b.actualProfit == null || b.settledAt == null || b.status === "open") continue;
    const owner = b.bookmaker ? ownerByName.get(norm(b.bookmaker)) ?? DEFAULT_OWNER : DEFAULT_OWNER;
    const row = rows.get(owner) ?? { profit: 0, count: 0 };
    row.profit += b.actualProfit;
    row.count += 1;
    rows.set(owner, row);
  }
  return [...rows.entries()]
    .map(([owner, r]) => ({ owner, settledProfit: roundPence(r.profit), settledBets: r.count }))
    .sort((a, b) => (a.owner === DEFAULT_OWNER ? -1 : b.owner === DEFAULT_OWNER ? 1 : b.settledProfit - a.settledProfit));
}

/** Bookie names belonging to `owner` (for filtering bets/offers by name). */
export function bookieNamesForOwner(accounts: OwnedAccountLike[], owner: string): Set<string> {
  const { ownerByName } = ownerByBookmakerName(accounts);
  const out = new Set<string>();
  for (const [name, o] of ownerByName) if (o === owner) out.add(name);
  return out;
}
