"use client";

import Link from "next/link";
import { useNow } from "@/hooks/use-now";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { FavouriteStar } from "@/components/events/favourite-star";
import { HideScopeButton } from "@/components/events/hide-scope-button";
import { FixtureScopeFilter } from "@/components/events/fixture-scope-filter";
import { api, useAppState } from "@/hooks/use-app-state";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ListDaySection } from "@/components/layout/list-day-section";
import type { Fixture, RacingFixture } from "@/components/events/types";
import { RegionFlag, GlobalFlag } from "@/components/region-flag";
import { SportIcon } from "@/components/sport-icon";
import { TeamCrest } from "@/components/team-crest";
import { isWorldCupCompetition } from "@/lib/accounts/access";
import { groupByDisplayDay } from "@/lib/events/fixture-day-groups";
import {
  fixtureMatchesFootballScope,
  footballScopeId,
  groupFootballByLeague,
  sortFavouriteScopeIdsFirst,
  toggleFavouriteScopeId,
} from "@/lib/events/fixture-scope";
import { competitionFlagIso } from "@/lib/geo/competition";
import { toIsoCountryCode, racingRegionLabel } from "@/lib/geo/region";
import { sortFixturesByKickoff } from "@/lib/events";
import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/display-timezone";
import { formatClockTime } from "@/lib/time-format";
import {
  captionHeading,
  deskInsetX,
  favouriteStarIconOnBrandPlate,
  filterPillCountState,
  filterPillGroup,
  listDaySectionContentNested,
  listRow,
  listRowGroup,
  sectionBar,
  sectionTitle,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { CalendarDays, Flame, ChevronDown, NotebookPen, Plus, Star } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";

export type FixtureStatusFilter = "all" | "live" | "scheduled";

function matchesStatusFilter(
  status: "upcoming" | "live" | "finished",
  filter: FixtureStatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "live") return status === "live";
  return status === "upcoming";
}

function fixtureBoardEmptyCopy(
  sport: "football" | "horse_racing",
  statusFilter: FixtureStatusFilter,
  emptyTitle: string,
  emptyDescription: string,
  loadFailed?: boolean,
  scopeLabel?: string | null,
  favouritesOnly?: boolean,
  hasFavouritePins?: boolean,
  hasHiddenPins?: boolean,
) {
  if (loadFailed) return { title: emptyTitle, description: emptyDescription };
  if (favouritesOnly && !hasFavouritePins) {
    return {
      title:
        sport === "horse_racing" ? "No saved courses" : "No saved competitions",
      description:
        sport === "horse_racing"
          ? "Star a course to pin it here. Saved courses stay on this desk."
          : "Star a competition to pin it here. Saved competitions stay on this desk.",
    };
  }
  if (hasHiddenPins && !scopeLabel && !favouritesOnly && statusFilter === "all") {
    return {
      title:
        sport === "horse_racing" ? "No courses to show" : "No competitions to show",
      description:
        sport === "horse_racing"
          ? "Hidden courses are under Hidden in All courses."
          : "Hidden competitions are under Hidden in All competitions.",
    };
  }
  const scoped =
    scopeLabel
      ? sport === "horse_racing"
        ? ` at ${scopeLabel}`
        : ` in ${scopeLabel}`
      : favouritesOnly
        ? sport === "horse_racing"
          ? " in Saved"
          : " in Saved"
        : "";
  const clearHint =
    scopeLabel || favouritesOnly
      ? "Nothing matches this filter. Show all, or try another status."
      : null;
  if (statusFilter === "live") {
    return {
      title: sport === "horse_racing" ? `No live races${scoped}` : `No live fixtures${scoped}`,
      description: clearHint ?? "Nothing is live in this feed right now. Try All or Scheduled.",
    };
  }
  if (statusFilter === "scheduled") {
    return {
      title:
        sport === "horse_racing"
          ? `No scheduled races${scoped}`
          : `No scheduled fixtures${scoped}`,
      description: clearHint ?? "Nothing upcoming in this feed. Try All or Live.",
    };
  }
  if (scopeLabel) {
    return {
      title:
        sport === "horse_racing"
          ? `No races at ${scopeLabel}`
          : `No fixtures in ${scopeLabel}`,
      description: "Nothing matches this filter. Show all, or try another status.",
    };
  }
  return { title: emptyTitle, description: emptyDescription };
}

function fixtureDayHeadingId(scope: string, dayKey: string) {
  const slug = scope
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `fixture-day-${slug}-${dayKey}`;
}


function groupRacesByCourse(races: RacingFixture[]) {
  const map = new Map<string, RacingFixture[]>();
  for (const race of races) {
    const list = map.get(race.course) ?? [];
    list.push(race);
    map.set(race.course, list);
  }
  return [...map.entries()]
    .map(([course, items]) => ({
      course,
      region: items[0]?.region,
      races: sortFixturesByKickoff(items),
    }))
    .sort((a, b) => a.course.localeCompare(b.course));
}

function FixtureActions({
  isTracked,
  onTrack,
  onTrackAndBet,
  onEpDesk,
  showEpDesk,
}: {
  isTracked: boolean;
  onTrack: () => void;
  onTrackAndBet: () => void;
  onEpDesk?: () => void;
  showEpDesk?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {showEpDesk && onEpDesk ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Analyse 2UP dutch in 2UP Desk"
              onClick={onEpDesk}
            >
              <Flame className="size-4 text-amber-600 dark:text-amber-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" sideOffset={6}>
            2UP Desk - dutch EV
          </TooltipContent>
        </Tooltip>
      ) : null}
      {isTracked ? (
        <>
          <Link
            href="/tracked-events"
            className="mr-1 text-xs font-medium text-muted-foreground hover:text-primary-text"
          >
            Tracked
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Add bet on this event"
                onClick={onTrackAndBet}
              >
                <NotebookPen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>Add bet</TooltipContent>
          </Tooltip>
        </>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Track and add bet"
                onClick={onTrackAndBet}
              >
                <NotebookPen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>Track &amp; add bet</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Add to Tracked Events"
                onClick={onTrack}
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>Track only</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}

const sectionHeaderBar = cn(sectionBar, "bg-page dark:bg-selection-subtle/80");
const sectionBody = "bg-selection-subtle dark:bg-transparent";

function CollapsibleSectionHeader({
  open,
  onToggle,
  leading,
  trailing,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        sectionHeaderBar,
        "flex w-full items-center gap-0.5 transition-colors hover:bg-muted dark:hover:bg-selection-subtle"
      )}
    >
      {leading}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="min-w-0 flex-1 cursor-pointer py-0 text-left"
      >
        <div className="min-w-0">{children}</div>
      </button>
      {trailing}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Collapse section" : "Expand section"}
        className="flex shrink-0 cursor-pointer items-center py-0"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}

function CompetitionHeaderIcon({
  competition,
  leagueFlag,
  leagueCountry,
  size = "md",
}: {
  competition: string;
  leagueFlag?: string | null;
  leagueCountry?: string | null;
  size?: "sm" | "md";
}) {
  if (isWorldCupCompetition(competition)) {
    return <GlobalFlag size={size} title="FIFA World Cup" />;
  }

  const iso = competitionFlagIso(competition, leagueCountry);
  if (iso) {
    return (
      <RegionFlag
        code={iso}
        size={size}
        hideIfUnknown={false}
        title={leagueCountry ?? competition}
      />
    );
  }

  if (leagueFlag) {
    return <TeamCrest src={leagueFlag} alt={leagueCountry ?? competition} size={size} />;
  }

  return null;
}

function FootballCompetitionSection({
  scopeId,
  competition,
  label,
  leagueFlag,
  leagueCountry,
  fixtures,
  trackedExternalIds,
  onTrack,
  onTrackAndBet,
  onEpDesk,
  displayTimezone,
  favourite,
  onToggleFavourite,
  hidden,
  onToggleHidden,
}: {
  scopeId: string;
  competition: string;
  label: string;
  leagueFlag?: string | null;
  leagueCountry?: string | null;
  fixtures: Fixture[];
  trackedExternalIds: Set<string>;
  onTrack: (fixture: Fixture) => void;
  onTrackAndBet: (fixture: Fixture) => void;
  onEpDesk: (fixture: Fixture) => void;
  displayTimezone: string;
  favourite: boolean;
  onToggleFavourite: () => void;
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const [open, setOpen] = useState(true);
  const now = useNow(30_000);
  const dayGroups = groupByDisplayDay(fixtures, now, displayTimezone);

  return (
    <div className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/40 dark:ring-0">
      <CollapsibleSectionHeader
        open={open}
        onToggle={() => setOpen((v) => !v)}
        leading={
          <FavouriteStar favourite={favourite} label={label} onToggle={onToggleFavourite} />
        }
        trailing={
          hidden || !favourite ? (
            <HideScopeButton hidden={hidden} label={label} onToggle={onToggleHidden} />
          ) : null
        }
      >
        <p className={cn(sectionTitle, "flex items-center gap-1.5")}>
          <CompetitionHeaderIcon
            competition={competition}
            leagueFlag={leagueFlag}
            leagueCountry={leagueCountry}
          />
          <span className="min-w-0 truncate">{label}</span>
        </p>
      </CollapsibleSectionHeader>
      {open ? (
        <div className={cn(sectionBody, "pb-6")}>
          {dayGroups.map((day) => {
            const headingId = fixtureDayHeadingId(scopeId, day.dayKey);
            return (
            <ListDaySection
              key={day.dayKey}
              label={day.label}
              headingId={headingId}
              className="pt-2"
              headerClassName={deskInsetX}
              contentClassName={listDaySectionContentNested}
            >
              <ul aria-labelledby={headingId} className={listRowGroup}>
                {day.items.map((fixture) => {
                  const isTracked = trackedExternalIds.has(fixture.externalId);
                  const live = fixture.status === "live";
                  return (
                    <li
                      key={fixture.externalId}
                      className={cn(
                        listRow,
                        deskInsetX,
                        "flex items-center gap-3 py-2.5",
                        live && "bg-success/5"
                      )}
                    >
                      <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                        {formatClockTime(fixture.startTime, { timeZone: displayTimezone })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <TeamCrest src={fixture.homeLogo} alt={fixture.homeTeam} />
                            {fixture.homeTeam}
                          </span>
                          <span className="text-muted-foreground">–</span>
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <TeamCrest src={fixture.awayLogo} alt={fixture.awayTeam} />
                            {fixture.awayTeam}
                          </span>
                          {live ? (
                            <Badge variant="active" className="tabular-nums">
                              {fixture.homeScore}–{fixture.awayScore}
                              {fixture.minute > 0 ? ` · ${fixture.minute}'` : ""}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <FixtureActions
                          isTracked={isTracked}
                          onTrack={() => onTrack(fixture)}
                          onTrackAndBet={() => onTrackAndBet(fixture)}
                          onEpDesk={() => onEpDesk(fixture)}
                          showEpDesk
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ListDaySection>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function RacingCourseSection({
  course,
  region,
  races,
  trackedExternalIds,
  onTrack,
  onTrackAndBet,
  displayTimezone,
  favourite,
  onToggleFavourite,
  hidden,
  onToggleHidden,
}: {
  course: string;
  region?: string;
  races: RacingFixture[];
  trackedExternalIds: Set<string>;
  onTrack: (race: RacingFixture) => void;
  onTrackAndBet: (race: RacingFixture) => void;
  displayTimezone: string;
  favourite: boolean;
  onToggleFavourite: () => void;
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const [open, setOpen] = useState(true);
  const now = useNow(30_000);
  const dayGroups = groupByDisplayDay(races, now, displayTimezone);

  if (races.length === 0) return null;
  const hasRegionFlag = Boolean(toIsoCountryCode(region));

  return (
    <div className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/40 dark:ring-0">
      <CollapsibleSectionHeader
        open={open}
        onToggle={() => setOpen((v) => !v)}
        leading={
          <FavouriteStar favourite={favourite} label={course} onToggle={onToggleFavourite} />
        }
        trailing={
          hidden || !favourite ? (
            <HideScopeButton hidden={hidden} label={course} onToggle={onToggleHidden} />
          ) : null
        }
      >
        <p className={cn(captionHeading, "flex items-center gap-1.5 text-foreground")}>
          {hasRegionFlag ? (
            <RegionFlag code={region} size="md" />
          ) : (
            <SportIcon sport="horse_racing" size={16} className="text-muted-foreground" />
          )}
          <span className="min-w-0 truncate">
            {racingRegionLabel(region).toUpperCase()}: {course.toUpperCase()}
          </span>
        </p>
      </CollapsibleSectionHeader>

      {open ? (
        <div className={cn(sectionBody, "pb-6")}>
          {dayGroups.map((day) => {
            const headingId = fixtureDayHeadingId(course, day.dayKey);
            return (
            <ListDaySection
              key={day.dayKey}
              label={day.label}
              headingId={headingId}
              className="pt-2"
              headerClassName={deskInsetX}
              contentClassName={listDaySectionContentNested}
            >
              <ul aria-labelledby={headingId} className={listRowGroup}>
                {day.items.map((race) => {
                  const raceTracked = trackedExternalIds.has(race.externalId);
                  const raceLive = race.status === "live";
                  return (
                    <li
                      key={race.externalId}
                      className={cn(
                        listRow,
                        deskInsetX,
                        "flex items-center gap-3 py-2.5",
                        raceLive && "bg-success/5"
                      )}
                    >
                      <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                        {formatClockTime(race.startTime, { timeZone: displayTimezone })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{race.raceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {race.fieldSize} runners
                          {raceLive ? (
                            <Badge variant="active" className="ml-2">Off</Badge>
                          ) : (
                            <Badge variant="outline" className="ml-2">
                              Upcoming
                            </Badge>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <FixtureActions
                          isTracked={raceTracked}
                          onTrack={() => onTrack(race)}
                          onTrackAndBet={() => onTrackAndBet(race)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ListDaySection>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function DeskFixtureBoard({
  sport,
  football,
  racing,
  trackedExternalIds,
  onTrackFixture,
  onTrackAndBetFixture,
  onEpDesk,
  onTrackRace,
  onTrackAndBetRace,
  emptyTitle,
  emptyDescription,
  loading = false,
  loadFailed = false,
  displayTimezone = DEFAULT_DISPLAY_TIMEZONE,
  emptyCompact = true,
}: {
  sport: "football" | "horse_racing";
  football: Fixture[];
  racing: RacingFixture[];
  trackedExternalIds: Set<string>;
  onTrackFixture: (fixture: Fixture) => void;
  onTrackAndBetFixture: (fixture: Fixture) => void;
  onEpDesk: (fixture: Fixture) => void;
  onTrackRace: (race: RacingFixture) => void;
  onTrackAndBetRace: (race: RacingFixture) => void;
  emptyTitle: string;
  emptyDescription: string;
  loading?: boolean;
  loadFailed?: boolean;
  displayTimezone?: string;
  emptyCompact?: boolean;
}) {
  const { state, applyLocalSettingsPatch } = useAppState();
  const [statusFilter, setStatusFilter] = useState<FixtureStatusFilter>("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const settingsFavouriteIds =
    sport === "football"
      ? state?.settings.favouriteFootballScopes ?? []
      : state?.settings.favouriteRacingCourses ?? [];
  const settingsHiddenIds =
    sport === "football"
      ? state?.settings.hiddenFootballScopes ?? []
      : state?.settings.hiddenRacingCourses ?? [];
  const [favouriteIds, setFavouriteIds] = useState<string[]>(settingsFavouriteIds);
  const [hiddenIds, setHiddenIds] = useState<string[]>(settingsHiddenIds);

  const [prevSport, setPrevSport] = useState(sport);
  if (prevSport !== sport) {
    setPrevSport(sport);
    setScopeFilter("all");
  }

  const settingsFavouriteKey = settingsFavouriteIds.join("\0");
  const settingsHiddenKey = settingsHiddenIds.join("\0");
  useEffect(() => {
    setFavouriteIds(settingsFavouriteKey ? settingsFavouriteKey.split("\0") : []);
  }, [settingsFavouriteKey]);
  useEffect(() => {
    setHiddenIds(settingsHiddenKey ? settingsHiddenKey.split("\0") : []);
  }, [settingsHiddenKey]);

  const favouriteSet = useMemo(() => new Set(favouriteIds), [favouriteIds]);
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  async function persistFavourites(next: string[]) {
    const previous = favouriteIds;
    setFavouriteIds(next);
    const json =
      sport === "football"
        ? { favouriteFootballScopes: next }
        : { favouriteRacingCourses: next };
    applyLocalSettingsPatch(json);
    try {
      await api("/api/settings", { method: "PATCH", json });
    } catch (error) {
      setFavouriteIds(previous);
      applyLocalSettingsPatch(
        sport === "football"
          ? { favouriteFootballScopes: previous }
          : { favouriteRacingCourses: previous }
      );
      const message = error instanceof Error ? error.message : "";
      if (message.includes("look at the desk")) return;
      toast.error(
        sport === "football"
          ? "Could not update saved competitions"
          : "Could not update saved courses"
      );
    }
  }

  function toggleFavourite(id: string) {
    void persistFavourites(toggleFavouriteScopeId(favouriteIds, id));
  }

  async function persistHidden(next: string[]) {
    const previous = hiddenIds;
    setHiddenIds(next);
    const json =
      sport === "football"
        ? { hiddenFootballScopes: next }
        : { hiddenRacingCourses: next };
    applyLocalSettingsPatch(json);
    try {
      await api("/api/settings", { method: "PATCH", json });
    } catch (error) {
      setHiddenIds(previous);
      applyLocalSettingsPatch(
        sport === "football"
          ? { hiddenFootballScopes: previous }
          : { hiddenRacingCourses: previous }
      );
      const message = error instanceof Error ? error.message : "";
      if (message.includes("look at the desk")) return;
      toast.error(
        sport === "football"
          ? "Could not update hidden competitions"
          : "Could not update hidden courses"
      );
    }
  }

  function toggleHidden(id: string) {
    const next = toggleFavouriteScopeId(hiddenIds, id);
    if (scopeFilter === id && next.includes(id)) setScopeFilter("all");
    void persistHidden(next);
  }

  function changeScope(id: string) {
    setScopeFilter(id);
  }

  const filteredFootball = useMemo(
    () => football.filter((f) => matchesStatusFilter(f.status, statusFilter)),
    [football, statusFilter]
  );
  const filteredRacing = useMemo(
    () => racing.filter((r) => matchesStatusFilter(r.status, statusFilter)),
    [racing, statusFilter]
  );

  const footballScopeOptions = useMemo(() => {
    const options = groupFootballByLeague(football)
      .map((group) => ({
        id: group.id,
        label: group.label,
        name: group.competition,
        country: group.leagueCountry,
        count: group.fixtures.filter((f) => matchesStatusFilter(f.status, statusFilter))
          .length,
        icon: (
          <CompetitionHeaderIcon
            competition={group.competition}
            leagueFlag={group.leagueFlag}
            leagueCountry={group.leagueCountry}
            size="sm"
          />
        ),
      }))
      .filter((option) => option.count > 0 || option.id === scopeFilter);
    return sortFavouriteScopeIdsFirst(options, favouriteSet);
  }, [football, statusFilter, scopeFilter, favouriteSet]);
  const racingScopeOptions = useMemo(() => {
    const options = groupRacesByCourse(racing)
      .map((group) => ({
        id: group.course,
        label: group.course,
        name: group.course,
        count: group.races.filter((r) => matchesStatusFilter(r.status, statusFilter)).length,
        icon: toIsoCountryCode(group.region) ? (
          <RegionFlag code={group.region} size="sm" />
        ) : (
          <SportIcon sport="horse_racing" size={14} className="text-muted-foreground" />
        ),
      }))
      .filter((option) => option.count > 0 || option.id === scopeFilter);
    return sortFavouriteScopeIdsFirst(options, favouriteSet);
  }, [racing, statusFilter, scopeFilter, favouriteSet]);
  const scopeOptions = sport === "football" ? footballScopeOptions : racingScopeOptions;

  const scopedFootball = useMemo(() => {
    const scoped =
      scopeFilter === "all"
        ? filteredFootball
        : filteredFootball.filter((f) => fixtureMatchesFootballScope(f, scopeFilter));
    if (!favouritesOnly) {
      if (scopeFilter !== "all") return scoped;
      return scoped.filter(
        (f) => !hiddenSet.has(footballScopeId(f.competition, f.leagueCountry))
      );
    }
    return scoped.filter((f) =>
      favouriteSet.has(footballScopeId(f.competition, f.leagueCountry))
    );
  }, [filteredFootball, scopeFilter, favouritesOnly, favouriteSet, hiddenSet]);
  const scopedRacing = useMemo(() => {
    const scoped =
      scopeFilter === "all"
        ? filteredRacing
        : filteredRacing.filter((r) => r.course === scopeFilter);
    if (!favouritesOnly) {
      if (scopeFilter !== "all") return scoped;
      return scoped.filter((r) => !hiddenSet.has(r.course));
    }
    return scoped.filter((r) => favouriteSet.has(r.course));
  }, [filteredRacing, scopeFilter, favouritesOnly, favouriteSet, hiddenSet]);

  const footballGroups = useMemo(
    () =>
      sortFavouriteScopeIdsFirst(
        groupFootballByLeague(scopedFootball, football).map((group) => ({
          ...group,
          fixtures: sortFixturesByKickoff(group.fixtures),
        })),
        favouriteSet
      ),
    [scopedFootball, football, favouriteSet]
  );
  const racingGroups = useMemo(
    () =>
      sortFavouriteScopeIdsFirst(
        groupRacesByCourse(scopedRacing).map((group) => ({
          ...group,
          id: group.course,
        })),
        favouriteSet
      ),
    [scopedRacing, favouriteSet]
  );

  const scopedSourceFootball =
    scopeFilter === "all"
      ? football.filter(
          (f) => !hiddenSet.has(footballScopeId(f.competition, f.leagueCountry))
        )
      : football.filter((f) => fixtureMatchesFootballScope(f, scopeFilter));
  const scopedSourceRacing =
    scopeFilter === "all"
      ? racing.filter((r) => !hiddenSet.has(r.course))
      : racing.filter((r) => r.course === scopeFilter);

  const liveCount =
    sport === "football"
      ? scopedSourceFootball.filter((f) => f.status === "live").length
      : scopedSourceRacing.filter((r) => r.status === "live").length;

  const scheduledCount =
    sport === "football"
      ? scopedSourceFootball.filter((f) => f.status === "upcoming").length
      : scopedSourceRacing.filter((r) => r.status === "upcoming").length;

  const totalCount =
    sport === "football" ? scopedSourceFootball.length : scopedSourceRacing.length;
  const visibleCount = sport === "football" ? scopedFootball.length : scopedRacing.length;
  const scopeLabel =
    scopeFilter === "all"
      ? null
      : scopeOptions.find((option) => option.id === scopeFilter)?.label ?? scopeFilter;

  const statusFilters: { id: FixtureStatusFilter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: totalCount },
    { id: "scheduled", label: "Scheduled", count: scheduledCount },
    { id: "live", label: "Live", count: liveCount },
  ];
  const emptyCopy = fixtureBoardEmptyCopy(
    sport,
    statusFilter,
    emptyTitle,
    emptyDescription,
    loadFailed,
    scopeLabel,
    favouritesOnly,
    favouriteSet.size > 0,
    hiddenSet.size > 0 &&
      (sport === "football" ? football.length > 0 : racing.length > 0) &&
      (sport === "football"
        ? football.some((f) =>
            hiddenSet.has(footballScopeId(f.competition, f.leagueCountry))
          )
        : racing.some((r) => hiddenSet.has(r.course))),
  );
  const favouriteFixtureCount =
    sport === "football"
      ? football.filter((f) =>
          favouriteSet.has(footballScopeId(f.competition, f.leagueCountry))
        ).length
      : racing.filter((r) => favouriteSet.has(r.course)).length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-start gap-4 sm:justify-between">
          <div className={filterPillGroup} role="group" aria-label="Fixture filters">
            {statusFilters.map((f) => {
              const active = !favouritesOnly && statusFilter === f.id;
              const hasCount = f.id !== "all";
              const pill = (
                <FilterPill
                  key={f.id}
                  active={active}
                  onClick={() => {
                    setFavouritesOnly(false);
                    setStatusFilter(f.id);
                  }}
                  hasCount={hasCount}
                >
                  {f.label}
                  {hasCount ? (
                    <span className={filterPillCountState(active)}>{f.count ?? 0}</span>
                  ) : null}
                </FilterPill>
              );
              if (f.id !== "all") return pill;
              return (
                <Fragment key="after-all">
                  {pill}
                  <FilterPill
                    active={favouritesOnly}
                    onClick={() => {
                      setFavouritesOnly(true);
                      setStatusFilter("all");
                    }}
                    hasCount
                  >
                    <Star
                      aria-hidden
                      className={favouriteStarIconOnBrandPlate(favouritesOnly)}
                    />
                    Saved
                    <span className={filterPillCountState(favouritesOnly)}>
                      {favouriteFixtureCount}
                    </span>
                  </FilterPill>
                </Fragment>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            <FixtureScopeFilter
              sport={sport}
              options={scopeOptions}
              value={scopeFilter}
              onChange={changeScope}
              favouriteIds={favouriteSet}
              hiddenIds={hiddenSet}
              onToggleFavourite={toggleFavourite}
              onToggleHidden={toggleHidden}
              disabled={loading && scopeOptions.length === 0}
            />
          </div>
        </div>

        {loading ? (
          <EmptyState
            compact={emptyCompact}
            busy
            title={sport === "horse_racing" ? "Loading racecards…" : "Loading fixtures…"}
            description={
              sport === "horse_racing"
                ? "Today's cards will appear here."
                : "Today's list will appear here."
            }
          />
        ) : visibleCount === 0 ? (
          <EmptyState
            compact={emptyCompact}
            icon={CalendarDays}
            title={emptyCopy.title}
            description={emptyCopy.description}
            action={
              scopeFilter !== "all" || favouritesOnly
                ? {
                    label:
                      sport === "football"
                        ? "Show all competitions"
                        : "Show all courses",
                    onClick: () => {
                      setFavouritesOnly(false);
                      setScopeFilter("all");
                    },
                  }
                : undefined
            }
          />
        ) : sport === "football" ? (
          <div className="space-y-4">
            {footballGroups.map((group) => (
              <FootballCompetitionSection
                key={group.id}
                scopeId={group.id}
                competition={group.competition}
                label={group.label}
                leagueFlag={group.leagueFlag}
                leagueCountry={group.leagueCountry}
                fixtures={group.fixtures}
                trackedExternalIds={trackedExternalIds}
                onTrack={onTrackFixture}
                onTrackAndBet={onTrackAndBetFixture}
                onEpDesk={onEpDesk}
                displayTimezone={displayTimezone}
                favourite={favouriteSet.has(group.id)}
                onToggleFavourite={() => toggleFavourite(group.id)}
                hidden={hiddenSet.has(group.id)}
                onToggleHidden={() => toggleHidden(group.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {racingGroups.map((group) => (
              <RacingCourseSection
                key={group.course}
                course={group.course}
                region={group.region}
                races={group.races}
                trackedExternalIds={trackedExternalIds}
                onTrack={onTrackRace}
                onTrackAndBet={onTrackAndBetRace}
                displayTimezone={displayTimezone}
                favourite={favouriteSet.has(group.course)}
                onToggleFavourite={() => toggleFavourite(group.course)}
                hidden={hiddenSet.has(group.course)}
                onToggleHidden={() => toggleHidden(group.course)}
              />
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
