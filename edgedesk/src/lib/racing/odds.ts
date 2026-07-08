/** Parse fractional odds (e.g. "5/1", "11/4") to decimal. */
export function fractionalToDecimal(raw: string | null | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "evs" || s === "evens") return 2;
  const slash = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (slash) {
    const num = parseFloat(slash[1]);
    const den = parseFloat(slash[2]);
    if (den > 0 && num >= 0) return 1 + num / den;
  }
  const dec = parseFloat(s);
  return Number.isFinite(dec) && dec > 1 ? dec : undefined;
}

/** Format decimal odds for display (always 2 dp, e.g. 4.50 or 2.00). */
export function formatDecimalOdds(decimal: number | null | undefined): string {
  if (decimal == null || !Number.isFinite(decimal) || decimal <= 1) return "—";
  return decimal.toFixed(2);
}

export function formatWeightStones(lbs: number | null | undefined): string {
  if (lbs == null || !Number.isFinite(lbs) || lbs <= 0) return "—";
  const stone = Math.floor(lbs / 14);
  const rem = Math.round(lbs % 14);
  return `${stone}-${rem}`;
}

export type OddsSource = "live" | "snapshot" | "proxy" | "unavailable";

const EXCHANGE_NAMES = ["betfair exchange", "betdaq", "matchbook", "smarkets"];
const BOOKIE_NAMES = ["betfair sportsbook", "bet365", "william hill", "coral", "ladbrokes", "paddy power", "sky bet"];

function normName(s: string): string {
  return s.trim().toLowerCase();
}

function pickFromOddsList(
  odds: unknown[],
  prefer: "bookie" | "exchange",
  preferredBookmaker?: string
): number | undefined {
  if (!Array.isArray(odds) || odds.length === 0) return undefined;

  const parsed = odds
    .map((o) => {
      if (!o || typeof o !== "object") return null;
      const row = o as Record<string, unknown>;
      const name = String(row.bookmaker ?? row.bookie ?? row.source ?? row.name ?? "").trim();
      const dec =
        parseFloat(String(row.decimal ?? row.dec ?? row.price_decimal ?? row.win_decimal ?? "")) ||
        fractionalToDecimal(String(row.fraction ?? row.price ?? row.odds ?? "")) ||
        undefined;
      if (!dec || dec <= 1) return null;
      return { name: normName(name), dec };
    })
    .filter((x): x is { name: string; dec: number } => x != null);

  if (parsed.length === 0) return undefined;

  const pref = preferredBookmaker ? normName(preferredBookmaker) : "";

  if (prefer === "exchange") {
    const ex = parsed.find((p) => EXCHANGE_NAMES.some((e) => p.name.includes(e)));
    if (ex) return ex.dec;
    return parsed[0]?.dec;
  }

  if (pref) {
    const hit = parsed.find((p) => p.name.includes(pref) || pref.includes(p.name));
    if (hit) return hit.dec;
  }
  const bookie = parsed.find((p) => BOOKIE_NAMES.some((b) => p.name.includes(b)));
  return (bookie ?? parsed[0])?.dec;
}

/** Estimate win odds from official rating when API odds are unavailable (free plan). */
export function estimateDecimalsFromRatings(
  runners: Array<{ horseId: string; ofr?: string | null; rpr?: string | null }>
): Map<string, number> {
  const rated = runners.map((r) => {
    const ofr = parseInt(String(r.ofr ?? ""), 10);
    const rpr = parseInt(String(r.rpr ?? ""), 10);
    const rating = Number.isFinite(ofr) && ofr > 0 ? ofr : Number.isFinite(rpr) && rpr > 0 ? rpr : 0;
    return { horseId: r.horseId, rating };
  });
  rated.sort((a, b) => b.rating - a.rating);

  const out = new Map<string, number>();
  rated.forEach((r, i) => {
    if (r.rating <= 0) {
      out.set(r.horseId, 12 + i * 4);
      return;
    }
    const dec = 2.2 + i * 1.6 + Math.pow(i, 1.35) * 0.35;
    out.set(r.horseId, Math.round(dec * 100) / 100);
  });
  return out;
}

export interface ResolvedRunnerOdds {
  bookieDecimal?: number;
  exchangeDecimal?: number;
  spreadPct?: number;
  source: OddsSource;
  exchangeSource?: "live" | "estimated" | "api";
}

export function resolveRunnerOdds(input: {
  spDecimal?: number;
  spFraction?: string;
  oddsList?: unknown[];
  snapshotDecimal?: number | null;
  proxyDecimal?: number;
  preferredBookmaker?: string;
  exchangeLayDecimal?: number;
  exchangeFromApi?: boolean;
}): ResolvedRunnerOdds {
  const fromApi =
    input.spDecimal ??
    pickFromOddsList(input.oddsList ?? [], "bookie", input.preferredBookmaker) ??
    fractionalToDecimal(input.spFraction);

  const fromSnapshot =
    input.snapshotDecimal != null && input.snapshotDecimal > 1 ? input.snapshotDecimal : undefined;

  const bookieDecimal = fromApi ?? fromSnapshot ?? input.proxyDecimal;
  if (!bookieDecimal) {
    return { source: "unavailable" };
  }

  let source: OddsSource = "unavailable";
  if (fromApi) source = "live";
  else if (fromSnapshot) source = "snapshot";
  else if (input.proxyDecimal) source = "proxy";

  const exchangeFromList = pickFromOddsList(input.oddsList ?? [], "exchange");
  const exchangeDecimal =
    input.exchangeLayDecimal ??
    exchangeFromList ??
    (bookieDecimal > 1 ? Math.round(bookieDecimal * 1.03 * 100) / 100 : undefined);

  const exchangeSource = input.exchangeLayDecimal
    ? ("live" as const)
    : exchangeFromList
      ? ("api" as const)
      : exchangeDecimal
        ? ("estimated" as const)
        : undefined;

  const spreadPct =
    exchangeDecimal && bookieDecimal
      ? Math.round(((exchangeDecimal - bookieDecimal) / bookieDecimal) * 1000) / 10
      : undefined;

  return {
    bookieDecimal,
    exchangeDecimal,
    spreadPct,
    source,
    exchangeSource,
  };
}
