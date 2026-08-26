"use client";

import { useEffect, useState } from "react";
import {
  knownFromFootballFixtures,
  knownFromRacingFixtures,
  tomorrowCalendarDate,
  type KnownFixtureOption,
} from "@/lib/add-bet-event-options";
import { localCalendarDate } from "@/lib/events";
import { api } from "@/hooks/use-app-state";

type FixtureSport = "football" | "horse_racing";

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  at: number;
  fixtures: KnownFixtureOption[];
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<KnownFixtureOption[]>>();

function isFixtureSport(sport: string): sport is FixtureSport {
  return sport === "football" || sport === "horse_racing";
}

function cacheKey(sport: FixtureSport, today: string, tomorrow: string): string {
  return `${sport}:${today}:${tomorrow}`;
}

function readWarmCache(sport: FixtureSport): KnownFixtureOption[] | null {
  const key = cacheKey(sport, localCalendarDate(), tomorrowCalendarDate());
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at >= CACHE_TTL_MS) return null;
  return hit.fixtures;
}

async function loadKnownFixtures(sport: FixtureSport): Promise<KnownFixtureOption[]> {
  const today = localCalendarDate();
  const tomorrow = tomorrowCalendarDate();
  const key = cacheKey(sport, today, tomorrow);

  const warm = cache.get(key);
  if (warm && Date.now() - warm.at < CACHE_TTL_MS) return warm.fixtures;

  const existing = inflight.get(key);
  if (existing) return existing;

  const pending = (async () => {
    if (sport === "football") {
      const [a, b] = await Promise.all([
        api<{
          fixtures: Array<{
            externalId: string;
            competition: string;
            homeTeam: string;
            awayTeam: string;
            startTime: number;
            status: "upcoming" | "live" | "finished";
          }>;
        }>(`/api/fixtures?date=${today}`),
        api<{
          fixtures: Array<{
            externalId: string;
            competition: string;
            homeTeam: string;
            awayTeam: string;
            startTime: number;
            status: "upcoming" | "live" | "finished";
          }>;
        }>(`/api/fixtures?date=${tomorrow}`),
      ]);
      const byId = new Map<string, (typeof a.fixtures)[number]>();
      for (const f of [...(a.fixtures ?? []), ...(b.fixtures ?? [])]) {
        if (f.externalId) byId.set(f.externalId, f);
      }
      return knownFromFootballFixtures([...byId.values()]);
    }

    const batches = await Promise.all(
      [today, tomorrow].map((d) =>
        api<{
          racecards: Array<{
            externalId: string;
            competition: string;
            raceName: string;
            course: string;
            startTime: number;
            status: "upcoming" | "live" | "finished";
            offTime: string;
            runners?: string[];
          }>;
        }>(`/api/racing/racecards?date=${d}`)
      )
    );
    const byId = new Map<string, (typeof batches)[number]["racecards"][number]>();
    for (const batch of batches) {
      for (const r of batch.racecards ?? []) {
        if (r.externalId) byId.set(r.externalId, r);
      }
    }
    return knownFromRacingFixtures([...byId.values()]);
  })()
    .then((fixtures) => {
      cache.set(key, { at: Date.now(), fixtures });
      return fixtures;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, pending);
  return pending;
}

/**
 * Today + tomorrow fixtures for Add-bet-style Event pickers.
 * Shared in-memory cache so Acca / Systems / Bet builder legs do not each
 * refetch the same racecards when the dialog opens.
 */
export function useKnownFixtures(sport: string): {
  fixtures: KnownFixtureOption[];
  loading: boolean;
} {
  const supported = isFixtureSport(sport);
  const [fixtures, setFixtures] = useState<KnownFixtureOption[]>(() => {
    if (!supported) return [];
    return readWarmCache(sport) ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (!supported) return false;
    return readWarmCache(sport) == null;
  });
  const [prevSport, setPrevSport] = useState(sport);

  if (prevSport !== sport) {
    setPrevSport(sport);
    if (!supported) {
      setFixtures([]);
      setLoading(false);
    } else {
      const warm = readWarmCache(sport);
      // Drop the previous sport's list immediately so Horse racing never
      // briefly shows football fixtures (or vice versa).
      setFixtures(warm ?? []);
      setLoading(warm == null);
    }
  }

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;

    void loadKnownFixtures(sport)
      .then((next) => {
        if (!cancelled) {
          setFixtures(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFixtures([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sport, supported]);

  return { fixtures, loading };
}
