"use client";

/**
 * Alert watcher (C4): evaluates the pure alert rules against every state
 * poll and delivers new alerts through the local channel. Dedupe keys are
 * kept in sessionStorage so a reload doesn't replay the day's alerts.
 */

import { useEffect, useMemo, useRef } from "react";
import {
  clearedConditionAlertKeys,
  isConditionAlertKey,
} from "@/lib/alerts/condition-keys";
import {
  createLocalAlertChannel,
  ensureAlertToastLifecycle,
} from "@/lib/alerts/local-channel";
import { plainAlertBody } from "@/lib/alerts/plain-body";
import {
  evaluateAlertRules,
  type SettledBetNotice,
  type TwoUpLockNotice,
} from "@/lib/alerts/rules";
import { settlementEventResultLabel } from "@/lib/alerts/settlement-result";
import {
  dismissAlertNotifications,
  readSeenAlertKeys,
  storeSeenAlertKeys,
} from "@/lib/alerts/seen";
import { consumeUserOriginatedAlertKey } from "@/lib/alerts/user-originated";
import { detectNakedExposure } from "@/lib/bets/naked-exposure";
import { suggestTwoUpLock } from "@/lib/calc/two-up-lock";
import { parseRaceDisplayMeta, parseRacecardRunners } from "@/lib/racing";
import { useDoNextItems } from "@/hooks/use-do-next-items";

export function AlertWatcher() {
  const { items: doNext, state } = useDoNextItems();
  const channel = useMemo(() => createLocalAlertChannel(), []);
  const seenRef = useRef<Set<string> | null>(null);
  /** Condition keys firing on the previous poll - used to dismiss cleared prompts. */
  const prevActiveRef = useRef<Set<string> | null>(null);
  /** Tags we already asked devices to close this session (avoid dismiss spam). */
  const dismissedRef = useRef<Set<string>>(new Set());
  /** Settled bet id → status; detects new settles and later void/push revisions. */
  const settledStatusRef = useRef<Map<number, string> | null>(null);

  useEffect(() => {
    ensureAlertToastLifecycle();
  }, []);

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
    const offersById = new Map((state.offers ?? []).map((o) => [o.id, o]));
    const eventsById = new Map((state.events ?? []).map((e) => [e.id, e]));
    const settledSinceLastPoll: SettledBetNotice[] = [];
    if (previous != null) {
      for (const b of settledNow) {
        const prev = previous.get(b.id);
        const offer = b.offerId != null ? offersById.get(b.offerId) : undefined;
        const event = b.eventId != null ? eventsById.get(b.eventId) : undefined;
        const notice: SettledBetNotice = {
          betId: b.id,
          label: b.label,
          profit: b.status === "void" || b.status === "push" ? 0 : (b.actualProfit ?? 0),
          status: b.status,
          betType: b.betType,
          offerTitle: offer?.title ?? null,
          bookmaker: b.bookmaker ?? offer?.bookmaker ?? null,
          resultSummary: settlementEventResultLabel({
            selection: b.selection,
            sport: b.sport ?? event?.sport ?? null,
            event: event ?? null,
          }),
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
    }).map((b) => {
      const offer = b.offerId != null ? offersById.get(b.offerId) : undefined;
      return {
        betId: b.id,
        label: b.label,
        bookmaker: b.bookmaker ?? offer?.bookmaker ?? null,
        betType: b.betType,
        offerTitle: offer?.title ?? null,
      };
    });

    // B6: open 2UP positions whose selection just went two goals up.
    const twoUpTriggered: TwoUpLockNotice[] = [];
    for (const bet of state.bets ?? []) {
      if (bet.status !== "open" || !bet.earlyPayout || bet.eventId == null) continue;
      if (bet.selection !== "home" && bet.selection !== "away") continue;
      // The lock formula banks backStake×(backOdds−1); free-bet stakes bank
      // differently, so those get the plain alert without a suggestion.
      const formulaExact =
        bet.betType === "qualifying" ||
        bet.betType === "boost" ||
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
        status: o.status,
        offerType: o.offerType,
        rules: o.rules,
      })),
      races: (state.planRaces ?? []).map((r) => {
        const event = (state.events ?? []).find((e) => e.id === r.eventId);
        const meta = parseRaceDisplayMeta(event?.goals);
        const runners = parseRacecardRunners(event?.goals);
        const fieldSize = meta.fieldSize || runners.length || 0;
        return {
          ...r,
          hasOpenBet: r.hasOpenBet ?? false,
          externalId: event?.externalId ?? null,
          fieldSize: fieldSize > 0 ? fieldSize : null,
          region: null as string | null,
        };
      }),
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

    // Pull down shade notifications when a live prompt is no longer due
    // (claimed on web, lay added, race passed). First poll also sweeps seen
    // keys so a reload after completing an offer still dismisses the phone.
    const activeKeys = new Set(
      alerts.filter((a) => isConditionAlertKey(a.key)).map((a) => a.key)
    );
    const prevActive = prevActiveRef.current;
    const cleared = new Set<string>();
    if (prevActive != null) {
      for (const key of clearedConditionAlertKeys(prevActive, activeKeys)) {
        cleared.add(key);
      }
    } else {
      for (const key of seen) {
        if (isConditionAlertKey(key) && !activeKeys.has(key)) cleared.add(key);
      }
    }
    prevActiveRef.current = activeKeys;
    const toDismiss = [...cleared].filter((k) => !dismissedRef.current.has(k));
    if (toDismiss.length > 0) {
      for (const key of toDismiss) dismissedRef.current.add(key);
      channel.dismiss?.(toDismiss);
      void dismissAlertNotifications(toDismiss);
    }

    let dirty = false;
    const fresh: typeof alerts = [];
    for (const alert of alerts) {
      if (seen.has(alert.key)) {
        // Condition still live: refresh countdown copy on the open toast.
        if (isConditionAlertKey(alert.key)) {
          channel.refresh?.({ ...alert, delivery: "sticky" });
        }
        continue;
      }
      seen.add(alert.key);
      dirty = true;
      // User just settled / actioned this in-tab → ephemeral toast (no X).
      // Background / API autopilot settles stay sticky until dismissed.
      const delivery = consumeUserOriginatedAlertKey(alert.key)
        ? ("ephemeral" as const)
        : ("sticky" as const);
      const delivered = { ...alert, delivery };
      fresh.push(delivered);
      channel.notify(delivered);
      dismissedRef.current.delete(alert.key);
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
            body: plainAlertBody(a),
            href: a.href,
          })),
        }),
      }).catch(() => {});
    }
  }, [state, doNext, channel]);

  return null;
}
