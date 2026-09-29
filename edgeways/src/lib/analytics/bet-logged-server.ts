import "server-only";

import { lt } from "drizzle-orm";
import {
  betLoggedProperties,
  type BetLoggedSource,
} from "@/lib/analytics/bet-logged";
import { shouldCapturePosthogOnServer } from "@/lib/analytics/posthog-gate";
import { captureServerEvent } from "@/lib/analytics/server-capture";
import { bets, db } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { getDeskActor, runWithDeskActor } from "@/lib/db/desk-scope";
import { neonDeskHasBetBefore } from "@/lib/db/neon-desk";

async function hasBetBefore(betId: number): Promise<boolean> {
  if (isNeonDesk()) return neonDeskHasBetBefore(betId);
  return Boolean(
    db.select({ id: bets.id }).from(bets).where(lt(bets.id, betId)).limit(1).get()
  );
}

/**
 * Loop signal: a user saved a new bet (not an edit). Runs after the response
 * so the save never waits on analytics, and skips the `is_first` lookup
 * entirely when capture is off (everywhere but production). Call only after
 * the bet row is written. Properties are limited to `betLoggedProperties`.
 */
export async function captureBetLoggedAfterResponse(input: {
  betId: number | null;
  source: BetLoggedSource;
}): Promise<void> {
  if (!shouldCapturePosthogOnServer()) return;
  const actor = getDeskActor();
  const distinctId = actor.clerkUserId;
  const betId = input.betId;
  if (!distinctId || betId == null) return;

  const work = () =>
    runWithDeskActor(actor, async () => {
      try {
        const isFirst = !(await hasBetBefore(betId));
        captureServerEvent(
          distinctId,
          "bet_logged",
          betLoggedProperties({ source: input.source, isFirst })
        );
      } catch {
        /* analytics optional */
      }
    });

  try {
    const { after } = await import("next/server");
    after(work);
  } catch {
    await work();
  }
}
