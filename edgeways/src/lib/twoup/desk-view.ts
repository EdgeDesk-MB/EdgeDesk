import {
  formatScopedEpRule,
  type EpBookieSetup,
} from "@/lib/twoup/bookie-offers";

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
