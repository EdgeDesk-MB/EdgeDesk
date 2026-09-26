import {
  formatScopedEpRule,
  type EpBookieSetup,
} from "@/lib/twoup/bookie-offers";
import { epDeskFixtureSearch } from "@/lib/calc/ep/fixture-query";

/**
 * Desk tab query param. Deliberately not `view`: the public demo owns that one
 * for its plan preview (EDGE-159), and `tab` belongs to the fixture workbench.
 */
export const TWOUP_DESK_VIEW_PARAM = "deskView";

export const TWOUP_DESK_VIEWS = [
  "fixtures",
  "picks",
  "tracked",
  "active",
  "model",
] as const;

export type TwoUpDeskViewId = (typeof TWOUP_DESK_VIEWS)[number];

export function parseTwoUpDeskView(raw: string | null | undefined): TwoUpDeskViewId {
  return raw && (TWOUP_DESK_VIEWS as readonly string[]).includes(raw)
    ? (raw as TwoUpDeskViewId)
    : "fixtures";
}

/**
 * Query string for the next desk state. Every param the desk does not own is
 * carried through untouched, so a public demo's `?demo=1&view=free` survives
 * a tab click and a reload (EDGE-159).
 */
export function twoUpDeskSearch(
  current: string,
  next: {
    view: TwoUpDeskViewId;
    fixture?: { home: string; away: string; startTime?: number; tab?: string };
    clearFixture?: boolean;
  }
): string {
  const params = new URLSearchParams(current);
  if (next.view === "fixtures") params.delete(TWOUP_DESK_VIEW_PARAM);
  else params.set(TWOUP_DESK_VIEW_PARAM, next.view);
  if (next.clearFixture) {
    params.delete("home");
    params.delete("away");
    params.delete("start");
    params.delete("tab");
  } else if (next.fixture) {
    const search = new URLSearchParams(
      epDeskFixtureSearch({
        home: next.fixture.home,
        away: next.fixture.away,
        startTime: next.fixture.startTime,
        tab: next.fixture.tab,
      })
    );
    params.set("home", search.get("home") ?? next.fixture.home);
    params.set("away", search.get("away") ?? next.fixture.away);
    if (search.get("start")) params.set("start", search.get("start")!);
    if (search.get("tab")) params.set("tab", search.get("tab")!);
  }
  return params.toString();
}

export function isTwoUpBet(bet: {
  earlyPayout?: number | boolean | null;
  market?: string | null;
  status?: string | null;
  label?: string | null;
}): boolean {
  if (bet.earlyPayout === 1 || bet.earlyPayout === true) return true;
  if (bet.status === "early_payout") return true;
  if (bet.market === "two_up" || bet.market === "one_up") return true;
  const label = bet.label?.toLowerCase() ?? "";
  return /\b2up\b|\b1up\b|early payout/.test(label);
}

export function isExplicitOneUp(bet: {
  market?: string | null;
  label?: string | null;
}): boolean {
  if (bet.market === "one_up") return true;
  return /\b1up\b/.test(bet.label?.toLowerCase() ?? "");
}

export function isExplicitTwoUp(bet: {
  market?: string | null;
  label?: string | null;
}): boolean {
  if (bet.market === "two_up") return true;
  return /\b2up\b/.test(bet.label?.toLowerCase() ?? "");
}

/** Football 2UP/1UP is one early-payout form. Other sports use the bookie scope, or "Early payout". */
export function earlyPayoutOfferLabel(
  bet: {
    market?: string | null;
    label?: string | null;
    bookmaker?: string | null;
  },
  sport?: string | null,
  setup?: EpBookieSetup | null
): string {
  if (isExplicitOneUp(bet)) return "1UP";
  if (isExplicitTwoUp(bet)) return "2UP";
  if (setup && bet.bookmaker) {
    const scoped = formatScopedEpRule(setup, bet.bookmaker, sport);
    if (scoped) return scoped;
  }
  if (sport === "football") return "2UP";
  return "Early payout";
}

/** Dixon-Coles model is football-only. Missing sport is treated as football. */
export function canOpenFootballEpModel(sport?: string | null): boolean {
  return sport == null || sport === "football";
}
