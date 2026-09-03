/**
 * Infer user-originated result_settled keys from client `api()` mutations.
 * Prefers marking from the request body before fetch so a concurrent state
 * poll cannot deliver a sticky toast first.
 */

import { accaCompleteAlertKey } from "./acca-complete";
import { markUserOriginatedAlertKeys, markUserSettledBetIds } from "./user-originated";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function pathOnly(path: string): string {
  return path.split("?")[0] ?? path;
}

/** Mark settles that are fully known from the request (before fetch). */
export function noteUserOriginatedSettlesFromRequest(path: string, json: unknown): void {
  // sessionStorage gate matches user-originated.ts (no-op on server / private mode).
  if (typeof sessionStorage === "undefined") return;
  const betMatch = pathOnly(path).match(/^\/api\/bets\/(\d+)$/);
  if (betMatch && isRecord(json)) {
    const status = json.status;
    if (typeof status === "string" && status !== "open") {
      markUserSettledBetIds([Number(betMatch[1])]);
    }
  }
}

/** Mark settles that need the response body (after a successful fetch). */
export function noteUserOriginatedSettlesFromResponse(
  path: string,
  json: unknown,
  data: unknown
): void {
  if (typeof sessionStorage === "undefined") return;
  const p = pathOnly(path);

  // Direct bet PATCH already marked from the request.
  if (/^\/api\/bets\/\d+$/.test(p)) return;

  if (/^\/api\/boosts\/\d+$/.test(p) && isRecord(json) && "outcome" in json) {
    const bet = isRecord(data) && isRecord(data.bet) ? data.bet : null;
    const betId = bet ? positiveInt(bet.id) : null;
    if (betId != null) markUserSettledBetIds([betId]);
    return;
  }

  if (/^\/api\/bet-builder\/\d+$/.test(p) && isRecord(json) && typeof json.result === "string") {
    const run = isRecord(data) && isRecord(data.run) ? data.run : null;
    if (run) markUserSettledBetIds([positiveInt(run.backBetId), positiveInt(run.wholeLayBetId)]);
    return;
  }

  if (/^\/api\/acca\/legs\/\d+$/.test(p) && isRecord(json) && typeof json.result === "string") {
    const leg = isRecord(data) && isRecord(data.leg) ? data.leg : null;
    if (leg) markUserSettledBetIds([positiveInt(leg.layBetId)]);
    if (isRecord(data) && data.runCompleted === true) {
      const runId = positiveInt(data.runId);
      if (runId != null) markUserOriginatedAlertKeys([accaCompleteAlertKey(runId)]);
    }
  }
}
