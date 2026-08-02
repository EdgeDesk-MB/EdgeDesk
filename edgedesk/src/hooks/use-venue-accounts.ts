"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiGet } from "@/hooks/use-app-state";
import {
  compareByAccessThenName,
  normalizeAccessStatus,
  type BookieAccessStatus,
} from "@/lib/accounts/access";
import type { AccountBalance } from "@/lib/services/balances.types";
import type { ExchangeRow } from "@/lib/db/schema";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";

export interface VenueOption {
  name: string;
  kind: "bookie" | "exchange";
  accessStatus: BookieAccessStatus;
  brandColor: string | null;
  /** Already a wallet in Balances */
  isWallet: boolean;
}

/**
 * Active bookie + exchange wallets, plus exchange directory names.
 * Used by Bookie/Exchange pickers (Offers, 2UP, Add bet).
 */
export function useVenueAccounts(pollMs = 0) {
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [bal, ex] = await Promise.all([
        apiGet<{ accounts: AccountBalance[] }>("/api/accounts"),
        apiGet<{ exchanges: ExchangeRow[] }>("/api/exchanges"),
      ]);
      setAccounts(bal.accounts.filter((a) => a.isActive));
      setExchanges(ex.exchanges);
    } catch {
      /* keep last good list */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!pollMs || pollMs < 1000) return;
    const id = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  const bookieWallets: VenueOption[] = useMemo(
    () =>
      accounts
        .filter((a) => a.type === "bookie")
        .sort(compareByAccessThenName)
        .map((a) => ({
          name: a.name,
          kind: "bookie" as const,
          accessStatus: normalizeAccessStatus(a.accessStatus),
          brandColor: a.brandColor,
          isWallet: true,
        })),
    [accounts]
  );

  const exchangeWallets: VenueOption[] = useMemo(
    () =>
      accounts
        .filter((a) => a.type === "exchange")
        .sort(compareByAccessThenName)
        .map((a) => ({
          name: a.name,
          kind: "exchange" as const,
          accessStatus: normalizeAccessStatus(a.accessStatus),
          brandColor: a.brandColor,
          isWallet: true,
        })),
    [accounts]
  );

  /** Exchange names from wallets + exchanges table + presets (deduped). */
  const exchangeDirectory: VenueOption[] = useMemo(() => {
    const walletNames = new Set(exchangeWallets.map((e) => e.name.toLowerCase()));
    const fromTable = exchanges
      .filter((e) => !walletNames.has(e.name.toLowerCase()))
      .map(
        (e): VenueOption => ({
          name: e.name,
          kind: "exchange",
          accessStatus: "available",
          brandColor: e.brandColor,
          isWallet: false,
        })
      );
    const known = new Set([
      ...walletNames,
      ...fromTable.map((e) => e.name.toLowerCase()),
    ]);
    const fromPresets = EXCHANGE_PRESETS.filter(
      (p) => !known.has(p.name.toLowerCase())
    ).map(
      (p): VenueOption => ({
        name: p.name,
        kind: "exchange",
        accessStatus: "available",
        brandColor: p.brandColor,
        isWallet: false,
      })
    );
    return [...fromTable, ...fromPresets].sort((a, b) => a.name.localeCompare(b.name));
  }, [exchanges, exchangeWallets]);

  const statusByName = useMemo(() => {
    const map = new Map<string, BookieAccessStatus>();
    for (const o of [...bookieWallets, ...exchangeWallets]) {
      map.set(o.name.toLowerCase(), o.accessStatus);
    }
    return map;
  }, [bookieWallets, exchangeWallets]);

  const availableNames = useMemo(
    () =>
      new Set(
        [...bookieWallets, ...exchangeWallets]
          .filter((o) => o.accessStatus === "available")
          .map((o) => o.name.toLowerCase())
      ),
    [bookieWallets, exchangeWallets]
  );

  /** Persist a free-typed name as a bookie or exchange wallet. */
  const ensureVenue = useCallback(
    async (name: string, kind: "bookie" | "exchange") => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const res = await api<{
        account: AccountBalance;
        created: boolean;
      }>("/api/accounts/ensure", {
        method: "POST",
        json: { name: trimmed, kind },
      });
      await refresh();
      return res;
    },
    [refresh]
  );

  return {
    accounts,
    exchanges,
    bookieWallets,
    exchangeWallets,
    exchangeDirectory,
    statusByName,
    availableNames,
    loaded,
    refresh,
    ensureVenue,
  };
}
