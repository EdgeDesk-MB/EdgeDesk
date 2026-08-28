/**
 * Durable racing usage counting + hard daily cap (EDGE-81c, EDGE-100).
 * theracingapi.ts is bundled for the client via the demo racing desk, so it
 * cannot reference Neon itself — it exposes `registerRacingBudgetGate` and
 * this server-only module fills it in at server boot (see instrumentation.ts).
 *
 * The gate spends through `spendNeonFeedBudget`, so counting and capping are
 * one atomic statement: over-cap requests are denied AND stop inflating the
 * counter. A Neon hiccup fails open (allow) — the provider's own per-second
 * limit still applies, and a database wobble should not blank the racing
 * desk. Matches football's fallback posture.
 */
import "server-only";

import { isNeonDesk } from "@/lib/db/desk-backend";
import { registerRacingBudgetGate } from "@/lib/services/theracingapi";

let registered = false;

export function ensureRacingUsageRecorder(): void {
  if (registered) return;
  registered = true;
  registerRacingBudgetGate(async (operation) => {
    if (!isNeonDesk()) return true;
    try {
      const [{ spendNeonFeedBudget, logFeedUsageEvent }, { readFeedCaps }] =
        await Promise.all([
          import("@/lib/db/neon-feed-budget"),
          import("@/lib/admin/feed-caps"),
        ]);
      const caps = await readFeedCaps();
      const allowed =
        (await spendNeonFeedBudget(caps.racing, undefined, "racing")) != null;
      if (allowed) await logFeedUsageEvent("racing", operation);
      return allowed;
    } catch {
      return true;
    }
  });
}
