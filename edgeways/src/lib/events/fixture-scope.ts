import { countryLabelToIso } from "@/lib/geo/region";

export type FootballScopeFixture = {
  competition: string;
  leagueCountry?: string | null;
  leagueFlag?: string | null;
};

export type FootballLeagueGroup<T extends FootballScopeFixture> = {
  id: string;
  competition: string;
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

export function sortFavouriteScopeIdsFirst<T extends { id: string }>(
  items: T[],
  favouriteIds: ReadonlySet<string>
): T[] {
  if (favouriteIds.size === 0) return items;
  return [...items].sort((a, b) => {
    const aFav = favouriteIds.has(a.id) ? 0 : 1;
    const bFav = favouriteIds.has(b.id) ? 0 : 1;
    return aFav - bFav;
  });
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

/** Bare name for England (and unique names). Shared names get a country suffix. */
export function footballScopeLabel(
  competition: string,
  leagueCountry: string | null,
  nameIsShared: boolean
): string {
  const name = competition.trim();
  if (!nameIsShared || !leagueCountry?.trim()) return name;
  if (isEnglandFootballCountry(leagueCountry)) return name;
  return `${name} (${leagueCountry.trim()})`;
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

function sharedCompetitionNames(fixtures: FootballScopeFixture[]): Set<string> {
  const countriesByName = new Map<string, Set<string>>();
  for (const fixture of fixtures) {
    const name = fixture.competition.trim();
    const country = (fixture.leagueCountry ?? "").trim().toLowerCase();
    const set = countriesByName.get(name) ?? new Set();
    set.add(country);
    countriesByName.set(name, set);
  }
  return new Set(
    [...countriesByName.entries()]
      .filter(([, countries]) => countries.size > 1)
      .map(([name]) => name)
  );
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
  const sharedRaw = sharedCompetitionNames(labelUniverse);
  const displayShared = sharedCompetitionNames(
    uniqueFootballPeers(labelUniverse).map((fixture) => ({
      competition: footballCompetitionDisplayTitle(
        fixture.competition,
        fixture.leagueCountry ?? null,
        labelUniverse
      ),
      leagueCountry: fixture.leagueCountry,
    }))
  );
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
        leagueCountry,
        leagueFlag: items[0]?.leagueFlag,
        label: footballScopeLabel(
          title,
          leagueCountry,
          sharedRaw.has(competition.trim()) || displayShared.has(title)
        ),
        fixtures: items,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
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
