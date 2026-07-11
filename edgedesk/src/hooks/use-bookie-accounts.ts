"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/hooks/use-app-state";
import {
  compareByAccessThenName,
  normalizeAccessStatus,
  type BookieAccessStatus,
} from "@/lib/accounts/access";
import type { AccountBalance } from "@/lib/services/balances.types";

export interface BookieAccountOption {
  name: string;
  accessStatus: BookieAccessStatus;
  brandColor: string | null;
  balance: number;
  isWallet: boolean;
}

/**
 * Active bookie wallets from Balances/Settings, sorted available-first.
 * Falls back to empty when API fails - callers still use the static bookie list.
 */
export function useBookieAccounts(pollMs = 0) {
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ bookies: AccountBalance[] }>("/api/bookies");
      setAccounts(res.bookies.filter((b) => b.isActive));
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

  const options: BookieAccountOption[] = useMemo(
    () =>
      [...accounts]
        .sort(compareByAccessThenName)
        .map((a) => ({
          name: a.name,
          accessStatus: normalizeAccessStatus(a.accessStatus),
          brandColor: a.brandColor,
          balance: a.balance,
          isWallet: true,
        })),
    [accounts]
  );

  const availableNames = useMemo(
    () =>
      new Set(
        options.filter((o) => o.accessStatus === "available").map((o) => o.name.toLowerCase())
      ),
    [options]
  );

  const statusByName = useMemo(() => {
    const map = new Map<string, BookieAccessStatus>();
    for (const o of options) map.set(o.name.toLowerCase(), o.accessStatus);
    return map;
  }, [options]);

  return { accounts, options, availableNames, statusByName, loaded, refresh };
}
