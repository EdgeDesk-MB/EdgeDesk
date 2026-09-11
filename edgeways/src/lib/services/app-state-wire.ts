/**
 * Wire shape for /api/state: drop bulky tape the UI loads on demand,
 * and support ETag / 304 so 3s polls do not resend an unchanged desk.
 */
import { createHash } from "node:crypto";
import type { AppState } from "@/lib/services/state.types";

/** Finished football tape/XI stay on the match modal, not every Home poll.
 * Racing results live in `goals` and must stay on the wire. */
export function slimAppStateForWire(state: AppState): AppState {
  return {
    ...state,
    events: state.events.map((event) => {
      if (event.status === "live") return event;
      if ((event.sport ?? "football") === "horse_racing") return event;
      return { ...event, goals: null, lineups: null };
    }),
  };
}

export function etagForJsonBody(body: string): string {
  const digest = createHash("sha1").update(body).digest("base64url");
  return `"${digest}"`;
}

export function ifNoneMatchHits(
  ifNoneMatch: string | null | undefined,
  etag: string
): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").some((part) => {
    const token = part.trim();
    return token === etag || token === `W/${etag}`;
  });
}

export const PRIVATE_REVALIDATE = "private, no-cache";

/** Browser may reuse a store-first day card for a short window. */
export const STORE_FIRST_CACHE = "private, max-age=15, stale-while-revalidate=120";
