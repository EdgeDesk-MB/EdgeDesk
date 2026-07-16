/**
 * Bookmaker league table + account health (B9). Pure aggregation over
 * bets + offers grouped by bookie account: realised ROI, per-bookie free-bet
 * retention, offer frequency and drought. Health is MANUAL-FIRST: gubbed and
 * closed come from the existing accessStatus column (single source of truth);
 * the additive `health` column only stores the "cooling" flag. Nothing in
 * here writes anything.
 */

import { normalizeAccessStatus } from "@/lib/accounts/access";
import { roundPence } from "@/lib/calc/money";

export type BookmakerHealth = "healthy" | "cooling" | "gubbed";

/** Offer drought beyond this many days earns a "mark as cooling?" nudge. */
export const DROUGHT_NUDGE_DAYS = 40;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HealthSourceAccount {
  accessStatus?: string | null;
  health?: string | null;
}

/**
 * Effective health for scoring and display. accessStatus gubbed/closed wins
 * (you cannot place there), then the manual cooling flag, else healthy.
 */
export function effectiveBookmakerHealth(account: HealthSourceAccount): BookmakerHealth {
  const access = normalizeAccessStatus(account.accessStatus);
  if (access === "gubbed" || access === "closed") return "gubbed";
  if (account.health === "cooling") return "cooling";
  return "healthy";
}

export function bookmakerHealthLabel(health: BookmakerHealth): string {
  if (health === "gubbed") return "Gubbed";
  if (health === "cooling") return "Cooling";
  return "Healthy";
}

function normName(name: string): string {
  return name.trim().toLowerCase();
}

/** Normalised bookie name → effective health, for advantage scoring. */
export function bookmakerHealthMap(
  accounts: Array<HealthSourceAccount & { name: string; type: string; isActive?: number | null }>
): Map<string, BookmakerHealth> {
  const map = new Map<string, BookmakerHealth>();
  for (const a of accounts) {
    if (a.type !== "bookie") continue;
    map.set(normName(a.name), effectiveBookmakerHealth(a));
  }
  return map;
}

export interface BookmakerStatsBet {
  bookmaker: string | null;
  betType: string;
  status: string;
  backStake: number;
  actualProfit: number | null;
  settledAt: number | null;
  /** J5: 'mug' = camouflage bet */
  purpose?: string | null;
}

export interface BookmakerStatsOffer {
  bookmaker: string | null;
  createdAt: number;
}

export interface BookmakerStatsAccount extends HealthSourceAccount {
  id: number;
  name: string;
  type: string;
  isActive?: number | null;
  healthUpdatedAt?: number | null;
}

export interface BookmakerLeagueRow {
  accountId: number;
  name: string;
  health: BookmakerHealth;
  /** Sum of actualProfit across settled, non-void bets */
  profit: number;
  /** Total back stake across those bets */
  staked: number;
  /** profit ÷ staked; null when nothing staked */
  roi: number | null;
  /** Net £ from settled mug bets this calendar month (usually negative) */
  mugNetMonth: number;
  settledBets: number;
  /** Free-bet conversion retention (retained ÷ face); null when no conversions */
  retention: { rate: number; sampleSize: number } | null;
  offerCount: number;
  lastOfferAt: number | null;
  daysSinceLastOffer: number | null;
  /** Healthy bookie with an offer drought > DROUGHT_NUDGE_DAYS */
  droughtNudge: boolean;
}

/**
 * League rows for active bookie accounts, best realised profit first.
 * Bets/offers whose bookmaker matches no account are ignored - health lives
 * on accounts, so accounts drive the table.
 */
export function computeBookmakerStats(input: {
  accounts: BookmakerStatsAccount[];
  bets: BookmakerStatsBet[];
  offers: BookmakerStatsOffer[];
  now?: number;
  /** E1 tuning override; defaults to DROUGHT_NUDGE_DAYS */
  droughtNudgeDays?: number;
}): BookmakerLeagueRow[] {
  const now = input.now ?? Date.now();
  const droughtDays = input.droughtNudgeDays ?? DROUGHT_NUDGE_DAYS;
  const bookies = input.accounts.filter(
    (a) => a.type === "bookie" && (a.isActive ?? 1) !== 0
  );

  const betsByBookie = new Map<string, BookmakerStatsBet[]>();
  for (const b of input.bets) {
    if (!b.bookmaker) continue;
    const key = normName(b.bookmaker);
    const list = betsByBookie.get(key);
    if (list) list.push(b);
    else betsByBookie.set(key, [b]);
  }

  const lastOfferByBookie = new Map<string, { count: number; last: number }>();
  for (const o of input.offers) {
    if (!o.bookmaker) continue;
    const key = normName(o.bookmaker);
    const entry = lastOfferByBookie.get(key);
    if (entry) {
      entry.count += 1;
      entry.last = Math.max(entry.last, o.createdAt);
    } else {
      lastOfferByBookie.set(key, { count: 1, last: o.createdAt });
    }
  }

  const rows = bookies.map((account): BookmakerLeagueRow => {
    const key = normName(account.name);
    const settled = (betsByBookie.get(key) ?? []).filter(
      (b) => b.settledAt != null && b.status !== "open" && b.status !== "void"
    );

    const profit = roundPence(settled.reduce((s, b) => s + (b.actualProfit ?? 0), 0));
    const staked = roundPence(settled.reduce((s, b) => s + b.backStake, 0));
    // Camouflage cost line (J5): profit/staked above KEEP mug money (real
    // £), this line makes the deliberate spend visible on its own.
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const mugNetMonth = roundPence(
      settled
        .filter((b) => b.purpose === "mug" && (b.settledAt ?? 0) >= monthStart.getTime())
        .reduce((s, b) => s + (b.actualProfit ?? 0), 0)
    );

    const conversions = settled.filter(
      (b) => (b.betType === "free_snr" || b.betType === "free_sr") && b.backStake > 0
    );
    const face = conversions.reduce((s, b) => s + b.backStake, 0);
    const retained = conversions.reduce((s, b) => s + (b.actualProfit ?? 0), 0);
    const retention =
      conversions.length > 0 && face > 0
        ? { rate: roundPence(retained / face), sampleSize: conversions.length }
        : null;

    const offerEntry = lastOfferByBookie.get(key);
    const daysSinceLastOffer = offerEntry
      ? Math.floor((now - offerEntry.last) / DAY_MS)
      : null;
    const health = effectiveBookmakerHealth(account);

    return {
      accountId: account.id,
      name: account.name,
      health,
      profit,
      staked,
      mugNetMonth,
      roi: staked > 0 ? profit / staked : null,
      settledBets: settled.length,
      retention,
      offerCount: offerEntry?.count ?? 0,
      lastOfferAt: offerEntry?.last ?? null,
      daysSinceLastOffer,
      droughtNudge:
        health === "healthy" &&
        daysSinceLastOffer != null &&
        daysSinceLastOffer > droughtDays,
    };
  });

  return rows.sort((a, b) => {
    if (b.profit !== a.profit) return b.profit - a.profit;
    return a.name.localeCompare(b.name);
  });
}
