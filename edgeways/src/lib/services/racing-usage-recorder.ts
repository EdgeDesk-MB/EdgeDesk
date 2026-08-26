/**
 * Durable racing usage counting (admin feed monitor). theracingapi.ts is
 * bundled for the client via the demo racing desk, so it cannot reference
 * Neon itself — it exposes `registerRacingUsageRecorder` and this server-only
 * module fills it in at server boot (see instrumentation.ts).
 *
 * Fire-and-forget by design: a failed count must never block a racing request.
 */
import "server-only";

import { isNeonDesk } from "@/lib/db/desk-backend";
import { registerRacingUsageRecorder } from "@/lib/services/theracingapi";

let registered = false;

export function ensureRacingUsageRecorder(): void {
  if (registered) return;
  registered = true;
  registerRacingUsageRecorder(() => {
    if (!isNeonDesk()) return;
    void import("@/lib/db/neon-feed-budget")
      .then((m) => m.recordNeonFeedUsage("racing"))
      .catch(() => {});
  });
}
