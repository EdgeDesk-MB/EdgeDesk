"use client";

import Link from "next/link";
import { useNow } from "@/hooks/use-now";
import { useMemo, useState, type ReactNode } from "react";
import { FixtureScopeFilter } from "@/components/events/fixture-scope-filter";
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
  groupFootballByLeague,
} from "@/lib/events/fixture-scope";
import { competitionFlagIso } from "@/lib/geo/competition";
import { toIsoCountryCode, racingRegionLabel } from "@/lib/geo/region";
import { sortFixturesByKickoff } from "@/lib/events";
import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/display-timezone";
import { formatClockTime } from "@/lib/time-format";
import {
  captionHeading,
  deskInsetX,
  filterPillCountState,
  filterPillGroup,
  listDaySectionContentNested,
  listRow,
  listRowGroup,
  sectionBar,
  sectionTitle,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { CalendarDays, Flame, ChevronDown, NotebookPen, Plus } from "lucide-react";
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
) {
  if (loadFailed) return { title: emptyTitle, description: emptyDescription };
  const scoped =
    scopeLabel
      ? sport === "horse_racing"
        ? ` at ${scopeLabel}`
        : ` in ${scopeLabel}`
      : "";
  const clearHint = scopeLabel
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

const sectionHeaderBar = cn(sectionBar, "bg-selection-subtle/80");

function CollapsibleSectionHeader({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        sectionHeaderBar,
        "flex w-full cursor-pointer items-center justify-between gap-2 text-left transition-colors hover:bg-selection-subtle"
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
          open && "rotate-180"
        )}
        aria-hidden
      />
    </button>
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
}) {
  const [open, setOpen] = useState(true);
  const now = useNow(30_000);
  const dayGroups = groupByDisplayDay(fixtures, now, displayTimezone);

  return (
    <div className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/40 dark:ring-0">
      <CollapsibleSectionHeader open={open} onToggle={() => setOpen((v) => !v)}>
        <p className={cn(sectionTitle, "flex items-center gap-1.5")}>
          <CompetitionHeaderIcon
            competition={competition}
            leagueFlag={leagueFlag}
            leagueCountry={leagueCountry}
          />
          <span>{label}</span>
        </p>
      </CollapsibleSectionHeader>
      {open ? (
        <div className="pb-6">
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
}: {
  course: string;
  region?: string;
  races: RacingFixture[];
  trackedExternalIds: Set<string>;
  onTrack: (race: RacingFixture) => void;
  onTrackAndBet: (race: RacingFixture) => void;
  displayTimezone: string;
}) {
  const [open, setOpen] = useState(true);
  const now = useNow(30_000);
  const dayGroups = groupByDisplayDay(races, now, displayTimezone);

  if (races.length === 0) return null;
  const hasRegionFlag = Boolean(toIsoCountryCode(region));

  return (
    <div className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/40 dark:ring-0">
      <CollapsibleSectionHeader open={open} onToggle={() => setOpen((v) => !v)}>
        <p className={cn(captionHeading, "flex items-center gap-1.5 text-foreground")}>
          {hasRegionFlag ? (
            <RegionFlag code={region} size="md" />
          ) : (
            <SportIcon sport="horse_racing" size={16} className="text-muted-foreground" />
          )}
          <span>
            {racingRegionLabel(region).toUpperCase()}: {course.toUpperCase()}
          </span>
        </p>
      </CollapsibleSectionHeader>

      {open ? (
        <div className="pb-6">
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
}) {
  const [statusFilter, setStatusFilter] = useState<FixtureStatusFilter>("all");
  const [scopeFilter, setScopeFilter] = useState("all");

  const [prevSport, setPrevSport] = useState(sport);
  if (prevSport !== sport) {
    setPrevSport(sport);
    setScopeFilter("all");
  }

  const filteredFootball = useMemo(
    () => football.filter((f) => matchesStatusFilter(f.status, statusFilter)),
    [football, statusFilter]
  );
  const filteredRacing = useMemo(
    () => racing.filter((r) => matchesStatusFilter(r.status, statusFilter)),
    [racing, statusFilter]
  );

  const footballScopeOptions = useMemo(
    () =>
      groupFootballByLeague(football)
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
        .filter((option) => option.count > 0 || option.id === scopeFilter),
    [football, statusFilter, scopeFilter]
  );
  const racingScopeOptions = useMemo(
    () =>
      groupRacesByCourse(racing)
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
        .filter((option) => option.count > 0 || option.id === scopeFilter),
    [racing, statusFilter, scopeFilter]
  );
  const scopeOptions = sport === "football" ? footballScopeOptions : racingScopeOptions;

  const scopedFootball = useMemo(
    () =>
      scopeFilter === "all"
        ? filteredFootball
        : filteredFootball.filter((f) => fixtureMatchesFootballScope(f, scopeFilter)),
    [filteredFootball, scopeFilter]
  );
  const scopedRacing = useMemo(
    () =>
      scopeFilter === "all"
        ? filteredRacing
        : filteredRacing.filter((r) => r.course === scopeFilter),
    [filteredRacing, scopeFilter]
  );

  const footballGroups = useMemo(
    () =>
      groupFootballByLeague(scopedFootball, football).map((group) => ({
        ...group,
        fixtures: sortFixturesByKickoff(group.fixtures),
      })),
    [scopedFootball, football]
  );
  const racingGroups = useMemo(() => groupRacesByCourse(scopedRacing), [scopedRacing]);

  const scopedSourceFootball =
    scopeFilter === "all"
      ? football
      : football.filter((f) => fixtureMatchesFootballScope(f, scopeFilter));
  const scopedSourceRacing =
    scopeFilter === "all" ? racing : racing.filter((r) => r.course === scopeFilter);

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
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-start gap-4 sm:justify-between">
          <div className={filterPillGroup} role="group" aria-label="Fixture status">
            {statusFilters.map((f) => {
              const active = statusFilter === f.id;
              const hasCount = f.id !== "all";
              return (
                <FilterPill
                  key={f.id}
                  active={active}
                  onClick={() => setStatusFilter(f.id)}
                  hasCount={hasCount}
                >
                  {f.label}
                  {hasCount ? (
                    <span className={filterPillCountState(active)}>{f.count ?? 0}</span>
                  ) : null}
                </FilterPill>
              );
            })}
          </div>
          <FixtureScopeFilter
            sport={sport}
            options={scopeOptions}
            value={scopeFilter}
            onChange={setScopeFilter}
            disabled={loading && scopeOptions.length === 0}
          />
        </div>

        {loading ? (
          <EmptyState
            compact
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
            compact
            icon={CalendarDays}
            title={emptyCopy.title}
            description={emptyCopy.description}
            action={
              scopeFilter !== "all"
                ? {
                    label:
                      sport === "football"
                        ? "Show all competitions"
                        : "Show all courses",
                    onClick: () => setScopeFilter("all"),
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
              />
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
