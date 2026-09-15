/**
 * Early-payout bookie scopes. Users mark which wallets they use, on which
 * sport, and the lead that pays. Football 2UP / 1UP are lead-by-2 / lead-by-1.
 * This is a desk setup, not a live offer feed.
 */

import { sportDisplayLabel } from "@/lib/sports";

export type TwoupBookieOfferKind = "2up" | "1up" | "both";

export type TwoupBookieCatalogEntry = {
  /** Wallet-facing name, matches `bookies.ts` keys where we can. */
  name: string;
  kind: TwoupBookieOfferKind;
};

const CATALOG: readonly TwoupBookieCatalogEntry[] = [
  { name: "bet365", kind: "2up" },
  { name: "Sky Bet", kind: "2up" },
  { name: "Paddy Power", kind: "2up" },
  { name: "William Hill", kind: "2up" },
  { name: "Ladbrokes", kind: "2up" },
  { name: "Coral", kind: "2up" },
  { name: "Betfair Sportsbook", kind: "2up" },
  { name: "Unibet", kind: "2up" },
  { name: "BetVictor", kind: "2up" },
  { name: "888sport", kind: "2up" },
  { name: "BoyleSports", kind: "2up" },
  { name: "Virgin Bet", kind: "2up" },
  { name: "LiveScore Bet", kind: "2up" },
  { name: "Betfred", kind: "2up" },
  { name: "talkSPORT BET", kind: "2up" },
  { name: "BetMGM", kind: "2up" },
  { name: "Betway", kind: "2up" },
  { name: "Midnite", kind: "both" },
  { name: "Betano", kind: "1up" },
  { name: "bwin", kind: "1up" },
  { name: "Pub Casino", kind: "1up" },
];

export const TWOUP_BOOKIE_CATALOG: readonly TwoupBookieCatalogEntry[] = CATALOG;

export const EP_DESK_SPORTS = [
  "football",
  "basketball",
  "baseball",
  "american_football",
  "ice_hockey",
  "tennis",
  "darts",
  "cricket",
  "rugby_union",
  "rugby_league",
  "volleyball",
  "esports",
  "other",
] as const;

export type EpDeskSport = (typeof EP_DESK_SPORTS)[number];

export const BOOKIE_SCOPE_SURFACES = ["early_payout", "racing"] as const;
export type BookieScopeSurface = (typeof BOOKIE_SCOPE_SURFACES)[number];

export function isBookieScopeSurface(value: string): value is BookieScopeSurface {
  return (BOOKIE_SCOPE_SURFACES as readonly string[]).includes(value);
}

export function bookieScopeSurface(value?: string | null): BookieScopeSurface {
  return value === "racing" ? "racing" : "early_payout";
}

export type EpBookieScope = {
  bookie: string;
  surface: BookieScopeSurface;
  sport: EpDeskSport;
  /** Goals, runs, points, or sets that pay. Football 2 = 2UP, 1 = 1UP. */
  leadBy: number;
};

export type BookieScope = EpBookieScope;

export type EpBookieScopeInput = {
  bookie: string;
  sport: EpDeskSport;
  leadBy: number;
  surface?: BookieScopeSurface | string | null;
};

export type EpBookieSetup = {
  scopes: EpBookieScope[];
};

export const BOOKIE_SCOPES_STORAGE_KEY = "edgeways.twoup-bookies.v1";
export const BOOKIE_SCOPES_MIGRATED_KEY = "edgeways.bookie-scopes.migrated.v1";

/** @deprecated Use EpBookieSetup. Kept so existing imports compile. */
export type TwoupBookieSelection = EpBookieSetup;

export function isEpDeskSport(value: string): value is EpDeskSport {
  return (EP_DESK_SPORTS as readonly string[]).includes(value);
}

export function epDeskSportOptions(): { value: EpDeskSport; label: string }[] {
  return EP_DESK_SPORTS.map((sport) => ({
    value: sport,
    label: sportDisplayLabel(sport),
  }));
}

export function normaliseBookieName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function catalogKindForBookie(name: string): TwoupBookieOfferKind | null {
  const key = normaliseBookieName(name);
  if (!key) return null;
  const hit = CATALOG.find((entry) => normaliseBookieName(entry.name) === key);
  if (hit) return hit.kind;
  for (const entry of CATALOG) {
    const catalogKey = normaliseBookieName(entry.name);
    if (catalogKey.startsWith(key) || key.startsWith(catalogKey)) return entry.kind;
  }
  return null;
}

export function catalogAllowsTwoUp(name: string): boolean {
  const kind = catalogKindForBookie(name);
  return kind === "2up" || kind === "both";
}

export function catalogAllowsOneUp(name: string): boolean {
  const kind = catalogKindForBookie(name);
  return kind === "1up" || kind === "both";
}

export function uniqueBookieNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = normaliseBookieName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function clampEpLeadBy(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(99, Math.max(1, Math.round(value)));
}

export function defaultEpLeadBy(sport: EpDeskSport): number {
  if (sport === "football") return 2;
  if (sport === "baseball") return 5;
  return 1;
}

export function epLeadUnit(sport: EpDeskSport): { singular: string; plural: string } {
  switch (sport) {
    case "football":
    case "ice_hockey":
      return { singular: "goal", plural: "goals" };
    case "baseball":
    case "cricket":
      return { singular: "run", plural: "runs" };
    case "tennis":
    case "darts":
    case "volleyball":
      return { singular: "set", plural: "sets" };
    case "esports":
      return { singular: "map", plural: "maps" };
    default:
      return { singular: "point", plural: "points" };
  }
}

export function formatEpRule(sport: EpDeskSport, leadBy: number): string {
  const n = clampEpLeadBy(leadBy);
  if (sport === "football" && n === 2) return "2UP";
  if (sport === "football" && n === 1) return "1UP";
  const unit = epLeadUnit(sport);
  return `${n} ${n === 1 ? unit.singular : unit.plural} ahead`;
}

/** Add bet helper under the Early payout control. */
export function earlyPayoutPaidWhenCopy(sport: EpDeskSport, leadBy: number): string {
  const n = clampEpLeadBy(leadBy);
  if (sport === "football") {
    return n === 1 ? "Paid when 1 goal ahead" : "Paid when 2 goals ahead";
  }
  return `Paid when ${formatEpRule(sport, n)}`;
}

/** Keep a 1UP log distinct when the bookie also has 2UP on Scope. */
export function withExplicitFootballEpLabel(label: string, leadBy: number): string {
  if (clampEpLeadBy(leadBy) !== 1) return label;
  if (/\b1up\b/i.test(label)) return label;
  const trimmed = label.trim();
  return trimmed ? `${trimmed} · 1UP` : "1UP";
}

export function formatEpScopeChip(scope: EpBookieScope): string {
  return `${sportDisplayLabel(scope.sport)} · ${formatEpRule(scope.sport, scope.leadBy)}`;
}

export function sameEpScope(
  a: Pick<EpBookieScope, "bookie" | "sport" | "leadBy"> & {
    surface?: BookieScopeSurface | string | null;
  },
  b: Pick<EpBookieScope, "bookie" | "sport" | "leadBy"> & {
    surface?: BookieScopeSurface | string | null;
  }
): boolean {
  return (
    normaliseBookieName(a.bookie) === normaliseBookieName(b.bookie) &&
    bookieScopeSurface(a.surface) === bookieScopeSurface(b.surface) &&
    a.sport === b.sport &&
    clampEpLeadBy(a.leadBy) === clampEpLeadBy(b.leadBy)
  );
}

function normaliseScope(scope: EpBookieScopeInput): EpBookieScope {
  return {
    bookie: scope.bookie.trim(),
    surface: bookieScopeSurface(scope.surface),
    sport: scope.sport,
    leadBy: clampEpLeadBy(scope.leadBy),
  };
}

export function scopesForBookie(
  setup: EpBookieSetup,
  bookie: string,
  surface: BookieScopeSurface = "early_payout"
): EpBookieScope[] {
  const key = normaliseBookieName(bookie);
  return setup.scopes.filter(
    (scope) =>
      normaliseBookieName(scope.bookie) === key &&
      bookieScopeSurface(scope.surface) === surface
  );
}

/**
 * One sentence per configured surface, e.g. "Pays early for Football, Darts."
 * Empty once a bookie has no scopes left, so a note that was auto-filled
 * clears back out with them. Racing has no live scopes yet, so it never
 * contributes. Provenance (was this note auto-written, and is it therefore
 * safe to overwrite) lives on the account row itself (`notesSource`), not in
 * the text — see `isAutoOrEmptyScopeNote` in `@/lib/accounts/notes-source`.
 */
export function formatBookieScopeNote(setup: EpBookieSetup, bookie: string): string {
  const earlyPayout = scopesForBookie(setup, bookie, "early_payout");
  if (earlyPayout.length === 0) return "";
  const sports = [...new Set(earlyPayout.map((scope) => sportDisplayLabel(scope.sport)))];
  return `Pays early for ${sports.join(", ")}.`;
}

export function hasEpScope(
  setup: EpBookieSetup,
  bookie: string,
  sport: EpDeskSport,
  leadBy: number
): boolean {
  return setup.scopes.some((scope) =>
    sameEpScope(scope, { bookie, sport, leadBy })
  );
}

export function earlyPayoutBookieNames(setup: EpBookieSetup): string[] {
  return uniqueBookieNames(
    setup.scopes
      .filter((scope) => bookieScopeSurface(scope.surface) === "early_payout")
      .map((scope) => scope.bookie)
  );
}

export function footballBooksForLead(setup: EpBookieSetup, leadBy: 1 | 2): string[] {
  return uniqueBookieNames(
    setup.scopes
      .filter(
        (scope) =>
          bookieScopeSurface(scope.surface) === "early_payout" &&
          scope.sport === "football" &&
          clampEpLeadBy(scope.leadBy) === leadBy
      )
      .map((scope) => scope.bookie)
  );
}

export function toEpDeskSport(sport?: string | null): EpDeskSport | null {
  return sport && isEpDeskSport(sport) ? sport : null;
}

/** One scope for a wallet and sport. Football prefers 2UP when both leads are on. */
export function scopeForBookieSport(
  setup: EpBookieSetup,
  bookie: string,
  sport?: string | null
): EpBookieScope | null {
  const epSport = toEpDeskSport(sport);
  if (!epSport) return null;
  const matches = scopesForBookie(setup, bookie).filter((scope) => scope.sport === epSport);
  if (matches.length === 0) return null;
  if (epSport === "football") {
    return matches.find((scope) => clampEpLeadBy(scope.leadBy) === 2) ?? matches[0]!;
  }
  return matches[0]!;
}

export function formatScopedEpRule(
  setup: EpBookieSetup,
  bookie: string | null | undefined,
  sport?: string | null
): string | null {
  if (!bookie?.trim()) return null;
  const scope = scopeForBookieSport(setup, bookie, sport);
  if (!scope) return null;
  return formatEpRule(scope.sport, scope.leadBy);
}

export const EMPTY_TWOUP_BOOKIE_SELECTION: EpBookieSetup = { scopes: [] };
export const EMPTY_EP_BOOKIE_SETUP = EMPTY_TWOUP_BOOKIE_SELECTION;

function scopesFromLegacyLists(twoUp: string[], oneUp: string[]): EpBookieScope[] {
  const scopes: EpBookieScope[] = [];
  for (const bookie of uniqueBookieNames(twoUp)) {
    scopes.push(normaliseScope({ bookie, sport: "football", leadBy: 2 }));
  }
  for (const bookie of uniqueBookieNames(oneUp)) {
    scopes.push(normaliseScope({ bookie, sport: "football", leadBy: 1 }));
  }
  return scopes;
}

export function seedTwoupBookieSelection(
  walletNames: readonly string[]
): EpBookieSetup {
  const twoUp: string[] = [];
  const oneUp: string[] = [];
  for (const name of uniqueBookieNames(walletNames)) {
    if (catalogAllowsTwoUp(name)) twoUp.push(name);
    if (catalogAllowsOneUp(name)) oneUp.push(name);
  }
  return { scopes: scopesFromLegacyLists(twoUp, oneUp) };
}

export function parseTwoupBookieSelection(raw: unknown): EpBookieSetup | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as {
    scopes?: unknown;
    twoUp?: unknown;
    oneUp?: unknown;
  };
  if (Array.isArray(value.scopes)) {
    const scopes: EpBookieScope[] = [];
    for (const entry of value.scopes) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const row = entry as {
        bookie?: unknown;
        sport?: unknown;
        leadBy?: unknown;
        surface?: unknown;
      };
      if (typeof row.bookie !== "string" || !row.bookie.trim()) continue;
      if (typeof row.sport !== "string" || !isEpDeskSport(row.sport)) continue;
      if (typeof row.leadBy !== "number") continue;
      scopes.push(
        normaliseScope({
          bookie: row.bookie,
          sport: row.sport,
          leadBy: row.leadBy,
          surface: typeof row.surface === "string" ? row.surface : "early_payout",
        })
      );
    }
    return { scopes: dedupeScopes(scopes) };
  }
  if (!Array.isArray(value.twoUp) || !Array.isArray(value.oneUp)) return null;
  return {
    scopes: scopesFromLegacyLists(
      value.twoUp.filter((name): name is string => typeof name === "string"),
      value.oneUp.filter((name): name is string => typeof name === "string")
    ),
  };
}

function dedupeScopes(scopes: readonly EpBookieScope[]): EpBookieScope[] {
  const out: EpBookieScope[] = [];
  for (const scope of scopes) {
    const next = normaliseScope(scope);
    if (out.some((entry) => sameEpScope(entry, next))) continue;
    out.push(next);
  }
  return out;
}

/** Settings stores the array. Accepts a raw array or a `{ scopes }` / `{ twoUp, oneUp }` payload. */
export function normalizeBookieScopes(raw: unknown): EpBookieScope[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return parseTwoupBookieSelection({ scopes: raw })?.scopes ?? [];
  }
  return parseTwoupBookieSelection(raw)?.scopes ?? [];
}

export type BookieScopesMigration = {
  scopes: EpBookieScope[];
  shouldPersist: boolean;
  dropLocalStorage: boolean;
  markMigrated: boolean;
};

/**
 * One-shot lift of `edgeways.twoup-bookies.v1` into settings.
 * Empty settings + leftover `{ scopes: [] }` still seeds from wallets when asked.
 */
export function resolveBookieScopesMigration(input: {
  settingsScopes: unknown;
  localStorageRaw: string | null;
  alreadyMigrated: boolean;
  walletNames?: readonly string[];
  allowSeed?: boolean;
}): BookieScopesMigration {
  const settingsScopes = normalizeBookieScopes(input.settingsScopes);
  if (input.alreadyMigrated) {
    return {
      scopes: settingsScopes,
      shouldPersist: false,
      dropLocalStorage: Boolean(input.localStorageRaw),
      markMigrated: true,
    };
  }
  if (settingsScopes.length > 0) {
    return {
      scopes: settingsScopes,
      shouldPersist: false,
      dropLocalStorage: true,
      markMigrated: true,
    };
  }
  if (input.localStorageRaw) {
    try {
      const parsed = parseTwoupBookieSelection(JSON.parse(input.localStorageRaw));
      if (parsed && parsed.scopes.length > 0) {
        return {
          scopes: parsed.scopes,
          shouldPersist: true,
          dropLocalStorage: true,
          markMigrated: true,
        };
      }
    } catch {
      /* seed or wait */
    }
  }
  if (input.allowSeed) {
    return {
      scopes: seedTwoupBookieSelection(input.walletNames ?? []).scopes,
      shouldPersist: true,
      dropLocalStorage: true,
      markMigrated: true,
    };
  }
  return {
    scopes: settingsScopes,
    shouldPersist: false,
    dropLocalStorage: false,
    markMigrated: false,
  };
}

export function addEpScope(setup: EpBookieSetup, scope: EpBookieScopeInput): EpBookieSetup {
  const next = normaliseScope(scope);
  if (!next.bookie) return setup;
  if (setup.scopes.some((entry) => sameEpScope(entry, next))) return setup;
  return { scopes: [...setup.scopes, next] };
}

/** Football can hold 2UP and 1UP. Other sports keep one lead per bookie + surface. */
export function upsertEpScope(setup: EpBookieSetup, scope: EpBookieScopeInput): EpBookieSetup {
  const next = normaliseScope(scope);
  if (!next.bookie) return setup;
  if (next.sport === "football") return addEpScope(setup, next);
  return {
    scopes: [
      ...setup.scopes.filter(
        (entry) =>
          !(
            normaliseBookieName(entry.bookie) === normaliseBookieName(next.bookie) &&
            bookieScopeSurface(entry.surface) === next.surface &&
            entry.sport === next.sport
          )
      ),
      next,
    ],
  };
}

export function removeEpScope(setup: EpBookieSetup, scope: EpBookieScopeInput): EpBookieSetup {
  return {
    scopes: setup.scopes.filter((entry) => !sameEpScope(entry, scope)),
  };
}

export function setEpScopeLead(
  setup: EpBookieSetup,
  scope: EpBookieScopeInput,
  leadBy: number
): EpBookieSetup {
  const nextLead = clampEpLeadBy(leadBy);
  const updated = { ...scope, leadBy: nextLead };
  if (setup.scopes.some((entry) => sameEpScope(entry, updated) && !sameEpScope(entry, scope))) {
    return removeEpScope(setup, scope);
  }
  return {
    scopes: setup.scopes.map((entry) =>
      sameEpScope(entry, scope) ? { ...entry, leadBy: nextLead } : entry
    ),
  };
}

export function toggleBookieKind(
  setup: EpBookieSetup,
  name: string,
  kind: "2up" | "1up",
  on: boolean
): EpBookieSetup {
  const scope: EpBookieScope = {
    bookie: name,
    surface: "early_payout",
    sport: "football",
    leadBy: kind === "2up" ? 2 : 1,
  };
  return on ? addEpScope(setup, scope) : removeEpScope(setup, scope);
}

export function pickPreferredBookie(
  current: string,
  preferred: readonly string[],
  avoid?: string
): string {
  const wallets = uniqueBookieNames(preferred);
  if (wallets.length === 0) return current;
  const cur = normaliseBookieName(current);
  const avoidKey = avoid ? normaliseBookieName(avoid) : "";
  if (
    cur &&
    cur !== avoidKey &&
    wallets.some((name) => normaliseBookieName(name) === cur)
  ) {
    return current;
  }
  return wallets.find((name) => normaliseBookieName(name) !== avoidKey) ?? wallets[0]!;
}
