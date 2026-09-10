/** Last-used Fixtures tape view. Persisted on the desk like pin lists. */

export const FIXTURE_BOARD_STATUS_FILTERS = [
  "all",
  "live",
  "scheduled",
  "picks",
] as const;

export type FixtureBoardStatusFilter = (typeof FIXTURE_BOARD_STATUS_FILTERS)[number];

export type FixtureBoardSportId = "football" | "horse_racing";

export interface FixtureBoardSportView {
  /** `all`, `pins`, `backed`, or a competition / course id. */
  rail: string;
  status: FixtureBoardStatusFilter;
}

export interface FixtureBoardViewSettings {
  sport: FixtureBoardSportId;
  football: FixtureBoardSportView;
  racing: FixtureBoardSportView;
}

export const DEFAULT_FIXTURE_BOARD_SPORT_VIEW: FixtureBoardSportView = {
  rail: "all",
  status: "all",
};

export const DEFAULT_FIXTURE_BOARD_VIEW: FixtureBoardViewSettings = {
  sport: "football",
  football: { ...DEFAULT_FIXTURE_BOARD_SPORT_VIEW },
  racing: { ...DEFAULT_FIXTURE_BOARD_SPORT_VIEW },
};

export function isFixtureBoardStatusFilter(
  value: unknown
): value is FixtureBoardStatusFilter {
  return (
    typeof value === "string" &&
    (FIXTURE_BOARD_STATUS_FILTERS as readonly string[]).includes(value)
  );
}

export function normalizeFixtureBoardRail(value: unknown): string {
  if (typeof value !== "string") return "all";
  const rail = value.trim();
  if (!rail || rail === "favourites") return "all";
  return rail;
}

export function normalizeFixtureBoardSportView(raw?: unknown): FixtureBoardSportView {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<FixtureBoardSportView>)
      : null;
  return {
    rail: normalizeFixtureBoardRail(value?.rail),
    status: isFixtureBoardStatusFilter(value?.status) ? value.status : "all",
  };
}

export function normalizeFixtureBoardView(raw?: unknown): FixtureBoardViewSettings {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<FixtureBoardViewSettings>)
      : null;
  return {
    sport: value?.sport === "horse_racing" ? "horse_racing" : "football",
    football: normalizeFixtureBoardSportView(value?.football),
    racing: normalizeFixtureBoardSportView(value?.racing),
  };
}

export function mergeFixtureBoardView(
  current: FixtureBoardViewSettings,
  patch?: unknown
): FixtureBoardViewSettings {
  if (patch == null) return normalizeFixtureBoardView(current);
  const next =
    patch && typeof patch === "object" && !Array.isArray(patch)
      ? (patch as Partial<FixtureBoardViewSettings>)
      : {};
  return normalizeFixtureBoardView({
    sport: next.sport ?? current.sport,
    football: { ...current.football, ...next.football },
    racing: { ...current.racing, ...next.racing },
  });
}

export function fixtureBoardRail(
  favouritesOnly: boolean,
  scopeFilter: string,
  backedOnly = false
): string {
  if (backedOnly) return "backed";
  if (favouritesOnly) return "pins";
  return normalizeFixtureBoardRail(scopeFilter);
}

export function applyFixtureBoardRail(rail: string): {
  favouritesOnly: boolean;
  backedOnly: boolean;
  scopeFilter: string;
} {
  const normalized = normalizeFixtureBoardRail(rail);
  if (normalized === "pins") {
    return { favouritesOnly: true, backedOnly: false, scopeFilter: "all" };
  }
  if (normalized === "backed") {
    return { favouritesOnly: false, backedOnly: true, scopeFilter: "all" };
  }
  return { favouritesOnly: false, backedOnly: false, scopeFilter: normalized };
}

export function fixtureBoardSportView(
  view: FixtureBoardViewSettings,
  sport: FixtureBoardSportId
): FixtureBoardSportView {
  return sport === "horse_racing" ? view.racing : view.football;
}
