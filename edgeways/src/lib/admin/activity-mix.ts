import { rankShare, shareSlices, type ShareSlice } from "@/lib/admin/series";
import { inferSportFromBet } from "@/lib/markets";
import { SPORTS, sportDisplayLabel } from "@/lib/sports";

export const ACTIVITY_UNSET_KEY = "unset";

export type ActivityKeyedCount = {
  clerkUserId: string;
  key: string;
  n: number;
};

export type ActivityMix = {
  betTypes: ActivityKeyedCount[];
  betSports: ActivityKeyedCount[];
  betStatuses: ActivityKeyedCount[];
  betPurposes: ActivityKeyedCount[];
  betSources: ActivityKeyedCount[];
  betCampaigns: ActivityKeyedCount[];
  betBookmakers: ActivityKeyedCount[];
  offerSports: ActivityKeyedCount[];
  offerTypes: ActivityKeyedCount[];
  offerStatuses: ActivityKeyedCount[];
  offerSources: ActivityKeyedCount[];
  offerBookmakers: ActivityKeyedCount[];
  casinoBrands: ActivityKeyedCount[];
  casinoStatuses: ActivityKeyedCount[];
};

export type ActivityMixCharts = {
  betTypes: ShareSlice[];
  betSports: ShareSlice[];
  betStatuses: ShareSlice[];
  betPurposes: ShareSlice[];
  betSources: ShareSlice[];
  betCampaigns: ShareSlice[];
  betBookmakers: ShareSlice[];
  offerSports: ShareSlice[];
  offerTypes: ShareSlice[];
  offerStatuses: ShareSlice[];
  offerSources: ShareSlice[];
  offerBookmakers: ShareSlice[];
  casinoBrands: ShareSlice[];
  casinoStatuses: ShareSlice[];
};

const MIX_TONES = [
  "brand",
  "edge",
  "success",
  "warning",
  "profit",
  "destructive",
  "muted",
] as const;

const BET_TYPE_ORDER = [
  "qualifying",
  "free_snr",
  "free_sr",
  "risk_free",
  "back_only",
  "lay_only",
  "dutch",
  "boost",
] as const;

const BET_TYPE_LABEL: Record<string, string> = {
  qualifying: "Qualifying",
  free_snr: "Free bet (SNR)",
  free_sr: "Free bet (SR)",
  risk_free: "Risk-free",
  back_only: "No lay",
  lay_only: "Lay only",
  dutch: "Dutch",
  boost: "Boost",
};

const BET_STATUS_ORDER = [
  "open",
  "won",
  "lost",
  "void",
  "early_payout",
  "half_win",
  "half_lose",
  "push",
] as const;

const BET_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
  void: "Void",
  early_payout: "Early payout",
  half_win: "Half win",
  half_lose: "Half lose",
  push: "Push",
};

const OFFER_STATUS_ORDER = ["planned", "active", "completed", "expired"] as const;

const OFFER_TYPE_LABEL: Record<string, string> = {
  bet_get_free_place: "Place refund",
  promo_terms: "Promo terms",
  general: "General",
};

const SPORT_HEAD = [
  "horse_racing",
  "football",
  "sports",
  "casino",
  "tennis",
  "greyhounds",
] as const;

const SPORT_HEAD_SET = new Set<string>(SPORT_HEAD);

export const SPORT_ORDER = [
  ...SPORT_HEAD,
  ...SPORTS.map((sport) => sport.value).filter((value) => !SPORT_HEAD_SET.has(value)),
];

export type LeadingSport = {
  key: string;
  n: number;
  total: number;
};

export type SportDeskRow = {
  key: string;
  label: string;
  bets: number;
  desks: number;
};

export function emptyActivityMix(): ActivityMix {
  return {
    betTypes: [],
    betSports: [],
    betStatuses: [],
    betPurposes: [],
    betSources: [],
    betCampaigns: [],
    betBookmakers: [],
    offerSports: [],
    offerTypes: [],
    offerStatuses: [],
    offerSources: [],
    offerBookmakers: [],
    casinoBrands: [],
    casinoStatuses: [],
  };
}

export function normaliseActivityKey(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : ACTIVITY_UNSET_KEY;
}

export function activitySportLabel(key: string): string {
  if (key === ACTIVITY_UNSET_KEY) return "Not set";
  if (key === "sports") return "Sports";
  if (key === "casino") return "Casino";
  return sportDisplayLabel(key);
}

function trimmedActivityValue(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Same preference as the desk tracker: linked event, then the bet row, then
 * the campaign, then the market. Unknown stored ids are kept, not forced
 * through the known-sport list.
 */
export function resolveActivitySport(input: {
  eventSport?: string | null;
  betSport?: string | null;
  offerSport?: string | null;
  market?: string | null;
}): string {
  return (
    trimmedActivityValue(input.eventSport) ??
    trimmedActivityValue(input.betSport) ??
    trimmedActivityValue(input.offerSport) ??
    (trimmedActivityValue(input.market)
      ? inferSportFromBet(input.market!)
      : ACTIVITY_UNSET_KEY)
  );
}

function sportOrderRank(key: string): number {
  const index = SPORT_ORDER.indexOf(key);
  return index === -1 ? SPORT_ORDER.length : index;
}

export function leadingSportByUser(
  rows: ActivityKeyedCount[]
): Map<string, LeadingSport> {
  const byUser = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!row.clerkUserId || !Number.isFinite(row.n) || row.n <= 0) continue;
    const sports = byUser.get(row.clerkUserId) ?? new Map<string, number>();
    const key = normaliseActivityKey(row.key);
    sports.set(key, (sports.get(key) ?? 0) + row.n);
    byUser.set(row.clerkUserId, sports);
  }
  const out = new Map<string, LeadingSport>();
  for (const [userId, sports] of byUser) {
    let bestKey = ACTIVITY_UNSET_KEY;
    let bestN = 0;
    let total = 0;
    for (const [key, n] of sports) {
      total += n;
      if (
        n > bestN ||
        (n === bestN && sportOrderRank(key) < sportOrderRank(bestKey))
      ) {
        bestKey = key;
        bestN = n;
      }
    }
    if (total > 0) out.set(userId, { key: bestKey, n: bestN, total });
  }
  return out;
}

export function sportDeskRows(rows: ActivityKeyedCount[]): SportDeskRow[] {
  const bets = new Map<string, number>();
  const desks = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.clerkUserId || !Number.isFinite(row.n) || row.n <= 0) continue;
    const key = normaliseActivityKey(row.key);
    bets.set(key, (bets.get(key) ?? 0) + row.n);
    const set = desks.get(key) ?? new Set<string>();
    set.add(row.clerkUserId);
    desks.set(key, set);
  }
  return [...bets.entries()]
    .map(([key, n]) => ({
      key,
      label: activitySportLabel(key),
      bets: n,
      desks: desks.get(key)?.size ?? 0,
    }))
    .sort(
      (a, b) =>
        b.bets - a.bets ||
        sportOrderRank(a.key) - sportOrderRank(b.key) ||
        a.label.localeCompare(b.label)
    );
}

export function activityBetTypeLabel(key: string): string {
  if (key === ACTIVITY_UNSET_KEY) return "Not set";
  return BET_TYPE_LABEL[key] ?? titleCaseKey(key);
}

export function activityBetStatusLabel(key: string): string {
  if (key === ACTIVITY_UNSET_KEY) return "Not set";
  return BET_STATUS_LABEL[key] ?? titleCaseKey(key);
}

export function activityPurposeLabel(key: string): string {
  if (key === "mug") return "Mug";
  return "Edge";
}

export function activityBetSourceLabel(key: string): string {
  if (key === "import") return "Imported";
  if (key === "quick") return "Quick log";
  return "Typed";
}

export function activityCampaignLabel(key: string): string {
  return key === "linked" ? "On a campaign" : "Not on a campaign";
}

export function activityOfferTypeLabel(key: string): string {
  if (key === ACTIVITY_UNSET_KEY) return "Not set";
  return OFFER_TYPE_LABEL[key] ?? titleCaseKey(key);
}

export function activityOfferStatusLabel(key: string): string {
  if (key === ACTIVITY_UNSET_KEY) return "Not set";
  return titleCaseKey(key);
}

export function activityOfferSourceLabel(key: string): string {
  if (key === "email") return "Email intake";
  return "Typed";
}

export function activityBookmakerLabel(key: string): string {
  if (key === ACTIVITY_UNSET_KEY) return "Not set";
  return key;
}

export function filterActivityMix(
  mix: ActivityMix,
  skipIds: Set<string> | null
): ActivityMix {
  if (!skipIds || skipIds.size === 0) return mix;
  const keep = (row: ActivityKeyedCount) => !skipIds.has(row.clerkUserId);
  return {
    betTypes: mix.betTypes.filter(keep),
    betSports: mix.betSports.filter(keep),
    betStatuses: mix.betStatuses.filter(keep),
    betPurposes: mix.betPurposes.filter(keep),
    betSources: mix.betSources.filter(keep),
    betCampaigns: mix.betCampaigns.filter(keep),
    betBookmakers: mix.betBookmakers.filter(keep),
    offerSports: mix.offerSports.filter(keep),
    offerTypes: mix.offerTypes.filter(keep),
    offerStatuses: mix.offerStatuses.filter(keep),
    offerSources: mix.offerSources.filter(keep),
    offerBookmakers: mix.offerBookmakers.filter(keep),
    casinoBrands: mix.casinoBrands.filter(keep),
    casinoStatuses: mix.casinoStatuses.filter(keep),
  };
}

export function buildActivityMixCharts(mix: ActivityMix): ActivityMixCharts {
  return {
    betTypes: slicesFromKeyed(mix.betTypes, activityBetTypeLabel, [...BET_TYPE_ORDER]),
    betSports: slicesFromKeyed(mix.betSports, activitySportLabel, SPORT_ORDER),
    betStatuses: slicesFromKeyed(
      mix.betStatuses,
      activityBetStatusLabel,
      [...BET_STATUS_ORDER]
    ),
    betPurposes: slicesFromKeyed(mix.betPurposes, activityPurposeLabel, [
      "edge",
      "mug",
    ]),
    betSources: slicesFromKeyed(mix.betSources, activityBetSourceLabel, [
      "typed",
      "quick",
      "import",
    ]),
    betCampaigns: slicesFromKeyed(mix.betCampaigns, activityCampaignLabel, [
      "linked",
      "none",
    ]),
    betBookmakers: rankKeyed(mix.betBookmakers, activityBookmakerLabel),
    offerSports: slicesFromKeyed(mix.offerSports, activitySportLabel, SPORT_ORDER),
    offerTypes: slicesFromKeyed(mix.offerTypes, activityOfferTypeLabel, [
      "bet_get_free_place",
      "promo_terms",
      "general",
      ACTIVITY_UNSET_KEY,
    ]),
    offerStatuses: slicesFromKeyed(
      mix.offerStatuses,
      activityOfferStatusLabel,
      [...OFFER_STATUS_ORDER]
    ),
    offerSources: slicesFromKeyed(mix.offerSources, activityOfferSourceLabel, [
      "typed",
      "email",
    ]),
    offerBookmakers: rankKeyed(mix.offerBookmakers, activityBookmakerLabel),
    casinoBrands: rankKeyed(mix.casinoBrands, activityBookmakerLabel),
    casinoStatuses: slicesFromKeyed(
      mix.casinoStatuses,
      activityOfferStatusLabel,
      [...OFFER_STATUS_ORDER]
    ),
  };
}

function titleCaseKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function totalsByKey(rows: ActivityKeyedCount[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.clerkUserId || !Number.isFinite(row.n) || row.n <= 0) continue;
    const key = normaliseActivityKey(row.key);
    totals.set(key, (totals.get(key) ?? 0) + row.n);
  }
  return totals;
}

function slicesFromKeyed(
  rows: ActivityKeyedCount[],
  labelOf: (key: string) => string,
  order: string[]
): ShareSlice[] {
  const totals = totalsByKey(rows);
  const items: Array<{ key: string; label: string; value: number }> = [];
  const seen = new Set<string>();
  for (const key of order) {
    const value = totals.get(key) ?? 0;
    if (value <= 0) continue;
    items.push({ key, label: labelOf(key), value });
    seen.add(key);
  }
  for (const [key, value] of totals) {
    if (seen.has(key) || value <= 0) continue;
    items.push({ key, label: labelOf(key), value });
  }
  return shareSlices(
    items.map((item, index) => ({
      ...item,
      tone: MIX_TONES[index % MIX_TONES.length] ?? "muted",
    }))
  );
}

function rankKeyed(
  rows: ActivityKeyedCount[],
  labelOf: (key: string) => string
): ShareSlice[] {
  const totals = totalsByKey(rows);
  return rankShare(
    [...totals.entries()].map(([key, value]) => ({
      key,
      label: labelOf(key),
      value,
    })),
    [...MIX_TONES]
  );
}
