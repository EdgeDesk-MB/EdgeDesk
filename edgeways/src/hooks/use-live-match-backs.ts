"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/hooks/use-app-state";
import type { EventRow } from "@/lib/db/schema";
import { effectiveEventStatus } from "@/lib/events";
import {
  mergeLiveMatchBackPoll,
  nextLiveMatchBackQuoteSeq,
  type LiveMatchBackOdds,
  type LiveMatchBackPollKind,
  type LiveMatchBacksEntry,
} from "@/lib/events/live-match-backs";
import type { FootballOddsResult } from "@/lib/services/exchange/football-odds-map";

const POLL_MS = 20_000;

function footballLiveKey(events: EventRow[]): string {
  return events
    .filter((event) => event.sport === "football" && effectiveEventStatus(event) === "live")
    .map((event) => `${event.id}:${event.homeTeam}:${event.awayTeam}:${event.startTime}`)
    .join("|");
}

function pollFromResult(result: FootballOddsResult): {
  kind: LiveMatchBackPollKind;
  odds: LiveMatchBackOdds;
} {
  const odds: LiveMatchBackOdds = {
    homeBack: result.odds.homeBack,
    drawBack: result.odds.drawBack,
    awayBack: result.odds.awayBack,
  };
  if (result.status === "live") return { kind: "live", odds };
  if (result.status === "suspended") return { kind: "suspended", odds };
  if (result.status === "closed") return { kind: "closed", odds: {} };
  if (result.status === "error" || result.status === "not_configured") {
    return { kind: "hold", odds: {} };
  }
  return { kind: "empty", odds: {} };
}

/** Poll Betfair match-odds backs for live football Events. Failures stay empty. */
export function useLiveMatchBacks(events: EventRow[]): {
  byId: Map<number, LiveMatchBacksEntry>;
  loaded: boolean;
} {
  const key = useMemo(() => footballLiveKey(events), [events]);
  const [byId, setById] = useState<Map<number, LiveMatchBacksEntry>>(() => new Map());
  const [loaded, setLoaded] = useState(false);
  const previousRef = useRef(byId);
  const [prevKey, setPrevKey] = useState(key);

  if (prevKey !== key) {
    setPrevKey(key);
    if (key === "") setById(new Map());
    setLoaded(false);
  }

  useEffect(() => {
    const live = events.filter(
      (event) => event.sport === "football" && effectiveEventStatus(event) === "live"
    );
    if (live.length === 0) {
      previousRef.current = new Map();
      return;
    }

    let cancelled = false;

    const load = async () => {
      const entries = await Promise.all(
        live.map(async (event) => {
          const q = new URLSearchParams({
            home: event.homeTeam,
            away: event.awayTeam,
            matchOddsOnly: "1",
          });
          if (event.startTime) q.set("start", String(event.startTime));
          try {
            const result = await api<FootballOddsResult>(
              `/api/exchange/football-odds?${q.toString()}`
            );
            return [event.id, pollFromResult(result)] as const;
          } catch {
            return [event.id, { kind: "hold" as const, odds: {} }] as const;
          }
        })
      );
      if (cancelled) return;
      const next = new Map<number, LiveMatchBacksEntry>();
      for (const [id, poll] of entries) {
        const previous = previousRef.current.get(id);
        const merged = mergeLiveMatchBackPoll(previous, poll);
        if (merged) {
          next.set(id, {
            ...merged,
            quoteSeq: nextLiveMatchBackQuoteSeq(previous?.quoteSeq, poll),
          });
        }
      }
      previousRef.current = next;
      setById(next);
      setLoaded(true);
    };

    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // key captures the live football identity; events is read inside from the latest render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll when the live set changes
  }, [key]);

  return { byId, loaded: key === "" ? true : loaded };
}
