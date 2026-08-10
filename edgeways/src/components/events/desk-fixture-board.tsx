"use client";

import Link from "next/link";
import { useNow } from "@/hooks/use-now";
import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Fixture, RacingFixture } from "@/components/events/types";
import { RegionFlag, GlobalFlag } from "@/components/region-flag";
import { SportIcon } from "@/components/sport-icon";
import { TeamCrest } from "@/components/team-crest";
import { isWorldCupCompetition } from "@/lib/accounts/access";
import { competitionFlagIso } from "@/lib/geo/competition";
import { toIsoCountryCode, racingRegionLabel } from "@/lib/geo/region";
import {
  formatFixtureKickoff,
  sortFixturesByKickoff,
} from "@/lib/events";
import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/display-timezone";
import { listRow, sectionBar, sectionMeta, sectionTitle } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Flame, ChevronDown, NotebookPen, Plus } from "lucide-react";

export type FixtureStatusFilter = "all" | "live" | "scheduled";

function matchesStatusFilter(
  status: "upcoming" | "live" | "finished",
  filter: FixtureStatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "live") return status === "live";
  return status === "upcoming";
}

function groupFootballByCompetition(fixtures: Fixture[]) {
  const map = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const list = map.get(fixture.competition) ?? [];
    list.push(fixture);
    map.set(fixture.competition, list);
  }
  return [...map.entries()]
    .map(([competition, items]) => ({
      competition,
      leagueFlag: items[0]?.leagueFlag,
      leagueCountry: items[0]?.leagueCountry,
      fixtures: sortFixturesByKickoff(items),
    }))
    .sort((a, b) => a.competition.localeCompare(b.competition));
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
          <TooltipContent side="left" align="center" sideOffset={6}>
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
            <TooltipContent side="left">Add bet</TooltipContent>
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
            <TooltipContent side="left">Track &amp; add bet</TooltipContent>
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
            <TooltipContent side="left">Track only</TooltipContent>
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
}: {
  competition: string;
  leagueFlag?: string | null;
  leagueCountry?: string | null;
}) {
  if (isWorldCupCompetition(competition)) {
    return <GlobalFlag size="md" title="FIFA World Cup" />;
  }

  const iso = competitionFlagIso(competition, leagueCountry);
  if (iso) {
    return (
      <RegionFlag
        code={iso}
        size="md"
        hideIfUnknown={false}
        title={leagueCountry ?? competition}
      />
    );
  }

  if (leagueFlag) {
    return <TeamCrest src={leagueFlag} alt={leagueCountry ?? competition} size="md" />;
  }

  return null;
}

function FootballCompetitionSection({
  competition,
  leagueFlag,
  leagueCountry,
  fixtures,
  trackedExternalIds,
  onTrack,
  onTrackAndBet,
  onEpDesk,
  displayTimezone,
}: {
  competition: string;
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

  return (
    <section className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/50 dark:shadow-none">
      <CollapsibleSectionHeader open={open} onToggle={() => setOpen((v) => !v)}>
        <p className={cn(sectionTitle, "flex items-center gap-1.5 normal-case")}>
          <CompetitionHeaderIcon
            competition={competition}
            leagueFlag={leagueFlag}
            leagueCountry={leagueCountry}
          />
          <span>{competition}</span>
        </p>
      </CollapsibleSectionHeader>
      {open ? (
      <ul>
        {fixtures.map((fixture) => {
          const isTracked = trackedExternalIds.has(fixture.externalId);
          const live = fixture.status === "live";
          return (
            <li
              key={fixture.externalId}
              className={cn(
                listRow,
                "flex items-center gap-3 px-3 py-2.5",
                live && "bg-emerald-500/5"
              )}
            >
              <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                {formatFixtureKickoff(fixture.startTime, now, displayTimezone)}
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
                    <Badge className="bg-emerald-600 text-[10px] tabular-nums">
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
      ) : null}
    </section>
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

  if (races.length === 0) return null;
  const hasRegionFlag = Boolean(toIsoCountryCode(region));

  return (
    <section className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/50 dark:shadow-none">
      <CollapsibleSectionHeader open={open} onToggle={() => setOpen((v) => !v)}>
        <p className={cn(sectionTitle, "flex items-center gap-1.5")}>
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
      <div className={sectionMeta}>
        <ul>
          {races.map((race) => {
            const raceTracked = trackedExternalIds.has(race.externalId);
            const raceLive = race.status === "live";
            return (
              <li
                key={race.externalId}
                className={cn(
                  listRow,
                  "flex items-center gap-3 px-3 py-2.5",
                  raceLive && "bg-emerald-500/5"
                )}
              >
                <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {formatFixtureKickoff(race.startTime, now, displayTimezone)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{race.raceName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {race.fieldSize} runners
                    {raceLive ? (
                      <Badge className="ml-2 bg-emerald-600 text-[10px]">Off</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2 text-[10px]">
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
      </div>
      ) : null}
    </section>
  );
}

export function FlashscoreFixtureBoard({
  sport,
  football,
  racing,
  trackedExternalIds,
  onTrackFixture,
  onTrackAndBetFixture,
  onEpDesk,
  onTrackRace,
  onTrackAndBetRace,
  emptyMessage,
  competitionFilter = "all",
  onCompetitionFilterChange,
  worldCupCount = 0,
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
  emptyMessage: string;
  competitionFilter?: "all" | "world_cup";
  onCompetitionFilterChange?: (value: "all" | "world_cup") => void;
  worldCupCount?: number;
  displayTimezone?: string;
}) {
  const [statusFilter, setStatusFilter] = useState<FixtureStatusFilter>("all");

  const filteredFootball = useMemo(
    () => football.filter((f) => matchesStatusFilter(f.status, statusFilter)),
    [football, statusFilter]
  );
  const filteredRacing = useMemo(
    () => racing.filter((r) => matchesStatusFilter(r.status, statusFilter)),
    [racing, statusFilter]
  );

  const footballGroups = useMemo(
    () => groupFootballByCompetition(filteredFootball),
    [filteredFootball]
  );
  const racingGroups = useMemo(() => groupRacesByCourse(filteredRacing), [filteredRacing]);

  const liveCount = useMemo(
    () =>
      sport === "football"
        ? football.filter((f) => f.status === "live").length
        : racing.filter((r) => r.status === "live").length,
    [sport, football, racing]
  );

  const scheduledCount = useMemo(
    () =>
      sport === "football"
        ? football.filter((f) => f.status === "upcoming").length
        : racing.filter((r) => r.status === "upcoming").length,
    [sport, football, racing]
  );

  const totalCount = sport === "football" ? football.length : racing.length;
  const visibleCount = sport === "football" ? filteredFootball.length : filteredRacing.length;

  const statusFilters: { id: FixtureStatusFilter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: totalCount },
    { id: "scheduled", label: "Scheduled", count: scheduledCount },
    { id: "live", label: "Live", count: liveCount },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as FixtureStatusFilter)}
            className="w-fit shrink-0"
          >
            <TabsList variant="segmented">
              {statusFilters.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.label}
                  {f.count != null && f.count > 0 ? (
                    <span className="tabular-nums text-muted-foreground">({f.count})</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div
            className={cn(
              "shrink-0",
              sport !== "football" && "pointer-events-none invisible"
            )}
            aria-hidden={sport !== "football"}
          >
            {onCompetitionFilterChange ? (
              <Tabs
                value={competitionFilter}
                onValueChange={(v) => onCompetitionFilterChange(v as "all" | "world_cup")}
              >
                <TabsList variant="segmented">
                  <TabsTrigger value="all">All comps</TabsTrigger>
                  <TabsTrigger value="world_cup" className="gap-1">
                    <Flame className="size-3.5" />
                    World Cup
                    {worldCupCount > 0 ? (
                      <span className="tabular-nums text-muted-foreground">({worldCupCount})</span>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}
          </div>
        </div>

        {visibleCount === 0 ? (
          <div className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : sport === "football" ? (
          <div className="space-y-4">
            {footballGroups.map((group) => (
              <FootballCompetitionSection
                key={group.competition}
                competition={group.competition}
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
