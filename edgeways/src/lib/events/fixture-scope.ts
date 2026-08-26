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
  if (scopeId === "all") return true;
  return footballScopeId(fixture.competition, fixture.leagueCountry) === scopeId;
}

export function isEnglandFootballCountry(country?: string | null): boolean {
  if (!country?.trim()) return false;
  return countryLabelToIso(country) === "ENG";
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
  const shared = sharedCompetitionNames(labelUniverse);
  return [...map.entries()]
    .map(([id, items]) => {
      const competition = items[0]?.competition ?? "";
      const leagueCountry = items[0]?.leagueCountry?.trim() || null;
      return {
        id,
        competition,
        leagueCountry,
        leagueFlag: items[0]?.leagueFlag,
        label: footballScopeLabel(
          competition,
          leagueCountry,
          shared.has(competition.trim())
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
