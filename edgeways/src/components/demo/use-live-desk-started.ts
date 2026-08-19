"use client";

import { useCallback, useEffect, useState } from "react";

export type LiveDeskStatus = "loading" | "ready" | "error";

export function useLiveDeskStarted(enabled: boolean): {
  started: boolean;
  status: LiveDeskStatus;
  retry: () => void;
} {
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<LiveDeskStatus>(enabled ? "loading" : "ready");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStarted(false);
      setStatus("ready");
      return;
    }
    let live = true;
    setStatus("loading");
    fetch("/api/demo/live-status", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Could not read the live desk.");
        return res.json() as Promise<{ started?: boolean }>;
      })
      .then((data) => {
        if (!live) return;
        setStarted(data.started === true);
        setStatus("ready");
      })
      .catch(() => {
        if (!live) return;
        setStarted(false);
        setStatus("error");
      });
    return () => {
      live = false;
    };
  }, [enabled, tick]);

  const retry = useCallback(() => setTick((n) => n + 1), []);
  return { started, status, retry };
}
