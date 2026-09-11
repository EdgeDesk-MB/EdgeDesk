/**
 * Hosted Home snapshot (EDGE-47). Neon bets, offers, wallets, history, casino
 * and this login's tracked fixtures (plus any still needed for an open bet).
 * Never opens SQLite: Vercel cannot mkdir the Mac `data/` folder.
 */
import "server-only";

import { listNeonAccaRuns } from "@/lib/db/neon-desk-acca";
import { listNeonBetBuilderRuns } from "@/lib/db/neon-desk-bet-builder";
import { listNeonSystemRuns } from "@/lib/db/neon-desk-systems";
import { countNeonBoostsNeedingAction } from "@/lib/db/neon-desk-boosts";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { neonEffortMeasured } from "@/lib/db/neon-desk-effort";
import { listNeonMugPlansForState } from "@/lib/db/neon-desk-mug-plans";
import { listNeonDeskCasinoOffers } from "@/lib/db/neon-desk-casino";
import { listNeonDeskOffers } from "@/lib/db/neon-desk-offers";
import {
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
} from "@/lib/db/neon-desk-accounts";
import {
  listNeonDeskHistory,
  listNeonDeskHistoryKeysForEvents,
  syncNeonDeskEventHistory,
} from "@/lib/db/neon-desk-history";
import { getNeonDeskSettings } from "@/lib/db/neon-desk-settings";
import { listNeonEventsByIds } from "@/lib/db/neon-events";
import { listNeonDeskTrackedEventIds } from "@/lib/db/neon-desk-tracked-events";
import { getDeskActor, runWithDeskActor } from "@/lib/db/desk-scope";
import {
  deskVisibleEventIds,
  filterEventsForDesk,
} from "@/lib/events/desk-tracked-events";
import {
  listNeonInboxDedupes,
  unreadNeonCount,
} from "@/lib/db/neon-alerts-inbox";
import {
  awardNeonPlaceFreeBetsDue,
  awardNeonUnconditionalFreeBetsDue,
  healNeonDeskLedgers,
} from "@/lib/db/neon-desk-ledger";
import {
  maybeSendNeonDailyTasksDigest,
  maybeSendNeonWeeklyDigest,
} from "@/lib/db/neon-desk-digests";
import { runNeonDeskLiveness } from "@/lib/db/neon-desk-liveness";
import { syncNeonOfferStatuses } from "@/lib/db/neon-desk-offer-liveness";
import { syncNeonOfferSeriesInstances } from "@/lib/db/neon-desk-offer-series";
import { syncNeonCasinoOfferSeriesInstances } from "@/lib/db/neon-desk-casino-series";
import {
  HOME_HISTORY_LIMIT,
  appStateFromNeonDesk,
} from "@/lib/db/neon-desk-state-map";
import { apiUsageTodayAsync } from "@/lib/services/apifootball";
import { maybeRunNeonFeedSync } from "@/lib/services/feed-sync-neon";
import {
  getAllExchangeProviderStatuses,
  getExchangeProviderStatus,
} from "@/lib/services/exchange";
import type { AppState } from "@/lib/services/state.types";

export {
  appStateFromNeonBets,
  appStateFromNeonDesk,
} from "@/lib/db/neon-desk-state-map";

const HOUSEKEEPING_MIN_MS = 20_000;
let lastHousekeepingAt = 0;

async function runHostedDeskHousekeeping(input: {
  events: Awaited<ReturnType<typeof listNeonEventsByIds>>;
  bets: Awaited<ReturnType<typeof listNeonDeskBets>>;
  transactions: Awaited<ReturnType<typeof listNeonDeskBalanceTransactions>>;
}): Promise<void> {
  try {
    const keys = await listNeonDeskHistoryKeysForEvents(input.events.map((e) => e.id));
    await syncNeonDeskEventHistory(input.events, keys);
  } catch {
    // Commentary backfill is best-effort; settlements still render.
  }
  try {
    await runNeonDeskLiveness(input.events);
  } catch {
    // Auto-result and lay-due alerts are best-effort; the snapshot still renders.
  }
  try {
    await syncNeonOfferSeriesInstances();
    await syncNeonCasinoOfferSeriesInstances();
  } catch {
    // Recurrence materialise is best-effort; the snapshot still renders.
  }
  try {
    await syncNeonOfferStatuses();
  } catch {
    // Offer status tick is best-effort; the snapshot still renders.
  }
  try {
    await healNeonDeskLedgers(input.bets);
  } catch {
    // Heal is best-effort; the snapshot still renders.
  }
  try {
    await awardNeonUnconditionalFreeBetsDue(input.bets, input.transactions);
    await awardNeonPlaceFreeBetsDue(input.bets, input.events, input.transactions);
  } catch {
    // Award is best-effort; the snapshot still renders.
  }
  try {
    await maybeSendNeonWeeklyDigest();
  } catch {
    // Digest is best-effort; the snapshot still renders.
  }
  try {
    await maybeSendNeonDailyTasksDigest();
  } catch {
    // Digest is best-effort; the snapshot still renders.
  }
}

async function scheduleHostedDeskHousekeeping(
  work: () => Promise<void>
): Promise<void> {
  const now = Date.now();
  if (now - lastHousekeepingAt < HOUSEKEEPING_MIN_MS) return;
  lastHousekeepingAt = now;
  const actor = getDeskActor();
  const run = () => runWithDeskActor(actor, work);
  try {
    const { after } = await import("next/server");
    after(() => {
      void run();
    });
  } catch {
    await run();
  }
}

export async function buildNeonDeskAppState(): Promise<AppState> {
  const [
    bets,
    followedIds,
    offers,
    accounts,
    transactions,
    history,
    casinoOffers,
    settings,
    apiUsage,
    alertsUnread,
    deliveredAlertKeys,
    effortMeasured,
    mugPlanRows,
    boostsOpen,
    accaBundles,
    systemBundles,
    bbBundles,
  ] = await Promise.all([
    listNeonDeskBets(),
    listNeonDeskTrackedEventIds().catch(() => []),
    listNeonDeskOffers(),
    listNeonDeskAccounts(),
    listNeonDeskBalanceTransactions(),
    listNeonDeskHistory(HOME_HISTORY_LIMIT),
    listNeonDeskCasinoOffers(),
    getNeonDeskSettings(),
    apiUsageTodayAsync(),
    // EDGE-110: the badge and the watcher's durable seen-set come from the
    // per-user Neon inbox. Fail soft: an inbox hiccup must not 500 Home.
    unreadNeonCount().catch(() => 0),
    listNeonInboxDedupes().catch(() => []),
    neonEffortMeasured().catch(() => ({})),
    listNeonMugPlansForState().catch(() => []),
    countNeonBoostsNeedingAction().catch(() => 0),
    listNeonAccaRuns().catch(() => []),
    listNeonSystemRuns().catch(() => []),
    listNeonBetBuilderRuns().catch(() => []),
    // Every hosted dashboard poll is a chance to advance the shared feed.
    // Taking the lease is one cheap query alongside the snapshot reads; the
    // sync itself is handed to `after()`, so the response is never blocked.
    maybeRunNeonFeedSync().catch(() => ({ acquired: false })),
  ]);
  const eventIds = [...deskVisibleEventIds(followedIds, bets)];
  const feedEvents = await listNeonEventsByIds(eventIds).catch(() => []);
  const events = filterEventsForDesk(feedEvents, followedIds, bets);
  await scheduleHostedDeskHousekeeping(() =>
    runHostedDeskHousekeeping({ events, bets, transactions })
  );
  const snapshot = appStateFromNeonDesk({
    bets,
    events,
    offers,
    accounts,
    transactions,
    history,
    casinoOffers,
    settings,
    apiUsage,
    alertsUnread,
    deliveredAlertKeys,
    effortMeasured,
    mugPlans: mugPlanRows,
    boostsOpen,
    deskRuns: {
      acca: accaBundles,
      systems: systemBundles,
      betBuilder: bbBundles,
    },
  });
  // Keys live in Vercel env, not SQLite. The pure mapper cannot read them.
  return {
    ...snapshot,
    exchangeProvider: "betfair",
    exchangeName: "Betfair",
    exchangeStatus: getExchangeProviderStatus("betfair"),
    exchangeProviders: getAllExchangeProviderStatuses(),
  };
}
