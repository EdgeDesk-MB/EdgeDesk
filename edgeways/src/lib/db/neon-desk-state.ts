/**
 * Hosted Home snapshot (EDGE-47). Neon bets, offers, wallets and history.
 * Never opens SQLite. Vercel cannot mkdir the Mac `data/` folder.
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
import { appStateFromNeonDesk } from "@/lib/db/neon-desk-state-map";
import type { AppState } from "@/lib/services/state.types";

export {
  appStateFromNeonBets,
  appStateFromNeonDesk,
} from "@/lib/db/neon-desk-state-map";

export async function buildNeonDeskAppState(): Promise<AppState> {
  const [bets, offers, accounts, transactions, history, settings] =
    await Promise.all([
      listNeonDeskBets(),
      listNeonDeskOffers(),
      listNeonDeskAccounts(),
      listNeonDeskBalanceTransactions(),
      listNeonDeskHistory(),
      getNeonDeskSettings(),
    ]);
  return appStateFromNeonDesk({
    bets,
    offers,
    accounts,
    transactions,
    history,
    settings,
  });
}
