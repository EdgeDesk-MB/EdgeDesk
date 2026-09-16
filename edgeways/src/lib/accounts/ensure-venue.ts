/**
 * Ensure a bookie or exchange wallet exists when the user free-types a name.
 */
import { eq } from "drizzle-orm";
import { db, accounts, exchanges, type AccountRow, type ExchangeRow } from "@/lib/db";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";
import {
  findVenueBalanceAccount,
  inferBackVenueKind,
  type VenueKind,
} from "@/lib/accounts/resolve-venue";

export type { VenueKind };

export interface EnsureVenueResult {
  account: AccountRow;
  exchange: ExchangeRow | null;
  created: boolean;
}

function findActiveAccount(name: string, type: VenueKind): AccountRow | undefined {
  const q = name.trim().toLowerCase();
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, 1))
    .all()
    .find((a) => a.type === type && a.name.toLowerCase() === q);
}

function findAnyAccount(name: string, type: VenueKind): AccountRow | undefined {
  const q = name.trim().toLowerCase();
  return db
    .select()
    .from(accounts)
    .all()
    .find((a) => a.type === type && a.name.toLowerCase() === q);
}

function findExchangeByName(name: string): ExchangeRow | undefined {
  const q = name.trim().toLowerCase();
  return db
    .select()
    .from(exchanges)
    .all()
    .find((e) => e.name.toLowerCase() === q);
}

function ensureExchangeRow(name: string): ExchangeRow {
  const existing = findExchangeByName(name);
  if (existing) return existing;

  const preset = EXCHANGE_PRESETS.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  return db
    .insert(exchanges)
    .values({
      name: name.trim(),
      commissionPct: preset?.commissionPct ?? 2,
      brandColor: preset?.brandColor ?? "#3f3f46",
      backColor: preset?.backColor ?? "#A7D8FF",
      layColor: preset?.layColor ?? "#FBC9D2",
      isDefault: 0,
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

/**
 * Create (or reactivate) a wallet for a free-typed bookie/exchange name.
 * Idempotent - returns the existing active account when present.
 */
export function ensureVenueAccount(name: string, kind: VenueKind): EnsureVenueResult {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const active = findActiveAccount(trimmed, kind);
  if (active) {
    const exchange =
      kind === "exchange" && active.exchangeId
        ? db.select().from(exchanges).where(eq(exchanges.id, active.exchangeId)).get() ?? null
        : kind === "exchange"
          ? findExchangeByName(trimmed) ?? null
          : null;
    return { account: active, exchange, created: false };
  }

  const inactive = findAnyAccount(trimmed, kind);
  if (inactive) {
    const exchange = kind === "exchange" ? ensureExchangeRow(trimmed) : null;
    const account = db
      .update(accounts)
      .set({
        isActive: 1,
        exchangeId: exchange?.id ?? inactive.exchangeId,
        brandColor:
          kind === "bookie"
            ? inactive.brandColor ?? bookieBrandColor(trimmed)
            : inactive.brandColor,
      })
      .where(eq(accounts.id, inactive.id))
      .returning()
      .get();
    return { account, exchange, created: true };
  }

  if (kind === "exchange") {
    const exchange = ensureExchangeRow(trimmed);
    const account = db
      .insert(accounts)
      .values({
        name: trimmed,
        type: "exchange",
        exchangeId: exchange.id,
        brandColor: exchange.brandColor,
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    return { account, exchange, created: true };
  }

  const account = db
    .insert(accounts)
    .values({
      name: trimmed,
      type: "bookie",
      brandColor: bookieBrandColor(trimmed),
      isActive: 1,
      createdAt: Date.now(),
    })
    .returning()
    .get();
  return { account, exchange: null, created: true };
}

/**
 * Back-bet wallet: existing bookie or exchange by name, else create
 * with inferred kind (Betdaq → exchange, Bet365 → bookie).
 */
export function ensureBackVenueAccount(name: string): EnsureVenueResult {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const existing = findVenueBalanceAccount(
    db.select().from(accounts).all(),
    trimmed
  );
  if (existing) {
    const exchange =
      existing.type === "exchange"
        ? existing.exchangeId
          ? db.select().from(exchanges).where(eq(exchanges.id, existing.exchangeId)).get() ??
            findExchangeByName(trimmed) ??
            null
          : findExchangeByName(trimmed) ?? null
        : null;
    return { account: existing, exchange, created: false };
  }

  return ensureVenueAccount(trimmed, inferBackVenueKind(trimmed));
}
