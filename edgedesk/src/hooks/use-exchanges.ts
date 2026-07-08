"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExchangeRow } from "@/lib/db/schema";
import { api } from "./use-app-state";

/** Loads the user's exchange list (Betfair, Betdaq at their rates, etc.). */
export function useExchanges() {
  const [exchanges, setExchanges] = useState<ExchangeRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ exchanges: ExchangeRow[] }>("/api/exchanges");
      setExchanges(res.exchanges);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(refresh);
  }, [refresh]);

  const defaultExchange = exchanges.find((e) => e.isDefault) ?? exchanges[0] ?? null;

  return { exchanges, defaultExchange, loaded, refresh };
}
