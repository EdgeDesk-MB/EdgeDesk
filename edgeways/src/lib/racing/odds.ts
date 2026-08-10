/** SP favourite tag as printed beside a price (F / Fav / JFav). */
export type SpFavouriteMarker = "F" | "Fav" | "JFav";

/**
 * Split an SP label into the price part and an optional favourite marker.
 * Handles spaced tags ("6/4 Fav", "11/4 F", "5/2 JFav") and Racing API
 * glued joint-fav suffixes ("100/30J", "5/2F", "100/30JF").
 */
export function splitSpLabel(raw: string | null | undefined): {
  oddsPart: string;
  marker: SpFavouriteMarker | null;
} {
  if (!raw?.trim()) return { oddsPart: "", marker: null };
  const s = raw.trim();
  // Longest tags first so "JFav" / "JF" are not read as trailing "F" / "J".
  // Separator is optional: The Racing API often emits "100/30J" with no space.
  const m = s.match(/^(.*?)(?:\s+|-)?(JFav|Fav|JF|F|J)\s*$/i);
  if (!m || !m[1]?.trim()) return { oddsPart: s, marker: null };
  const tag = m[2].toUpperCase();
  const marker: SpFavouriteMarker =
    tag === "JFAV" || tag === "JF" || tag === "J" ? "JFav" : tag === "FAV" ? "Fav" : "F";
  return { oddsPart: m[1].trim(), marker };
}

/** Parse fractional odds (e.g. "5/1", "11/4", "100/30J") to decimal. */
export function fractionalToDecimal(raw: string | null | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  // Strip trailing Fav / J / F before parsing so "100/30J" is not parseFloat'd as 100.
  const s = splitSpLabel(raw).oddsPart.trim().toLowerCase();
  if (!s) return undefined;
  if (s === "evs" || s === "evens") return 2;
  const slash = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (slash) {
    const num = parseFloat(slash[1]);
    const den = parseFloat(slash[2]);
    if (den > 0 && num >= 0) return 1 + num / den;
  }
  // Failed fraction (e.g. junk after the slash) must not fall through to parseFloat,
  // which would turn "100/30x" into 100.
  if (s.includes("/")) return undefined;
  const dec = parseFloat(s);
  return Number.isFinite(dec) && dec > 1 ? dec : undefined;
}

/** Format decimal odds for display (always 2 dp, e.g. 4.50 or 2.00). */
export function formatDecimalOdds(decimal: number | null | undefined): string {
  if (decimal == null || !Number.isFinite(decimal) || decimal <= 1) return "-";
  return decimal.toFixed(2);
}

/** True when the SP string or explicit flag marks this runner as (joint) favourite. */
export function spLabelMarksFavourite(
  spFraction?: string | null,
  isSpFavourite?: boolean
): boolean {
  if (isSpFavourite) return true;
  return splitSpLabel(spFraction).marker != null;
}

/**
 * Format SP for the result grid. When `decimal` is true, convert the fractional
 * price and keep any F / Fav / JFav marker intact.
 */
export function formatSpOddsDisplay(
  input: {
    spFraction?: string | null;
    spDecimal?: number | null;
    isSpFavourite?: boolean;
  },
  options: { decimal: boolean }
): string {
  const { oddsPart, marker } = splitSpLabel(input.spFraction);
  const favMarker = marker ?? (input.isSpFavourite ? "F" : null);

  let price: string;
  if (options.decimal) {
    const dec =
      fractionalToDecimal(oddsPart) ??
      (input.spDecimal != null && input.spDecimal > 1 ? input.spDecimal : undefined);
    price = formatDecimalOdds(dec);
  } else if (oddsPart) {
    price = oddsPart;
  } else if (input.spDecimal != null && input.spDecimal > 1) {
    price = formatDecimalOdds(input.spDecimal);
  } else {
    price = "-";
  }

  if (price === "-") return favMarker ?? "-";
  return favMarker ? `${price} ${favMarker}` : price;
}

export function formatWeightStones(lbs: number | null | undefined): string {
  if (lbs == null || !Number.isFinite(lbs) || lbs <= 0) return "-";
  const stone = Math.floor(lbs / 14);
  const rem = Math.round(lbs % 14);
  return `${stone}-${rem}`;
}

export type OddsSource = "live" | "snapshot" | "proxy" | "manual" | "unavailable";

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

/** Minimal runner shape for favourite-first (odds-order) sorting. */
export type OddsSortableRunner = {
  name: string;
  nonRunner?: boolean;
  exchangeDecimal?: number | null;
  bookieDecimal?: number | null;
  spDecimal?: number | null;
  spFraction?: string | null;
  oddsList?: unknown[];
};

/**
 * Price used for Racing Desk ordering: live exchange lay, then bookie, then SP.
 * Unpriced / non-runners sort last (Infinity).
 */
export function runnerOddsSortPrice(runner: OddsSortableRunner): number {
  if (runner.nonRunner) return Infinity;
  const resolved = resolveRunnerOdds({
    spDecimal: runner.spDecimal ?? undefined,
    spFraction: runner.spFraction ?? undefined,
    oddsList: runner.oddsList,
  });
  const price =
    runner.exchangeDecimal ??
    runner.bookieDecimal ??
    resolved.exchangeDecimal ??
    resolved.bookieDecimal ??
    runner.spDecimal;
  return price != null && Number.isFinite(price) && price > 1 ? price : Infinity;
}

/**
 * Sort runners favourite-first (ascending decimal), non-runners last.
 * Matches the Racing Desk racecard grid order.
 */
export function sortRunnersByOddsPrice<T extends OddsSortableRunner>(runners: T[]): T[] {
  return [...runners].sort((a, b) => {
    if (!!a.nonRunner !== !!b.nonRunner) return a.nonRunner ? 1 : -1;
    // Equal / missing prices keep input order (stable sort), matching Racing Desk.
    return runnerOddsSortPrice(a) - runnerOddsSortPrice(b);
  });
}

/** Odds-ordered runner names (active runners only when `nonRunner` is set). */
export function sortRunnerNamesByOdds(runners: OddsSortableRunner[]): string[] {
  return sortRunnersByOddsPrice(runners)
    .filter((r) => !r.nonRunner && r.name.trim())
    .map((r) => r.name.trim());
}
