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
import { listNeonDeskHistory } from "@/lib/db/neon-desk-history";
import { getNeonDeskSettings } from "@/lib/db/neon-desk-settings";
import { listNeonEvents } from "@/lib/db/neon-events";
import { listNeonDeskTrackedEventIds } from "@/lib/db/neon-desk-tracked-events";
import { filterEventsForDesk } from "@/lib/events/desk-tracked-events";
import {
  listNeonInboxDedupes,
  unreadNeonCount,
} from "@/lib/db/neon-alerts-inbox";
import { awardNeonUnconditionalFreeBetsDue, healNeonDeskLedgers } from "@/lib/db/neon-desk-ledger";
import {
  maybeSendNeonDailyTasksDigest,
  maybeSendNeonWeeklyDigest,
} from "@/lib/db/neon-desk-digests";
import { runNeonDeskLiveness } from "@/lib/db/neon-desk-liveness";
import { syncNeonOfferStatuses } from "@/lib/db/neon-desk-offer-liveness";
import { appStateFromNeonDesk } from "@/lib/db/neon-desk-state-map";
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

export async function buildNeonDeskAppState(): Promise<AppState> {
  let [bets, feedEvents, followedIds, offers, accounts, transactions, history, casinoOffers, settings, apiUsage, alertsUnread, deliveredAlertKeys] =
    await Promise.all([
      listNeonDeskBets(),
      listNeonEvents().catch(() => []),
      listNeonDeskTrackedEventIds().catch(() => []),
      listNeonDeskOffers(),
      listNeonDeskAccounts(),
      listNeonDeskBalanceTransactions(),
      listNeonDeskHistory(),
      listNeonDeskCasinoOffers(),
      getNeonDeskSettings(),
      apiUsageTodayAsync(),
      // EDGE-110: the badge and the watcher's durable seen-set come from the
      // per-user Neon inbox. Fail soft: an inbox hiccup must not 500 Home.
      unreadNeonCount().catch(() => 0),
      listNeonInboxDedupes().catch(() => []),
      // Every hosted dashboard poll is a chance to advance the shared feed.
      // Taking the lease is one cheap query alongside the snapshot reads; the
      // sync itself is handed to `after()`, so the response is never blocked.
      maybeRunNeonFeedSync().catch(() => ({ acquired: false })),
    ]);
  const events = filterEventsForDesk(feedEvents, followedIds, bets);
  try {
    const resolved = await runNeonDeskLiveness(events);
    if (resolved > 0) {
      bets = await listNeonDeskBets();
    }
  } catch {
    // Auto-result and lay-due alerts are best-effort; the snapshot still renders.
  }
  try {
    const statusChanged = await syncNeonOfferStatuses();
    if (statusChanged > 0) {
      const [nextOffers, nextBets] = await Promise.all([
        listNeonDeskOffers(),
        listNeonDeskBets(),
      ]);
      offers = nextOffers;
      bets = nextBets;
    }
  } catch {
    // Offer status tick is best-effort; the snapshot still renders.
  }
  try {
    const healed = await healNeonDeskLedgers(bets);
    if (healed > 0) {
      const [nextBets, nextAccounts, nextTxs] = await Promise.all([
        listNeonDeskBets(),
        listNeonDeskAccounts(),
        listNeonDeskBalanceTransactions(),
      ]);
      bets = nextBets;
      accounts = nextAccounts;
      transactions = nextTxs;
    }
  } catch {
    // Heal is best-effort; the snapshot still renders.
  }
  try {
    const awarded = await awardNeonUnconditionalFreeBetsDue(bets, transactions);
    if (awarded > 0) {
      const [nextTxs, nextHistory] = await Promise.all([
        listNeonDeskBalanceTransactions(),
        listNeonDeskHistory(),
      ]);
      transactions = nextTxs;
      history = nextHistory;
    }
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
  const [effortMeasured, mugPlanRows, boostsOpen, accaBundles, systemBundles, bbBundles] =
    await Promise.all([
      neonEffortMeasured().catch(() => ({})),
      listNeonMugPlansForState().catch(() => []),
      countNeonBoostsNeedingAction().catch(() => 0),
      listNeonAccaRuns().catch(() => []),
      listNeonSystemRuns().catch(() => []),
      listNeonBetBuilderRuns().catch(() => []),
    ]);
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
