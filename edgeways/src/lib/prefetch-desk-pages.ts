/**
 * Warm the slow page GETs before the click. Hover / focus starts the
 * request; Home also warms the usual next desks once /api/state is in.
 */
import { apiGet } from "@/hooks/use-app-state";
import { feedHorizonDates } from "@/lib/events";

const DEFAULT_TTL_MS = 2 * 60_000;

export function deskPagePrefetchPaths(href: string, now = Date.now()): string[] {
  const [today, tomorrow] = feedHorizonDates(now);
  const path = href.split("?")[0] ?? href;

  if (path === "/fixtures") {
    return [
      `/api/fixtures?date=${encodeURIComponent(today)}`,
      `/api/fixtures?date=${encodeURIComponent(tomorrow)}`,
      `/api/racing/racecards?date=${encodeURIComponent(today)}`,
      `/api/racing/racecards?date=${encodeURIComponent(tomorrow)}`,
    ];
  }
  if (path === "/racing") {
    return [
      `/api/racing/desk?date=${encodeURIComponent(today)}`,
      `/api/racing/racecards?date=${encodeURIComponent(today)}`,
      `/api/racing/racecards?date=${encodeURIComponent(tomorrow)}`,
    ];
  }
  if (path === "/history") {
    return ["/api/history?filter=all&limit=200"];
  }
  if (path === "/alerts") {
    return ["/api/alerts"];
  }
  return [];
}

const warmed = new Set<string>();

export function prefetchDeskPageApis(href: string): void {
  for (const path of deskPagePrefetchPaths(href)) {
    if (warmed.has(path)) continue;
    warmed.add(path);
    void apiGet(path, DEFAULT_TTL_MS).catch(() => {
      warmed.delete(path);
    });
  }
}

const WARM_HREFS = ["/fixtures", "/racing", "/history", "/alerts"] as const;

export function prefetchWarmDeskPages(): void {
  if (typeof window === "undefined") return;
  const run = () => {
    for (const href of WARM_HREFS) prefetchDeskPageApis(href);
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 2500 });
    return;
  }
  window.setTimeout(run, 400);
}
