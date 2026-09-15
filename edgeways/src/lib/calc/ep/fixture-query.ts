/** Fixture board → 2UP Desk query. Kept on the URL like Racing `?race=`. */

export const TWOUP_DESK_PATH = "/early-payout";
/** Previous live-desk path. `/2up` permanently redirects here. */
export const TWOUP_DESK_LEGACY_PATH = "/2up";
/** @deprecated Use TWOUP_DESK_PATH. Old bookmarks still redirect here. */
export const EP_DESK_PATH = TWOUP_DESK_PATH;
export const EP_DESK_LEGACY_PATH = "/calculators/ep-desk";

export const EP_DESK_TABS = ["dutch", "offers", "lay", "live"] as const;
export type EpDeskTab = (typeof EP_DESK_TABS)[number];

export interface EpDeskFixtureQuery {
  home: string;
  away: string;
  startTime?: number;
  tab: EpDeskTab;
}

export function parseEpDeskTab(raw: string | null | undefined): EpDeskTab {
  return raw && (EP_DESK_TABS as readonly string[]).includes(raw) ? (raw as EpDeskTab) : "dutch";
}

export function parseEpDeskFixtureQuery(params: {
  home?: string | null;
  away?: string | null;
  start?: string | null;
  tab?: string | null;
}): EpDeskFixtureQuery | null {
  const home = params.home?.trim() ?? "";
  const away = params.away?.trim() ?? "";
  if (!home || !away) return null;
  const startRaw = params.start?.trim() ?? "";
  const startTime = startRaw ? Number(startRaw) : NaN;
  return {
    home,
    away,
    startTime: Number.isFinite(startTime) && startTime > 0 ? startTime : undefined,
    tab: parseEpDeskTab(params.tab),
  };
}

export function epDeskFixtureSearch(input: {
  home: string;
  away: string;
  startTime?: number;
  tab?: string;
}): string {
  const q = new URLSearchParams({
    home: input.home,
    away: input.away,
    tab: parseEpDeskTab(input.tab),
  });
  if (input.startTime != null && Number.isFinite(input.startTime) && input.startTime > 0) {
    q.set("start", String(input.startTime));
  }
  return q.toString();
}

export function epDeskFixtureHref(input: {
  home: string;
  away: string;
  startTime?: number;
  tab?: string;
}): string {
  return `${EP_DESK_PATH}?${epDeskFixtureSearch(input)}`;
}
