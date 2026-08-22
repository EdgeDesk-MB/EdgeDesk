/**
 * Hosted Home snapshot (EDGE-47). Neon bets only. Never opens SQLite.
 * Vercel cannot mkdir the Mac `data/` folder.
 */
import "server-only";

import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { getNeonDeskSettings } from "@/lib/db/neon-desk-settings";
import { appStateFromNeonBets } from "@/lib/db/neon-desk-state-map";
import type { AppState } from "@/lib/services/state.types";

export { appStateFromNeonBets } from "@/lib/db/neon-desk-state-map";

export async function buildNeonDeskAppState(): Promise<AppState> {
  const [bets, settings] = await Promise.all([
    listNeonDeskBets(),
    getNeonDeskSettings(),
  ]);
  return appStateFromNeonBets(bets, settings);
}
