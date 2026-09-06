"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/hooks/use-app-state";
import { localCalendarDate } from "@/lib/events";

export type EventCrest = {
  homeLogo?: string | null;
  awayLogo?: string | null;
};

const DATE_CAP = 8;

function crestKey(
  events: Array<{ externalId?: string | null; startTime?: number | null }>
): string {
  return events
    .filter((event) => event.externalId && event.startTime != null)
    .map((event) => `${event.externalId}:${localCalendarDate(new Date(event.startTime!))}`)
    .sort()
    .join("|");
}

/**
 * Club crests from the fixture store, keyed by `externalId`.
 * Reads `/api/fixtures?date=` (store-first). Caps unique dates so History
 * cannot stampede the day list.
 */
export function useEventCrestMap(
  events: Array<{ externalId?: string | null; startTime?: number | null }>
): { map: Map<string, EventCrest>; ready: boolean } {
  const key = useMemo(() => crestKey(events), [events]);
  const [map, setMap] = useState<Map<string, EventCrest>>(() => new Map());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  /** Same render as the cards: a new key is not ready until that fetch lands. */
  const ready = !key || loadedKey === key;

  useEffect(() => {
    if (!key) {
      setMap(new Map());
      setLoadedKey(null);
      return;
    }
    const dates = new Set<string>();
    const ids = new Set<string>();
    for (const part of key.split("|")) {
      const sep = part.lastIndexOf(":");
      const id = part.slice(0, sep);
      const date = part.slice(sep + 1);
      if (id && date) {
        ids.add(id);
        dates.add(date);
      }
    }
    const dateList = [...dates].sort().slice(-DATE_CAP);
    let cancelled = false;
    void Promise.all(
      dateList.map((date) =>
        apiGet<{
          fixtures?: Array<{
            externalId: string;
            homeLogo?: string | null;
            awayLogo?: string | null;
          }>;
        }>(`/api/fixtures?date=${date}`)
      )
    ).then(
      (batches) => {
        if (cancelled) return;
        const next = new Map<string, EventCrest>();
        for (const batch of batches) {
          for (const fixture of batch.fixtures ?? []) {
            if (!ids.has(fixture.externalId)) continue;
            if (!fixture.homeLogo && !fixture.awayLogo) continue;
            next.set(fixture.externalId, {
              homeLogo: fixture.homeLogo,
              awayLogo: fixture.awayLogo,
            });
          }
        }
        setMap(next);
        setLoadedKey(key);
      },
      () => {
        if (!cancelled) {
          setMap(new Map());
          setLoadedKey(key);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { map, ready };
}

export function useEventCrests(
  event: { externalId?: string | null; startTime?: number | null } | null,
  enabled = true
): EventCrest {
  const events = enabled && event ? [event] : [];
  const { map } = useEventCrestMap(events);
  const id = event?.externalId;
  if (!id) return {};
  return map.get(id) ?? {};
}
