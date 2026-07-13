"use client";

/**
 * Alert watcher (C4): evaluates the pure alert rules against every state
 * poll and delivers new alerts through the local channel. Dedupe keys are
 * kept in sessionStorage so a reload doesn't replay the day's alerts.
 */

import { useEffect, useMemo, useRef } from "react";
import { createLocalAlertChannel } from "@/lib/alerts/local-channel";
import { evaluateAlertRules, type SettledBetNotice } from "@/lib/alerts/rules";
import { useDoNextItems } from "@/hooks/use-do-next-items";

const SEEN_KEY = "edgedesk-alerts-seen";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function storeSeen(seen: Set<string>): void {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500)));
  } catch {
    /* private mode */
  }
}

export function AlertWatcher() {
  const { items: doNext, state } = useDoNextItems();
  const channel = useMemo(() => createLocalAlertChannel(), []);
  const seenRef = useRef<Set<string> | null>(null);
  const settledIdsRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!state) return;
    if (seenRef.current == null) seenRef.current = readSeen();

    // Newly settled bets: transitions since the previous poll. The first poll
    // seeds silently so a page load doesn't announce history.
    const settledNow = (state.bets ?? []).filter(
      (b) => b.status !== "open" && b.settledAt != null
    );
    const previous = settledIdsRef.current;
    settledIdsRef.current = new Set(settledNow.map((b) => b.id));
    const settledSinceLastPoll: SettledBetNotice[] =
      previous == null
        ? []
        : settledNow
            .filter((b) => !previous.has(b.id) && b.status !== "void")
            .map((b) => ({
              betId: b.id,
              label: b.label,
              profit: b.actualProfit ?? 0,
            }));

    const alerts = evaluateAlertRules({
      now: Date.now(),
      prefs: {
        offerExpiring: state.settings.alertsOfferExpiring,
        raceOffSoon: state.settings.alertsRaceOffSoon,
        resultSettled: state.settings.alertsResultSettled,
      },
      doNext,
      races: (state.planRaces ?? []).map((r) => ({
        ...r,
        hasOpenBet: r.hasOpenBet ?? false,
      })),
      settledSinceLastPoll,
    });

    const seen = seenRef.current;
    let dirty = false;
    for (const alert of alerts) {
      if (seen.has(alert.key)) continue;
      seen.add(alert.key);
      dirty = true;
      channel.notify(alert);
    }
    if (dirty) storeSeen(seen);
  }, [state, doNext, channel]);

  return null;
}
