/**
 * Hosted-desk counterpart of ensureVenueAccount. /api/accounts/ensure used
 * to write SQLite even when EDGEWAYS_DESK_BACKEND=neon, so Add bet's auto
 * top-up posted a Mac-file wallet id (usually 1) that Neon then rejected.
 */
import "server-only";

import { bookieBrandColor } from "@/lib/brands/bookies";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";
import type { EnsureVenueResult, VenueKind } from "@/lib/accounts/ensure-venue";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import {
  insertNeonDeskAccount,
  insertNeonExchange,
  listNeonDeskAccounts,
  listNeonExchanges,
  patchNeonDeskAccount,
} from "@/lib/db/neon-desk-accounts";
import type { ExchangeRow } from "@/lib/db/schema";

async function ensureNeonExchangeRow(name: string): Promise<ExchangeRow> {
  const trimmed = name.trim();
  const q = trimmed.toLowerCase();
  const existing = (await listNeonExchanges()).find(
    (e) => e.name.toLowerCase() === q
  );
  if (existing) return existing;

  const preset = EXCHANGE_PRESETS.find((p) => p.name.toLowerCase() === q);
  return insertNeonExchange({
    name: trimmed,
    commissionPct: preset?.commissionPct ?? 2,
    brandColor: preset?.brandColor ?? "#3f3f46",
    backColor: preset?.backColor ?? "#a6d8ff",
    layColor: preset?.layColor ?? "#fac9d1",
    isDefault: false,
  });
}

/**
 * Create (or reactivate) a hosted wallet for a free-typed bookie/exchange name.
 * Idempotent, Clerk-scoped, same result shape as the SQLite helper.
 */
export async function ensureNeonVenueAccount(
  name: string,
  kind: VenueKind,
  clerkUserId = neonDeskClerkUserId()
): Promise<EnsureVenueResult> {
  if (!clerkUserId) throw new Error("Sign in to save an account.");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  const q = trimmed.toLowerCase();
  const accounts = await listNeonDeskAccounts(clerkUserId);

  const active = accounts.find(
    (a) => a.type === kind && a.isActive === 1 && a.name.toLowerCase() === q
  );
  if (active) {
    const exchange =
      kind === "exchange"
        ? active.exchangeId != null
          ? ((await listNeonExchanges()).find((e) => e.id === active.exchangeId) ??
            (await ensureNeonExchangeRow(trimmed)))
          : await ensureNeonExchangeRow(trimmed)
        : null;
    return { account: active, exchange, created: false };
  }

  const inactive = accounts.find(
    (a) => a.type === kind && a.name.toLowerCase() === q
  );
  if (inactive) {
    const exchange = kind === "exchange" ? await ensureNeonExchangeRow(trimmed) : null;
    const account = await patchNeonDeskAccount(
      inactive.id,
      {
        isActive: 1,
        brandColor:
          kind === "bookie"
            ? inactive.brandColor ?? bookieBrandColor(trimmed)
            : inactive.brandColor ?? exchange?.brandColor ?? undefined,
        ...(kind === "exchange" && exchange ? { exchangeId: exchange.id } : {}),
      },
      clerkUserId
    );
    if (!account) throw new Error("Could not reactivate the account.");
    return { account, exchange, created: true };
  }

  if (kind === "exchange") {
    const exchange = await ensureNeonExchangeRow(trimmed);
    const account = await insertNeonDeskAccount(
      {
        name: trimmed,
        type: "exchange",
        exchangeId: exchange.id,
        brandColor: exchange.brandColor,
        isActive: 1,
        createdAt: Date.now(),
      },
      clerkUserId
    );
    return { account, exchange, created: true };
  }

  const account = await insertNeonDeskAccount(
    {
      name: trimmed,
      type: "bookie",
      brandColor: bookieBrandColor(trimmed),
      isActive: 1,
      createdAt: Date.now(),
    },
    clerkUserId
  );
  return { account, exchange: null, created: true };
}
