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

  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (prevEnabled !== enabled) {
    setPrevEnabled(enabled);
    if (enabled) {
      setStatus("loading");
    } else {
      setStarted(false);
      setStatus("ready");
    }
  }

  useEffect(() => {
    if (!enabled) return;
    let live = true;
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

  const retry = useCallback(() => {
    if (!enabled) return;
    setStatus("loading");
    setTick((n) => n + 1);
  }, [enabled]);
  return { started, status, retry };
}
