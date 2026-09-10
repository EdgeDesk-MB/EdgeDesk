import { countryLabelToIso } from "@/lib/geo/region";

export type FootballScopeFixture = {
  competition: string;
  leagueCountry?: string | null;
  leagueFlag?: string | null;
};

/** One current-season competition from the feed catalog (not today's fixtures). */
export type FootballCompetitionCatalogEntry = {
  name: string;
  country?: string | null;
  flag?: string | null;
  /** API-Football league id, when the catalog row was fetched with it. */
  leagueId?: number | null;
  /** Current season year for standings lookups. */
  season?: number | null;
};

export type FootballLeagueGroup<T extends FootballScopeFixture> = {
  id: string;
  competition: string;
  /** Display name without the country prefix (ordinals already resolved). */
  title: string;
  leagueCountry: string | null;
  leagueFlag?: string | null;
  label: string;
  fixtures: T[];
};

export type ScopeSearchOption = {
  label: string;
  name?: string;
  country?: string | null;
};

/** Stable id for one domestic league: country + name, not the name alone. */
export function footballScopeId(
  competition: string,
  leagueCountry?: string | null
): string {
  const name = competition.trim();
  const country = leagueCountry?.trim() ?? "";
  return country ? `${country}::${name}` : name;
}

export function fixtureMatchesFootballScope(
  fixture: FootballScopeFixture,
  scopeId: string
): boolean {
  if (scopeId === "all" || scopeId === "favourites") return true;
  return footballScopeId(fixture.competition, fixture.leagueCountry) === scopeId;
}

const MAX_FAVOURITE_SCOPES = 200;
const MAX_FAVOURITE_SCOPE_ID_LEN = 160;

/** Desk-persisted competition / course ids. Drops reserved filter tokens. */
export function normalizeFavouriteScopeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || id.length > MAX_FAVOURITE_SCOPE_ID_LEN) continue;
    if (id === "all" || id === "favourites") continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_FAVOURITE_SCOPES) break;
  }
  return out;
}

export function toggleFavouriteScopeId(ids: readonly string[], id: string): string[] {
  const next = new Set(normalizeFavouriteScopeIds([...ids]));
  const key = id.trim();
  if (!key || key === "all" || key === "favourites") return [...next];
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return normalizeFavouriteScopeIds([...next]);
}

/** Desk pin order. Drop `sourceId` in front of `targetId`. */
export function moveFavouriteScopeId(
  ids: readonly string[],
  sourceId: string,
  targetId: string
): string[] {
  const next = normalizeFavouriteScopeIds(ids);
  const from = next.indexOf(sourceId.trim());
  const to = next.indexOf(targetId.trim());
  if (from < 0 || to < 0 || from === to) return next;
  const [item] = next.splice(from, 1);
  if (!item) return next;
  next.splice(to, 0, item);
  return next;
}

/** Label a persisted pin when today's card list has not landed yet. */
export function favouriteScopeStub(id: string): {
  id: string;
  label: string;
  name: string;
  country: string | null;
  count: number;
} {
  const sep = id.indexOf("::");
  const country = sep === -1 ? null : id.slice(0, sep);
  const name = sep === -1 ? id : id.slice(sep + 2);
  return {
    id,
    label: footballScopeLabel(name, country),
    name,
    country,
    count: 0,
  };
}

export function orderByFavouriteIds<T extends { id: string }>(
  favouriteIds: readonly string[],
  byId: ReadonlyMap<string, T>,
  stub: (id: string) => T
): T[] {
  return normalizeFavouriteScopeIds(favouriteIds).map(
    (id) => byId.get(id) ?? stub(id)
  );
}

/**
 * Pinned only and a named pin always keep a competition / course header,
 * including when that day has no rows.
 */
export function tapeGroupsWithScopeHeaders<T extends { id: string }>(
  groups: T[],
  options: {
    scopeFilter: string;
    favouritesOnly: boolean;
    favouriteIds: readonly string[];
    stub: (id: string) => T;
  }
): T[] {
  const { scopeFilter, favouritesOnly, favouriteIds, stub } = options;
  if (favouritesOnly) {
    const byId = new Map(groups.map((group) => [group.id, group]));
    return orderByFavouriteIds(favouriteIds, byId, stub);
  }
  if (scopeFilter !== "all") {
    const found = groups.find((group) => group.id === scopeFilter);
    return [found ?? stub(scopeFilter)];
  }
  return groups;
}

export function sortGroupsByFavouriteOrder<T extends { id: string }>(
  groups: T[],
  favouriteIds: readonly string[]
): T[] {
  const rank = new Map(favouriteIds.map((id, index) => [id, index]));
  return [...groups].sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return 0;
  });
}

export function sortFavouriteScopeIdsFirst<T extends { id: string }>(
  items: T[],
  favouriteIds: readonly string[]
): T[] {
  if (favouriteIds.length === 0) return items;
  const rank = new Map(favouriteIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return 0;
  });
}

/** Pinned order first, then today's cards, then the rest of the catalog. */
export function sortFootballScopeMenu<T extends { id: string; count: number; label: string }>(
  items: T[],
  favouriteIds: readonly string[]
): T[] {
  const pinned = new Set(favouriteIds);
  const rank = new Map(favouriteIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aFav = pinned.has(a.id);
    const bFav = pinned.has(b.id);
    if (aFav && bFav) return (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0);
    if (aFav !== bFav) return aFav ? -1 : 1;
    const aToday = a.count > 0 ? 0 : 1;
    const bToday = b.count > 0 ? 0 : 1;
    if (aToday !== bToday) return aToday - bToday;
    return a.label.localeCompare(b.label);
  });
}

export const SCOPE_MENU_PAGE = 48;

/** First page of a long competition / course menu. Pinned ids always stay in. */
export function takeScopeMenuPage<T extends { id: string }>(
  items: T[],
  limit: number,
  alwaysIds: ReadonlySet<string> = new Set()
): { shown: T[]; hidden: number } {
  if (items.length <= limit) return { shown: items, hidden: 0 };
  const shown: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!alwaysIds.has(item.id) || seen.has(item.id)) continue;
    shown.push(item);
    seen.add(item.id);
  }
  for (const item of items) {
    if (seen.has(item.id)) continue;
    if (shown.length >= limit) break;
    shown.push(item);
    seen.add(item.id);
  }
  const order = new Map(items.map((item, index) => [item.id, index]));
  shown.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { shown, hidden: items.length - shown.length };
}

export function partitionHiddenScopeOptions<T extends { id: string }>(
  items: T[],
  hiddenIds: ReadonlySet<string>
): { visible: T[]; hidden: T[] } {
  if (hiddenIds.size === 0) return { visible: items, hidden: [] };
  const visible: T[] = [];
  const hidden: T[] = [];
  for (const item of items) {
    if (hiddenIds.has(item.id)) hidden.push(item);
    else visible.push(item);
  }
  return { visible, hidden };
}

export function isEnglandFootballCountry(country?: string | null): boolean {
  if (!country?.trim()) return false;
  return countryLabelToIso(country) === "ENG";
}

/**
 * Feed titles often start with a tier ordinal ("2. Bundesliga", "1. Liga
 * Classic"). Strip that leading "N." for display only. Keep numbers that
 * are part of the name ("Premier League 2").
 */
export function displayFootballCompetitionName(competition: string): string {
  return competition.trim().replace(/^\d+\.\s+/, "");
}

const WORLD_FOOTBALL_COUNTRIES = new Set([
  "world",
  "worldwide",
  "international",
]);

function isWorldFootballCountry(country: string): boolean {
  return WORLD_FOOTBALL_COUNTRIES.has(country.trim().toLowerCase());
}

/** Country (uppercase) then competition, for tape headers and the filter menu. */
export function footballScopeHeadingParts(
  competition: string,
  leagueCountry: string | null
): { country: string | null; name: string } {
  const name = competition.trim();
  const country = leagueCountry?.trim() ?? "";
  if (!name) return { country: country ? country.toUpperCase() : null, name: country };
  if (!country || isWorldFootballCountry(country)) {
    return { country: null, name };
  }
  if (name.toLowerCase().includes(country.toLowerCase())) {
    return { country: null, name };
  }
  return { country: country.toUpperCase(), name };
}

/** `ENGLAND - Championship`. World / names that already include the country stay bare. */
export function footballScopeLabel(
  competition: string,
  leagueCountry: string | null,
  _nameIsShared?: boolean
): string {
  const { country, name } = footballScopeHeadingParts(competition, leagueCountry);
  return country ? `${country} - ${name}` : name;
}

function uniqueFootballPeers(fixtures: FootballScopeFixture[]): FootballScopeFixture[] {
  const seen = new Set<string>();
  const out: FootballScopeFixture[] = [];
  for (const fixture of fixtures) {
    const id = footballScopeId(fixture.competition, fixture.leagueCountry);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(fixture);
  }
  return out;
}

/** Strip a leading "N." unless that would collide with another league. */
export function footballCompetitionDisplayTitle(
  competition: string,
  leagueCountry: string | null,
  peers: FootballScopeFixture[]
): string {
  const raw = competition.trim();
  const stripped = displayFootballCompetitionName(raw);
  const countryKey = (leagueCountry ?? "").trim().toLowerCase();
  const strippedKey = stripped.toLowerCase();
  let sameCountry = 0;
  for (const peer of uniqueFootballPeers(peers)) {
    const peerStrip = displayFootballCompetitionName(peer.competition);
    if (peerStrip.toLowerCase() !== strippedKey) continue;
    const peerCountry = (peer.leagueCountry ?? "").trim().toLowerCase();
    if (peerCountry === countryKey) sameCountry += 1;
  }
  return sameCountry > 1 ? raw : stripped;
}

export function groupFootballByLeague<T extends FootballScopeFixture>(
  fixtures: T[],
  labelUniverse: FootballScopeFixture[] = fixtures
): FootballLeagueGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const fixture of fixtures) {
    const id = footballScopeId(fixture.competition, fixture.leagueCountry);
    const list = map.get(id) ?? [];
    list.push(fixture);
    map.set(id, list);
  }
  return [...map.entries()]
    .map(([id, items]) => {
      const competition = items[0]?.competition ?? "";
      const leagueCountry = items[0]?.leagueCountry?.trim() || null;
      const title = footballCompetitionDisplayTitle(
        competition,
        leagueCountry,
        labelUniverse
      );
      return {
        id,
        competition,
        title,
        leagueCountry,
        leagueFlag: items[0]?.leagueFlag,
        label: footballScopeLabel(title, leagueCountry),
        fixtures: items,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function footballCatalogAsFixtures(
  catalog: FootballCompetitionCatalogEntry[]
): FootballScopeFixture[] {
  const seen = new Set<string>();
  const out: FootballScopeFixture[] = [];
  for (const entry of catalog) {
    const competition = entry.name.trim();
    if (!competition) continue;
    const leagueCountry = entry.country?.trim() || null;
    const id = footballScopeId(competition, leagueCountry);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      competition,
      leagueCountry,
      leagueFlag: entry.flag ?? null,
    });
  }
  return out;
}

/**
 * Today's fixtures plus catalog competitions that have no matches yet.
 * Empty groups keep a stable scope id so users can star or hide them.
 */
export function groupFootballScopesWithCatalog<T extends FootballScopeFixture>(
  fixtures: T[],
  catalog: FootballCompetitionCatalogEntry[]
): FootballLeagueGroup<T>[] {
  const catalogPeers = footballCatalogAsFixtures(catalog);
  const labelUniverse = [...catalogPeers, ...fixtures];
  const groups = groupFootballByLeague(fixtures, labelUniverse);
  const seen = new Set(groups.map((group) => group.id));
  const emptyPeers = catalogPeers.filter(
    (peer) => !seen.has(footballScopeId(peer.competition, peer.leagueCountry))
  );
  const emptyGroups = groupFootballByLeague(emptyPeers, labelUniverse).map(
    (group) => ({ ...group, fixtures: [] as T[] })
  );
  return [...groups, ...emptyGroups].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Search prefers an exact competition name. If several countries share that
 * name and a preferred country is in the list, only that country is returned
 * ("premier league" → England, not Hong Kong or Belarus).
 */
export function filterScopeOptions<T extends ScopeSearchOption>(
  options: T[],
  query: string,
  preferCountry?: string | null
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;

  const nameOf = (option: T) => (option.name ?? option.label).trim().toLowerCase();
  const exact = options.filter(
    (option) => option.label.toLowerCase() === q || nameOf(option) === q
  );
  if (exact.length > 0) {
    if (preferCountry && exact.length > 1) {
      const preferred = exact.filter((option) => {
        const want = preferCountry.trim().toLowerCase();
        const country = option.country?.trim().toLowerCase() ?? "";
        if (country === want) return true;
        const wantIso = countryLabelToIso(preferCountry);
        return Boolean(wantIso) && countryLabelToIso(option.country) === wantIso;
      });
      if (preferred.length > 0) return preferred;
    }
    return exact;
  }

  const prefix = options.filter(
    (option) => option.label.toLowerCase().startsWith(q) || nameOf(option).startsWith(q)
  );
  if (prefix.length > 0) return prefix;

  return options.filter(
    (option) => option.label.toLowerCase().includes(q) || nameOf(option).includes(q)
  );
}

/** UK desk first, then the usual top-flight European leagues. Exact names only. */
export const UK_AUDIENCE_FOOTBALL = [
  { country: "England", name: "Premier League" },
  { country: "England", name: "Championship" },
  { country: "Italy", name: "Serie A" },
  { country: "Spain", name: "La Liga" },
  { country: "Germany", name: "Bundesliga" },
  { country: "France", name: "Ligue 1" },
  { country: "Netherlands", name: "Eredivisie" },
] as const;

export function footballAudienceBand(
  competition: string,
  leagueCountry?: string | null
): number {
  const name = competition.trim().toLowerCase();
  const country = (leagueCountry ?? "").trim().toLowerCase();
  const index = UK_AUDIENCE_FOOTBALL.findIndex(
    (row) =>
      row.name.toLowerCase() === name && row.country.toLowerCase() === country
  );
  return index === -1 ? UK_AUDIENCE_FOOTBALL.length : index;
}

export function firstStartTime(items: readonly { startTime: number }[]): number {
  let first = Number.POSITIVE_INFINITY;
  for (const item of items) {
    if (item.startTime < first) first = item.startTime;
  }
  return first;
}

/** Flashscore tape: first kick-off in the competition, then name. */
export function sortGroupsByFirstStart<
  T extends { label?: string; fixtures?: { startTime: number }[]; races?: { startTime: number }[] },
>(groups: T[], nameOf: (group: T) => string): T[] {
  return [...groups].sort((a, b) => {
    const aStart = firstStartTime(a.fixtures ?? a.races ?? []);
    const bStart = firstStartTime(b.fixtures ?? b.races ?? []);
    if (aStart !== bStart) return aStart - bStart;
    return nameOf(a).localeCompare(nameOf(b));
  });
}

/**
 * All-competitions football tape: common UK / European leagues first
 * (still by first kick-off inside that band), then the rest by first kick-off.
 */
export function sortFootballTapeGroups<
  T extends {
    competition: string;
    leagueCountry: string | null;
    fixtures: { startTime: number }[];
    label: string;
  },
>(groups: T[], audienceFirst: boolean): T[] {
  return [...groups].sort((a, b) => {
    if (audienceFirst) {
      const aBand = footballAudienceBand(a.competition, a.leagueCountry);
      const bBand = footballAudienceBand(b.competition, b.leagueCountry);
      if (aBand !== bBand) return aBand - bBand;
    }
    const aStart = firstStartTime(a.fixtures);
    const bStart = firstStartTime(b.fixtures);
    if (aStart !== bStart) return aStart - bStart;
    return a.label.localeCompare(b.label);
  });
}

export function countFixtureStatuses(
  items: readonly { status: "upcoming" | "live" | "finished" }[]
): { live: number; scheduled: number; finished: number } {
  let live = 0;
  let scheduled = 0;
  let finished = 0;
  for (const item of items) {
    if (item.status === "live") live += 1;
    else if (item.status === "upcoming") scheduled += 1;
    else finished += 1;
  }
  return { live, scheduled, finished };
}

/** Collapsed competition / course header. Live is named; the rest is a count. */
export function collapsedScopeCountCopy(counts: {
  live: number;
  scheduled: number;
  finished: number;
}): { live: string | null; rest: string | null; aria: string } {
  const { live, scheduled, finished } = counts;
  const other = scheduled + finished;
  const aria = [
    live > 0 ? `${live} live` : null,
    scheduled > 0 ? `${scheduled} scheduled` : null,
    finished > 0 ? `${finished} finished` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    live: live > 0 ? `${live} Live` : null,
    rest: other > 0 ? String(other) : null,
    aria,
  };
}
