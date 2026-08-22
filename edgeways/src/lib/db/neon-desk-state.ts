/**
 * Hosted Home snapshot (EDGE-47). Neon bets only. Never opens SQLite.
 * Vercel cannot mkdir the Mac `data/` folder.
 */
import "server-only";

import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { appStateFromNeonBets } from "@/lib/db/neon-desk-state-map";
import type { AppState } from "@/lib/services/state.types";

export { appStateFromNeonBets } from "@/lib/db/neon-desk-state-map";

export async function buildNeonDeskAppState(): Promise<AppState> {
  return appStateFromNeonBets(await listNeonDeskBets());
}
