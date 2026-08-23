/**
 * Hosted Home snapshot (EDGE-47). Neon bets, offers, wallets, history and the
 * global feed events (EDGE-81b). Never opens SQLite: Vercel cannot mkdir the
 * Mac `data/` folder.
 */
import "server-only";

import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { listNeonDeskOffers } from "@/lib/db/neon-desk-offers";
import {
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
} from "@/lib/db/neon-desk-accounts";
import { listNeonDeskHistory } from "@/lib/db/neon-desk-history";
import { getNeonDeskSettings } from "@/lib/db/neon-desk-settings";
import { listNeonEvents } from "@/lib/db/neon-events";
import { appStateFromNeonDesk } from "@/lib/db/neon-desk-state-map";
import { apiUsageTodayAsync } from "@/lib/services/apifootball";
import { maybeRunNeonFeedSync } from "@/lib/services/feed-sync-neon";
import type { AppState } from "@/lib/services/state.types";

export {
  appStateFromNeonBets,
  appStateFromNeonDesk,
} from "@/lib/db/neon-desk-state-map";

export async function buildNeonDeskAppState(): Promise<AppState> {
  const [bets, events, offers, accounts, transactions, history, settings, apiUsage] =
    await Promise.all([
      listNeonDeskBets(),
      listNeonEvents().catch(() => []),
      listNeonDeskOffers(),
      listNeonDeskAccounts(),
      listNeonDeskBalanceTransactions(),
      listNeonDeskHistory(),
      getNeonDeskSettings(),
      apiUsageTodayAsync(),
      // Every hosted dashboard poll is a chance to advance the shared feed.
      // Taking the lease is one cheap query alongside the snapshot reads; the
      // sync itself is handed to `after()`, so the response is never blocked.
      maybeRunNeonFeedSync().catch(() => ({ acquired: false })),
    ]);
  return appStateFromNeonDesk({
    bets,
    events,
    offers,
    accounts,
    transactions,
    history,
    settings,
    apiUsage,
  });
}
