"use client";

/**
 * Alert watcher (C4): evaluates the pure alert rules against every state
 * poll and delivers new alerts through the local channel. Dedupe keys are
 * kept in sessionStorage so a reload doesn't replay the day's alerts.
 */

import { useEffect, useMemo, useRef } from "react";
import { createLocalAlertChannel } from "@/lib/alerts/local-channel";
import {
  evaluateAlertRules,
  type SettledBetNotice,
  type TwoUpLockNotice,
} from "@/lib/alerts/rules";
import {
  readSeenAlertKeys,
  storeSeenAlertKeys,
} from "@/lib/alerts/seen";
import { detectNakedExposure } from "@/lib/bets/naked-exposure";
import { suggestTwoUpLock } from "@/lib/calc/two-up-lock";
import { useDoNextItems } from "@/hooks/use-do-next-items";

export function AlertWatcher() {
  const { items: doNext, state } = useDoNextItems();
  const channel = useMemo(() => createLocalAlertChannel(), []);
  const seenRef = useRef<Set<string> | null>(null);
  /** Settled bet id → status; detects new settles and later void/push revisions. */
  const settledStatusRef = useRef<Map<number, string> | null>(null);

  useEffect(() => {
    if (!state) return;
    if (seenRef.current == null) seenRef.current = readSeenAlertKeys();

    // Newly settled bets: transitions since the previous poll. The first poll
    // seeds silently so a page load doesn't announce history.
    const settledNow = (state.bets ?? []).filter(
      (b) => b.status !== "open" && b.settledAt != null
    );
    const previous = settledStatusRef.current;
    settledStatusRef.current = new Map(settledNow.map((b) => [b.id, b.status]));
    const settledSinceLastPoll: SettledBetNotice[] = [];
    if (previous != null) {
      for (const b of settledNow) {
        const prev = previous.get(b.id);
        const notice: SettledBetNotice = {
          betId: b.id,
          label: b.label,
          profit: b.status === "void" || b.status === "push" ? 0 : (b.actualProfit ?? 0),
          status: b.status,
        };
        if (prev == null) {
          // First settle: skip pure void/push (no toast); won/lost etc. announce.
          if (b.status !== "void" && b.status !== "push") {
            settledSinceLastPoll.push(notice);
          }
        } else if (prev !== b.status && (b.status === "void" || b.status === "push")) {
          // Settled then voided (or pushed): revise the existing result alert.
          settledSinceLastPoll.push(notice);
        }
      }
    }

    const now = Date.now();

    // B5: unhedged backs past their threshold (windows tunable via E1).
    // Intentional-nohedge notes are excluded inside detectNakedExposure.
    const eventStarts = new Map(state.events.map((e) => [e.id, e.startTime]));
    const nakedExposed = detectNakedExposure(state.bets ?? [], eventStarts, now, {
      thresholdMs: state.settings.tuning.nakedExposureMinutes * 60_000,
      imminentThresholdMs: state.settings.tuning.nakedImminentMinutes * 60_000,
    }).map((b) => ({ betId: b.id, label: b.label, bookmaker: b.bookmaker }));

    // B6: open 2UP positions whose selection just went two goals up.
    const twoUpTriggered: TwoUpLockNotice[] = [];
    for (const bet of state.bets ?? []) {
      if (bet.status !== "open" || !bet.earlyPayout || bet.eventId == null) continue;
      if (bet.selection !== "home" && bet.selection !== "away") continue;
      // The lock formula banks backStake×(backOdds−1); free-bet stakes bank
      // differently, so those get the plain alert without a suggestion.
      const formulaExact =
        bet.betType === "qualifying" ||
        bet.betType === "risk_free" ||
        bet.betType === "back_only";
      const event = state.events.find((e) => e.id === bet.eventId);
      if (!event || event.status !== "live") continue;
      const led2 = bet.selection === "home" ? !!event.homeLed2 : !!event.awayLed2;
      if (!led2) continue;
      const model = state.liveEventModels.find((m) => m.eventId === bet.eventId);
      const liveWinProb =
        bet.selection === "home" ? model?.homeWin : model?.awayWin;
      const suggestion =
        liveWinProb != null && formulaExact
          ? suggestTwoUpLock({
              backStake: bet.backStake,
              backOdds: bet.backOdds,
              layStake: bet.layStake,
              layOdds: bet.layOdds,
              commission: bet.commission,
              liveWinProb,
            })
          : null;
      twoUpTriggered.push({
        betId: bet.id,
        label: bet.label,
        eventName: `${event.homeTeam} v ${event.awayTeam}`,
        suggestion:
          suggestion && suggestion.backStake > 0
            ? {
                fairBackOdds: suggestion.fairBackOdds,
                backStake: suggestion.backStake,
                lockedProfit: suggestion.lockedProfit,
              }
            : null,
      });
    }

    // Drop Do Next rows for offers that no longer exist (deleted mid-session /
    // stale memo) so offer_expiring cannot fire after a campaign is gone.
    const liveOfferIds = new Set((state.offers ?? []).map((o) => o.id));
    const liveDoNext = doNext.filter(
      (item) => item.offerId == null || liveOfferIds.has(item.offerId)
    );

    const alerts = evaluateAlertRules({
      now,
      prefs: {
        offerExpiring: state.settings.alertsOfferExpiring,
        raceOffSoon: state.settings.alertsRaceOffSoon,
        resultSettled: state.settings.alertsResultSettled,
        nakedExposure: state.settings.alertsNakedExposure,
        twoUpLock: state.settings.alertsTwoUpLock,
      },
      doNext: liveDoNext,
      offers: (state.offers ?? []).map((o) => ({
        id: o.id,
        title: o.title,
        sport: o.sport,
        eventDate: o.eventDate,
        scopeCourse: o.scopeCourse,
        scopeRaceId: o.scopeRaceId,
        scopeRaceLabel: o.scopeRaceLabel,
        expiresAt: o.expiresAt,
      })),
      races: (state.planRaces ?? []).map((r) => ({
        ...r,
        hasOpenBet: r.hasOpenBet ?? false,
      })),
      settledSinceLastPoll,
      nakedExposed,
      twoUpTriggered,
    });

    // Re-read seen each pass so Intentional (banner) can suppress mid-session
    // before this effect's next run sees a stale in-memory set.
    const seen = readSeenAlertKeys();
    seenRef.current = seen;
    // Void/push revisions reuse result_settled:{id}; clear seen so inbox + toast update.
    for (const notice of settledSinceLastPoll) {
      if (notice.status === "void" || notice.status === "push") {
        seen.delete(`result_settled:${notice.betId}`);
      }
    }
    let dirty = false;
    const fresh: typeof alerts = [];
    for (const alert of alerts) {
      if (seen.has(alert.key)) continue;
      seen.add(alert.key);
      dirty = true;
      fresh.push(alert);
      channel.notify(alert);
    }
    if (dirty) {
      storeSeenAlertKeys(seen);
      // F2: toasts/notifications deliver; the inbox is the record. Batched,
      // fire-and-forget - a failed write never blocks delivery.
      void fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alerts: fresh.map((a) => ({
            key: a.key,
            kind: a.kind,
            title: a.title,
            body: a.body,
            href: a.href,
          })),
        }),
      }).catch(() => {});
    }
  }, [state, doNext, channel]);

  return null;
}
