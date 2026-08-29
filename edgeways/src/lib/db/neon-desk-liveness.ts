/**
 * Hosted poll-time desk liveness: auto-result linked legs and raise
 * first-time lay-due alerts. Mirrors the local getAppState side effects.
 */
import "server-only";

import { autoResultNeonAccaLegs, raiseNeonAccaLayDueAlerts } from "@/lib/db/neon-desk-acca";
import {
  autoResultNeonBetBuilderSelections,
  raiseNeonBetBuilderLayDueAlerts,
} from "@/lib/db/neon-desk-bet-builder";
import { autoResultNeonSystemLegs } from "@/lib/db/neon-desk-systems";
import type { EventRow } from "@/lib/db/schema";

export async function runNeonDeskLiveness(events: EventRow[]): Promise<number> {
  const resolved =
    (await autoResultNeonAccaLegs(events).catch(() => 0)) +
    (await autoResultNeonSystemLegs(events).catch(() => 0)) +
    (await autoResultNeonBetBuilderSelections(events).catch(() => 0));
  await raiseNeonAccaLayDueAlerts().catch(() => 0);
  await raiseNeonBetBuilderLayDueAlerts().catch(() => 0);
  return resolved;
}
