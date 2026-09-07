"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FavouriteStar } from "@/components/events/favourite-star";
import { HideScopeButton } from "@/components/events/hide-scope-button";
import { FixtureScopeFilter } from "@/components/events/fixture-scope-filter";
import { FixtureSavedRail } from "@/components/events/fixture-saved-rail";
import { api, useAppState } from "@/hooks/use-app-state";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Fixture, FootballCompetition, RacingFixture } from "@/components/events/types";
import { RegionFlag, GlobalFlag } from "@/components/region-flag";
import { SportIcon } from "@/components/sport-icon";
import { TeamCrest } from "@/components/team-crest";
import {
  FootballLiveTapeDialog,
  type FootballTapeDialogEvent,
} from "@/components/events/match-tape";
import { RacingResultTapeDialog } from "@/components/events/racing-result-tape-dialog";
import { isWorldCupCompetition } from "@/lib/accounts/access";
import {
  fixtureMatchesFootballScope,
  footballCompetitionDisplayTitle,
  footballScopeHeadingParts,
  footballScopeId,
  footballScopeLabel,
  footballCatalogAsFixtures,
  collapsedScopeCountCopy,
  countFixtureStatuses,
  groupFootballByLeague,
  groupFootballScopesWithCatalog,
  favouriteScopeStub,
  moveFavouriteScopeId,
  orderByFavouriteIds,
  sortFavouriteScopeIdsFirst,
  sortFootballScopeMenu,
  sortFootballTapeGroups,
  sortGroupsByFavouriteOrder,
  sortGroupsByFirstStart,
  toggleFavouriteScopeId,
} from "@/lib/events/fixture-scope";
import { competitionFlagIso } from "@/lib/geo/competition";
import { toIsoCountryCode, racingRegionLabel } from "@/lib/geo/region";
import { footballClockLabel, sortFixturesByKickoff } from "@/lib/events";
import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/display-timezone";
import { formatClockTime } from "@/lib/time-format";
import {
  FIXTURE_TAPE_GUTTER_PX,
  fixtureTapeClockMin,
  fixtureTapeRacingClockMin,
  fixtureTapeMatchGrid,
  fixtureTapeRow,
  fixtureTapeRowGrid,
  fixtureTapeSectionHover,
  fixtureTapeScoreRail,
  fixtureTapeTeamStack,
  favouriteStarIcon,
  filterPillCountState,
  filterPillGroup,
  listRowGroup,
  deskInsetX,
  sectionTitle,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronDown, Flame, Loader2, NotebookPen, Pin, Plus, Radio } from "lucide-react";
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
        sport === "horse_racing" ? "No pinned courses" : "No pinned competitions",
      description:
        sport === "horse_racing"
          ? "Pin a course. Pinned courses stay on this desk."
          : "Pin a competition. Pinned competitions stay on this desk.",
    };
  }
  if (favouritesOnly && hasFavouritePins) {
    const statusBit =
      statusFilter === "live"
        ? sport === "horse_racing"
          ? "live races"
          : "live fixtures"
        : statusFilter === "scheduled"
          ? sport === "horse_racing"
            ? "scheduled races"
            : "scheduled fixtures"
          : sport === "horse_racing"
            ? "races"
            : "fixtures";
    return {
      title: `No ${statusBit} for your pins`,
      description:
        sport === "horse_racing"
          ? "None of the courses you follow have a card on this day. Try another day, or show all."
          : "None of the competitions you follow have a match on this day. Try another day, or show all.",
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
        ? " in Pinned only"
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
          ? `No races at ${scopeLabel} on this day`
          : `No fixtures for ${scopeLabel} on this day`,
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
  return sortGroupsByFirstStart(
    [...map.entries()].map(([course, items]) => ({
      course,
      region: items[0]?.region,
      races: sortFixturesByKickoff(items),
    })),
    (group) => group.course
  );
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
              aria-label="Analyse 2UP Dutch in 2UP Desk"
              onClick={onEpDesk}
            >
              <Flame className="size-4 text-warning" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" sideOffset={6}>
            2UP Desk, Dutch EV
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

function tapeClockClass(live: boolean, align: "end" | "center" = "end") {
  return cn(
    "flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums leading-none",
    align === "center"
      ? cn("w-full justify-center text-center", fixtureTapeRacingClockMin)
      : cn("justify-end text-right", fixtureTapeClockMin),
    live ? "text-profit" : "text-muted-foreground"
  );
}

function fixtureTapeEvent(
  fixture: Fixture,
  eventId?: number
): FootballTapeDialogEvent {
  return {
    id: eventId,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    status: fixture.status,
    minute: fixture.minute,
    startTime: fixture.startTime,
    competition: fixture.competition,
    externalId: fixture.externalId,
    source: "api",
    sport: "football",
  };
}

function FootballTapeRow({
  fixture,
  eventId,
  displayTimezone,
  scope,
  onOpenTape,
}: {
  fixture: Fixture;
  eventId?: number;
  displayTimezone: string;
  scope?: string;
  onOpenTape: (event: FootballTapeDialogEvent) => void;
}) {
  const live = fixture.status === "live";
  const showScore = live || fixture.status === "finished";
  const clock = live
    ? footballClockLabel(fixture) ?? "Live"
    : fixture.status === "finished"
      ? "FT"
      : formatClockTime(fixture.startTime, { timeZone: displayTimezone });
  const scoreClass = cn(
    "text-sm font-semibold tabular-nums",
    live ? "text-profit" : showScore ? "text-foreground" : "text-muted-foreground"
  );

  return (
    <li
      className={cn(fixtureTapeRow, "cursor-pointer")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        onOpenTape(fixtureTapeEvent(fixture, eventId));
      }}
    >
      <div className={fixtureTapeMatchGrid}>
        <div className={fixtureTapeTeamStack}>
          <span
            className="flex min-w-0 items-center gap-2 truncate font-medium"
            title={fixture.homeTeam}
          >
            <TeamCrest src={fixture.homeLogo} alt={fixture.homeTeam} />
            {fixture.homeTeam}
          </span>
          <span
            className="flex min-w-0 items-center gap-2 truncate font-medium"
            title={fixture.awayTeam}
          >
            <TeamCrest src={fixture.awayLogo} alt={fixture.awayTeam} />
            {fixture.awayTeam}
          </span>
        </div>
        <span className={tapeClockClass(live)}>
          {live ? (
            <Radio
              className="size-3 animate-pulse motion-reduce:animate-none"
              aria-hidden
            />
          ) : null}
          {clock}
        </span>
        <div className={cn(fixtureTapeTeamStack, "justify-items-end", fixtureTapeScoreRail)}>
          <span className={scoreClass}>{showScore ? fixture.homeScore : "–"}</span>
          <span className={scoreClass}>{showScore ? fixture.awayScore : "–"}</span>
        </div>
      </div>
      <button
        type="button"
        className="sr-only"
        onClick={() => onOpenTape(fixtureTapeEvent(fixture, eventId))}
      >
        Open match events for {fixture.homeTeam} v {fixture.awayTeam}
      </button>
      {scope ? (
        <p className={cn(fixtureTapeMatchGrid, "mt-0.5")}>
          <span className="min-w-0 truncate text-xs text-muted-foreground" title={scope}>
            {scope}
          </span>
          <span aria-hidden />
          <span aria-hidden />
        </p>
      ) : null}
    </li>
  );
}

function RacingTapeRow({
  race,
  tracked,
  displayTimezone,
  scope,
  onOpenTape,
  onTrack,
  onTrackAndBet,
}: {
  race: RacingFixture;
  tracked: boolean;
  displayTimezone: string;
  scope?: string;
  onOpenTape: (race: RacingFixture) => void;
  onTrack: (race: RacingFixture) => void;
  onTrackAndBet: (race: RacingFixture) => void;
}) {
  const live = race.status === "live";
  const clock = live
    ? "Off"
    : race.status === "finished"
      ? "Result"
      : formatClockTime(race.startTime, { timeZone: displayTimezone });

  return (
    <li
      className={cn(fixtureTapeRow, "cursor-pointer")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        onOpenTape(race);
      }}
    >
      <div className={fixtureTapeRowGrid}>
        <span className={tapeClockClass(live, "center")}>
          {live ? (
            <Radio
              className="size-3 animate-pulse motion-reduce:animate-none"
              aria-hidden
            />
          ) : null}
          {clock}
        </span>
      <div className="min-w-0">
        <p className="truncate font-medium leading-snug" title={race.raceName}>
          {race.raceName}
        </p>
        <p
          className="mt-0.5 truncate text-xs text-muted-foreground"
          title={
            scope
              ? `${scope} · ${race.fieldSize} runners`
              : `${race.fieldSize} runners`
          }
        >
          {scope
            ? `${scope} · ${race.fieldSize} runners`
            : `${race.fieldSize} runners`}
        </p>
      </div>
      <div className="self-center">
        <FixtureActions
          isTracked={tracked}
          onTrack={() => onTrack(race)}
          onTrackAndBet={() => onTrackAndBet(race)}
        />
      </div>
      </div>
      <button
        type="button"
        className="sr-only"
        onClick={() => onOpenTape(race)}
      >
        Open race details for {race.raceName}
      </button>
    </li>
  );
}

const sectionHeaderBar = cn(
  deskInsetX,
  "border-b border-border/60 bg-page py-2.5 dark:bg-selection-subtle/80"
);
const sectionBody = "bg-selection-subtle dark:bg-transparent";

function CollapsedScopeCount({
  items,
}: {
  items: readonly { status: "upcoming" | "live" | "finished" }[];
}) {
  const copy = collapsedScopeCountCopy(countFixtureStatuses(items));
  if (!copy.live && !copy.rest) return null;
  return (
    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
      {copy.live ? <span className="font-medium text-profit">{copy.live}</span> : null}
      {copy.live && copy.rest ? " · " : null}
      {copy.rest}
    </span>
  );
}

function CollapsibleSectionHeader({
  open,
  onToggle,
  leading,
  trailing,
  meta,
  expandLabel,
  columns = "flex",
  children,
}: {
  open: boolean;
  onToggle: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  meta?: ReactNode;
  expandLabel?: string;
  columns?: "flex" | "match";
  children: ReactNode;
}) {
  const titleButton = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="min-w-0 flex-1 cursor-pointer py-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {children}
    </button>
  );
  const chevron = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Collapse" : (expandLabel ?? "Expand")}
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center justify-self-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <ChevronDown
        className={cn(
          "size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
          open && "rotate-180"
        )}
        aria-hidden
      />
    </button>
  );

  if (columns === "match") {
    return (
      <div
        className={cn(
          sectionHeaderBar,
          fixtureTapeMatchGrid,
          fixtureTapeSectionHover,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          {titleButton}
        </div>
        <div className="flex items-center justify-end gap-1">
          {trailing}
          {meta}
        </div>
        {chevron}
      </div>
    );
  }

  return (
    <div
      className={cn(
        sectionHeaderBar,
        "flex w-full items-center gap-3",
        fixtureTapeSectionHover,
      )}
    >
      {leading}
      {titleButton}
      {trailing}
      {meta}
      {chevron}
    </div>
  );
}

function CompetitionHeaderIcon({
  competition,
  leagueCountry,
  size = "md",
}: {
  competition: string;
  leagueCountry?: string | null;
  size?: "sm" | "md";
}) {
  if (isWorldCupCompetition(competition)) {
    return <GlobalFlag size={size} title="FIFA World Cup" />;
  }

  const iso = competitionFlagIso(competition, leagueCountry);
  if (!iso) return null;
  return (
    <RegionFlag
      code={iso}
      size={size}
      hideIfUnknown={false}
      title={leagueCountry ?? competition}
    />
  );
}

function FootballCompetitionSection({
  scopeId,
  competition,
  title,
  label,
  leagueCountry,
  fixtures,
  onOpenTape,
  eventIdByExternalId,
  displayTimezone,
  favourite,
  onToggleFavourite,
  hidden,
  onToggleHidden,
  empty,
}: {
  scopeId: string;
  competition: string;
  title: string;
  label: string;
  leagueCountry?: string | null;
  fixtures: Fixture[];
  onOpenTape: (event: FootballTapeDialogEvent) => void;
  eventIdByExternalId: Map<string, number>;
  displayTimezone: string;
  favourite: boolean;
  onToggleFavourite: () => void;
  hidden: boolean;
  onToggleHidden: () => void;
  empty?: {
    title: string;
    description: string;
    action?: { label: string; onClick: () => void; variant?: "primary" | "secondary" };
    secondaryAction?: { label: string; onClick: () => void; variant?: "primary" | "secondary" };
  };
}) {
  const [open, setOpen] = useState(true);
  const headingId = fixtureDayHeadingId(scopeId, "day");
  const heading = footballScopeHeadingParts(title, leagueCountry ?? null);
  const countCopy = collapsedScopeCountCopy(countFixtureStatuses(fixtures));

  return (
    <div className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/40 dark:ring-0">
      <CollapsibleSectionHeader
        open={open}
        onToggle={() => setOpen((v) => !v)}
        columns="match"
        leading={
          <FavouriteStar favourite={favourite} label={label} onToggle={onToggleFavourite} />
        }
        trailing={
          hidden || !favourite ? (
            <HideScopeButton hidden={hidden} label={label} onToggle={onToggleHidden} />
          ) : null
        }
        meta={!open ? <CollapsedScopeCount items={fixtures} /> : null}
        expandLabel={countCopy.aria ? `Expand, ${countCopy.aria}` : undefined}
      >
        <p id={headingId} className={cn(sectionTitle, "flex items-center gap-3")}>
          <CompetitionHeaderIcon
            competition={competition}
            leagueCountry={leagueCountry}
          />
          <span className="flex min-w-0 items-baseline gap-1.5 truncate" title={label}>
            {heading.country ? (
              <>
                <span className="shrink-0">{heading.country}</span>
                <span className="shrink-0">-</span>
              </>
            ) : null}
            <span className="min-w-0 truncate">{heading.name}</span>
          </span>
        </p>
      </CollapsibleSectionHeader>
      {open ? (
        <div className={cn(sectionBody, fixtures.length === 0 && empty && "p-4")}>
          {fixtures.length === 0 && empty ? (
            <EmptyState
              compact
              headingLevel={4}
              icon={CalendarDays}
              title={empty.title}
              description={empty.description}
              action={empty.action}
              secondaryAction={empty.secondaryAction}
            />
          ) : (
            <ul aria-labelledby={headingId} className={listRowGroup}>
              {fixtures.map((fixture) => (
                <FootballTapeRow
                  key={fixture.externalId}
                  fixture={fixture}
                  displayTimezone={displayTimezone}
                  onOpenTape={onOpenTape}
                  eventId={eventIdByExternalId.get(fixture.externalId)}
                />
              ))}
            </ul>
          )}
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
  onOpenTape,
  onTrack,
  onTrackAndBet,
  displayTimezone,
  favourite,
  onToggleFavourite,
  hidden,
  onToggleHidden,
  empty,
}: {
  course: string;
  region?: string;
  races: RacingFixture[];
  trackedExternalIds: Set<string>;
  onOpenTape: (race: RacingFixture) => void;
  onTrack: (race: RacingFixture) => void;
  onTrackAndBet: (race: RacingFixture) => void;
  displayTimezone: string;
  favourite: boolean;
  onToggleFavourite: () => void;
  hidden: boolean;
  onToggleHidden: () => void;
  empty?: {
    title: string;
    description: string;
    action?: { label: string; onClick: () => void; variant?: "primary" | "secondary" };
    secondaryAction?: { label: string; onClick: () => void; variant?: "primary" | "secondary" };
  };
}) {
  const [open, setOpen] = useState(true);
  const headingId = fixtureDayHeadingId(course, "day");
  const countCopy = collapsedScopeCountCopy(countFixtureStatuses(races));

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
        meta={!open ? <CollapsedScopeCount items={races} /> : null}
        expandLabel={countCopy.aria ? `Expand, ${countCopy.aria}` : undefined}
      >
        <p id={headingId} className={cn(sectionTitle, "flex items-center gap-3")}>
          {hasRegionFlag ? (
            <RegionFlag code={region} size="md" />
          ) : (
            <SportIcon sport="horse_racing" size={16} className="text-muted-foreground" />
          )}
          <span
            className="flex min-w-0 items-baseline gap-1.5 truncate"
            title={`${racingRegionLabel(region).toUpperCase()} - ${course.toUpperCase()}`}
          >
            <span className="shrink-0">{racingRegionLabel(region).toUpperCase()}</span>
            <span className="shrink-0">-</span>
            <span className="min-w-0 truncate">{course.toUpperCase()}</span>
          </span>
        </p>
      </CollapsibleSectionHeader>

      {open ? (
        <div className={cn(sectionBody, races.length === 0 && empty && "p-4")}>
          {races.length === 0 && empty ? (
            <EmptyState
              compact
              headingLevel={4}
              icon={CalendarDays}
              title={empty.title}
              description={empty.description}
              action={empty.action}
              secondaryAction={empty.secondaryAction}
            />
          ) : (
            <ul aria-labelledby={headingId} className={listRowGroup}>
              {races.map((race) => (
                <RacingTapeRow
                  key={race.externalId}
                  race={race}
                  tracked={trackedExternalIds.has(race.externalId)}
                  displayTimezone={displayTimezone}
                  onOpenTape={onOpenTape}
                  onTrack={onTrack}
                  onTrackAndBet={onTrackAndBet}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FootballKickoffList({
  fixtures,
  onOpenTape,
  eventIdByExternalId,
  displayTimezone,
  showScope = true,
}: {
  fixtures: Fixture[];
  onOpenTape: (event: FootballTapeDialogEvent) => void;
  eventIdByExternalId: Map<string, number>;
  displayTimezone: string;
  showScope?: boolean;
}) {
  return (
    <div className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/40 dark:ring-0">
      <ul className={listRowGroup} aria-label="Fixtures by kick-off">
        {sortFixturesByKickoff(fixtures).map((fixture) => {
          const scope = showScope
            ? footballScopeLabel(
                footballCompetitionDisplayTitle(
                  fixture.competition,
                  fixture.leagueCountry ?? null,
                  fixtures
                ),
                fixture.leagueCountry ?? null
              )
            : undefined;
          return (
            <FootballTapeRow
              key={fixture.externalId}
              fixture={fixture}
              displayTimezone={displayTimezone}
              scope={scope}
              onOpenTape={onOpenTape}
              eventId={eventIdByExternalId.get(fixture.externalId)}
            />
          );
        })}
      </ul>
    </div>
  );
}

function RacingKickoffList({
  races,
  trackedExternalIds,
  onOpenTape,
  onTrack,
  onTrackAndBet,
  displayTimezone,
  showScope = true,
}: {
  races: RacingFixture[];
  trackedExternalIds: Set<string>;
  onOpenTape: (race: RacingFixture) => void;
  onTrack: (race: RacingFixture) => void;
  onTrackAndBet: (race: RacingFixture) => void;
  displayTimezone: string;
  showScope?: boolean;
}) {
  return (
    <div className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/40 dark:ring-0">
      <ul className={listRowGroup} aria-label="Races by off time">
        {sortFixturesByKickoff(races).map((race) => (
          <RacingTapeRow
            key={race.externalId}
            race={race}
            tracked={trackedExternalIds.has(race.externalId)}
            displayTimezone={displayTimezone}
            scope={
              showScope
                ? `${racingRegionLabel(race.region).toUpperCase()} - ${race.course.toUpperCase()}`
                : undefined
            }
            onOpenTape={onOpenTape}
            onTrack={onTrack}
            onTrackAndBet={onTrackAndBet}
          />
        ))}
      </ul>
    </div>
  );
}

export function DeskFixtureBoard({
  sport,
  football,
  competitions = [],
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
  dayControl = null,
  listKey,
  sportControl = null,
  pageHeader = null,
  className,
}: {
  sport: "football" | "horse_racing";
  football: Fixture[];
  competitions?: FootballCompetition[];
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
  dayControl?: ReactNode;
  /** Day identity for re-pinning the tape (UK date). */
  listKey?: string;
  sportControl?: ReactNode;
  /** Page title band. Sticks with the sport tabs and feed bar. */
  pageHeader?: ReactNode;
  className?: string;
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
  const [tapeEvent, setTapeEvent] = useState<FootballTapeDialogEvent | null>(null);
  const [tapeRace, setTapeRace] = useState<RacingFixture | null>(null);
  const eventIdByExternalId = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of state?.events ?? []) {
      if (!event.externalId) continue;
      if ((event.sport ?? "football") === "horse_racing") continue;
      map.set(event.externalId, event.id);
    }
    return map;
  }, [state?.events]);

  async function persistFavourites(next: string[]) {
    const previous = favouriteIds;
    setFavouriteIds(next);
    const json =
      sport === "football"
        ? { favouriteFootballScopes: next }
        : { favouriteRacingCourses: next };
    applyLocalSettingsPatch(json);
    if (next.length === 0) setFavouritesOnly(false);
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
          ? "Could not update pinned competitions"
          : "Could not update pinned courses"
      );
    }
  }

  function toggleFavourite(id: string) {
    void persistFavourites(toggleFavouriteScopeId(favouriteIds, id));
  }

  function reorderFavourite(sourceId: string, targetId: string) {
    void persistFavourites(moveFavouriteScopeId(favouriteIds, sourceId, targetId));
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
    setFavouritesOnly(false);
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
    if (sport !== "football") return [];
    const options = groupFootballScopesWithCatalog(football, competitions).map((group) => ({
      id: group.id,
      label: group.label,
      name: group.title,
      country: group.leagueCountry,
      leagueFlag: group.leagueFlag ?? group.fixtures[0]?.leagueFlag ?? null,
      count: group.fixtures.filter((f) => matchesStatusFilter(f.status, statusFilter))
        .length,
    }));
    return sortFootballScopeMenu(options, favouriteIds);
  }, [sport, football, competitions, statusFilter, favouriteIds]);
  const racingScopeOptions = useMemo(() => {
    if (sport !== "horse_racing") return [];
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
    return sortFavouriteScopeIdsFirst(options, favouriteIds);
  }, [sport, racing, statusFilter, scopeFilter, favouriteIds]);
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

  const footballGroups = useMemo(() => {
    if (sport !== "football") return [];
    const peers = [...football, ...footballCatalogAsFixtures(competitions)];
    const groups = groupFootballByLeague(scopedFootball, peers).map((group) => ({
      ...group,
      fixtures: sortFixturesByKickoff(group.fixtures),
    }));
    const withMatches = groups.filter((group) => group.fixtures.length > 0);
    if (favouritesOnly) return sortGroupsByFavouriteOrder(withMatches, favouriteIds);
    return sortFootballTapeGroups(withMatches, scopeFilter === "all");
  }, [
    sport,
    scopedFootball,
    football,
    competitions,
    scopeFilter,
    favouritesOnly,
    favouriteIds,
  ]);
  const racingGroups = useMemo(() => {
    if (sport !== "horse_racing") return [];
    const groups = groupRacesByCourse(scopedRacing).map((group) => ({
      ...group,
      id: group.course,
    }));
    const withMatches = groups.filter((group) => group.races.length > 0);
    if (favouritesOnly) return sortGroupsByFavouriteOrder(withMatches, favouriteIds);
    return sortGroupsByFirstStart(withMatches, (group) => group.course);
  }, [sport, scopedRacing, favouritesOnly, favouriteIds, scopeFilter]);

  const scopedSourceFootball = (() => {
    const scoped =
      scopeFilter === "all"
        ? football.filter(
            (f) => !hiddenSet.has(footballScopeId(f.competition, f.leagueCountry))
          )
        : football.filter((f) => fixtureMatchesFootballScope(f, scopeFilter));
    if (!favouritesOnly) return scoped;
    return scoped.filter((f) =>
      favouriteSet.has(footballScopeId(f.competition, f.leagueCountry))
    );
  })();
  const scopedSourceRacing = (() => {
    const scoped =
      scopeFilter === "all"
        ? racing.filter((r) => !hiddenSet.has(r.course))
        : racing.filter((r) => r.course === scopeFilter);
    if (!favouritesOnly) return scoped;
    return scoped.filter((r) => favouriteSet.has(r.course));
  })();

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
  const selectedScope = scopeOptions.find((option) => option.id === scopeFilter);
  const scopeLabel =
    scopeFilter === "all"
      ? null
      : selectedScope?.name ?? selectedScope?.label ?? favouriteScopeStub(scopeFilter).name;

  const statusFilters: { id: FixtureStatusFilter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: totalCount },
    { id: "live", label: "Live", count: liveCount },
    { id: "scheduled", label: "Scheduled", count: scheduledCount },
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
  const pinnedOptions = useMemo(() => {
    const byId = new Map(scopeOptions.map((option) => [option.id, option]));
    return orderByFavouriteIds(favouriteIds, byId, (id) => {
      const stub = favouriteScopeStub(id);
      const fromScope = byId.get(id);
      return fromScope ?? { ...stub, icon: undefined };
    }).map((option) => ({
      ...option,
      icon:
        sport === "football" ? (
          <CompetitionHeaderIcon
            competition={option.name ?? option.label}
            leagueCountry={"country" in option ? option.country : null}
            size="sm"
          />
        ) : "icon" in option ? (
          option.icon
        ) : undefined,
    }));
  }, [scopeOptions, favouriteIds, sport]);

  const pinnedNoun = sport === "horse_racing" ? "courses" : "competitions";
  const settingsReady = state != null;
  const hasPins = favouriteSet.size > 0;
  const showPinRail = !settingsReady || hasPins;
  const footballFilterIcon = sport === "football"
    ? (option: { name?: string; label: string; country?: string | null }) => (
        <CompetitionHeaderIcon
          competition={option.name ?? option.label}
          leagueCountry={option.country}
          size="sm"
        />
      )
    : undefined;

  const listFilter = (
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
      face="outline"
      align="end"
      labelMode="icon"
      renderIcon={footballFilterIcon}
    />
  );

  const railProps = {
    sport,
    pinned: pinnedOptions,
    scopeFilter,
    favouritesOnly,
    onSelectAll: () => {
      setFavouritesOnly(false);
      setScopeFilter("all");
    },
    onSelectSaved: () => {
      setFavouritesOnly(true);
      setScopeFilter("all");
    },
    onSelectScope: (id: string) => {
      setFavouritesOnly(false);
      setScopeFilter(id);
    },
    onReorderPinned: reorderFavourite,
    hydrated: state != null,
  } as const;

  const rail = <FixtureSavedRail {...railProps} />;
  const pinnedSheet = <FixtureSavedRail {...railProps} showScopes={false} />;

  const pinnedTrigger = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="h-8"
          aria-label={`Pinned ${pinnedNoun}`}
        >
          <Pin aria-hidden className={favouriteStarIcon(pinnedOptions.length > 0, "sm")} />
          Pinned
          <span className="tabular-nums text-muted-foreground">
            {state != null ? pinnedOptions.length : ""}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 max-w-[calc(100vw-var(--overlay-gutter))] p-0"
      >
        <ScrollFadeEdges
          className="max-h-[min(24rem,calc(100dvh-6rem))]"
          fadeClassName="from-popover"
          scrollClassName="app-scroll-nested p-3"
        >
          {pinnedSheet}
        </ScrollFadeEdges>
      </PopoverContent>
    </Popover>
  );

  const slice = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div
          className={cn(
            filterPillGroup,
            "app-scroll-overlay min-w-0 flex-nowrap overflow-x-auto overflow-y-clip overscroll-x-contain"
          )}
          role="group"
          aria-label="Fixture filters"
        >
          {statusFilters.map((f) => {
            const active = statusFilter === f.id;
            return (
              <FilterPill
                key={f.id}
                active={active}
                onClick={() => setStatusFilter(f.id)}
                hasCount
              >
                {f.label}
                <span className={filterPillCountState(active)}>{f.count ?? 0}</span>
              </FilterPill>
            );
          })}
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            {dayControl}
            {listFilter}
          </div>
          {showPinRail ? <div className="lg:hidden">{pinnedTrigger}</div> : null}
        </div>
      </div>
    </div>
  );

  const body = loading ? (
          <EmptyState
            compact={emptyCompact}
            busy
            title={sport === "horse_racing" ? "Loading racecards…" : "Loading fixtures…"}
            description={
              sport === "horse_racing"
                ? "This day's cards will appear here."
                : "This day's list will appear here."
            }
          />
        ) : sport === "football" && footballGroups.length > 0 ? (
          <div className="space-y-4">
            {footballGroups.map((group) => (
              <FootballCompetitionSection
                key={group.id}
                scopeId={group.id}
                competition={group.competition}
                title={group.title}
                label={group.label}
                leagueCountry={group.leagueCountry}
                fixtures={group.fixtures}
                onOpenTape={setTapeEvent}
                eventIdByExternalId={eventIdByExternalId}
                displayTimezone={displayTimezone}
                favourite={favouriteSet.has(group.id)}
                onToggleFavourite={() => toggleFavourite(group.id)}
                hidden={hiddenSet.has(group.id)}
                onToggleHidden={() => toggleHidden(group.id)}
              />
            ))}
          </div>
        ) : sport === "horse_racing" && racingGroups.length > 0 ? (
          <div className="space-y-4">
            {racingGroups.map((group) => (
              <RacingCourseSection
                key={group.course}
                course={group.course}
                region={group.region}
                races={group.races}
                trackedExternalIds={trackedExternalIds}
                onOpenTape={setTapeRace}
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
        ) : (
          <EmptyState
            compact={emptyCompact}
            icon={CalendarDays}
            title={emptyCopy.title}
            description={emptyCopy.description}
            action={
              scopeFilter !== "all" || favouritesOnly
                ? {
                    label: "Show all",
                    variant: "secondary",
                    onClick: () => {
                      setFavouritesOnly(false);
                      setScopeFilter("all");
                    },
                  }
                : undefined
            }
            secondaryAction={
              scopeFilter !== "all"
                ? {
                    label: "Show pinned",
                    variant: "secondary",
                    onClick: () => {
                      setFavouritesOnly(true);
                      setScopeFilter("all");
                    },
                  }
                : undefined
            }
          />
        );

  return (
    <TooltipProvider delayDuration={200}>
      {tapeEvent ? (
        <FootballLiveTapeDialog
          event={tapeEvent}
          open
          tracked={Boolean(
            tapeEvent.id ??
              (tapeEvent.externalId
                ? eventIdByExternalId.get(tapeEvent.externalId)
                : undefined)
          )}
          onTrack={() => {
            const fixture = football.find(
              (row) => row.externalId === tapeEvent.externalId
            );
            if (fixture) onTrackFixture(fixture);
          }}
          onAddBet={() => {
            const fixture = football.find(
              (row) => row.externalId === tapeEvent.externalId
            );
            setTapeEvent(null);
            if (fixture) onTrackAndBetFixture(fixture);
          }}
          onEpDesk={() => {
            const fixture = football.find(
              (row) => row.externalId === tapeEvent.externalId
            );
            setTapeEvent(null);
            if (fixture) onEpDesk(fixture);
          }}
          onOpenChange={(open) => {
            if (!open) setTapeEvent(null);
          }}
        />
      ) : null}
      {tapeRace ? (
        <RacingResultTapeDialog
          race={
            racing.find((row) => row.externalId === tapeRace.externalId) ?? tapeRace
          }
          open
          tracked={trackedExternalIds.has(tapeRace.externalId)}
          displayTimezone={displayTimezone}
          onTrack={() => {
            const race =
              racing.find((row) => row.externalId === tapeRace.externalId) ?? tapeRace;
            onTrackRace(race);
          }}
          onAddBet={() => {
            const race =
              racing.find((row) => row.externalId === tapeRace.externalId) ?? tapeRace;
            setTapeRace(null);
            onTrackAndBetRace(race);
          }}
          onOpenChange={(open) => {
            if (!open) setTapeRace(null);
          }}
        />
      ) : null}
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
        <div className="relative z-10 shrink-0">
          {pageHeader}
          {sportControl ? <div className="w-full min-w-0">{sportControl}</div> : null}
          <div className="w-full min-w-0 py-4">{slice}</div>
        </div>
        <div className="relative flex min-h-0 min-w-0 flex-1 gap-[var(--layout-page-x)]">
          <ScrollFadeEdges
            className="my-4 min-h-0 min-w-0 flex-1"
            fadeClassName="from-page"
            fadeSize={FIXTURE_TAPE_GUTTER_PX}
            overlayScrollbar
            pinScrollStart
            scrollStartKey={`${listKey ?? ""}:${sport}:${statusFilter}:${scopeFilter}:${favouritesOnly ? "pins" : "all"}`}
            scrollClassName="app-scroll-float"
          >
            {body}
          </ScrollFadeEdges>
          {showPinRail ? (
            <aside className="my-4 hidden min-h-0 w-56 shrink-0 lg:block">
              <ScrollFadeEdges
                className="min-h-0 h-full"
                fadeClassName="from-page"
                fadeSize={FIXTURE_TAPE_GUTTER_PX}
                overlayScrollbar
                pinScrollStart
                scrollStartKey={`${listKey ?? ""}:${sport}:${scopeFilter}:${favouritesOnly ? "pins" : "all"}`}
                scrollClassName="app-scroll-float"
              >
                {settingsReady ? (
                  rail
                ) : (
                  <div
                    className="flex justify-center py-8"
                    role="status"
                    aria-label={`Loading pinned ${pinnedNoun}`}
                  >
                    <Loader2
                      className="size-5 animate-spin text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                )}
              </ScrollFadeEdges>
            </aside>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
