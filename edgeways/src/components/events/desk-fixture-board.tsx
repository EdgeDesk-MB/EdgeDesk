"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { statStripFiveColWidth } from "@/components/layout/stat-strip";
import { TrackToggleButton } from "@/components/events/track-toggle-button";
import { FavouriteStar } from "@/components/events/favourite-star";
import { HideScopeButton } from "@/components/events/hide-scope-button";
import { FixtureScopeFilter } from "@/components/events/fixture-scope-filter";
import { FixtureSavedRail } from "@/components/events/fixture-saved-rail";
import {
  ExchangeBackStack,
  validTapeBack,
} from "@/components/events/exchange-back-tags";
import {
  TwoupEdgeMark,
  TwoupFitTickSlot,
  TwoupOpennessMeter,
  twoupSideFitSummary,
  twoupSideIsEdgePick,
} from "@/components/events/twoup-openness-meter";
import { PlanLockEmpty } from "@/components/plan-lock-empty";
import { api, useAppState } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import { useLocalTapeGoalPreview, useTapeGoalFlash } from "@/hooks/use-tape-goal-flash";
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
import { FootballIcon, SportIcon } from "@/components/sport-icon";
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
import {
  twoupHasEdgePick,
  twoupScoutKey,
  twoupTakeWindfallPct,
  type TwoupOpennessResult,
} from "@/lib/calc/ep/twoup-openness";
import { canUseTwoupScout } from "@/lib/entitlements/twoup-scout";
import {
  alignSideBackMarksToFixture,
  eventHasAnyUserBack,
  eventSideBackMark,
  type SideBackMark,
} from "@/lib/events/twoup-backed";
import { footballPhaseLabel, sortFixturesByKickoff, withEffectiveFeedStatus } from "@/lib/events";
import {
  bumpTapeGoalPreviewHome,
  resolveTapeLastGoal,
  tapeGoalPreviewRequested,
} from "@/lib/events/fixture-tape-goal";
import {
  fixtureTapeNameWeightClass,
  footballFinishedNameWeight,
} from "@/lib/events/fixture-result-weight";
import { mergeLiveFixtureOverlay } from "@/lib/events/live-fixture-overlay";
import {
  applyFixtureBoardRail,
  fixtureBoardSportView,
  mergeFixtureBoardView,
  normalizeFixtureBoardView,
} from "@/lib/events/fixture-board-view";
import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/display-timezone";
import { formatClockTime } from "@/lib/time-format";
import {
  FIXTURE_TAPE_GUTTER_PX,
  fixtureTapeClockMin,
  fixtureTapeFootballRow,
  fixtureTapeFootballGrid,
  fixtureTapeFootballGridNoScore,
  fixtureTapeOddsCol,
  fixtureTapeRow,
  fixtureTapeRowGrid,
  fixtureTapeSectionBar,
  fixtureTapeSectionBody,
  fixtureTapeSectionHover,
  fixtureTapeScoreboard,
  fixtureTapeScoreboardCell,
  fixtureTapeScoreboardCellGoal,
  fixtureTapeScoreboardCellLive,
  fixtureTapeScoreboardLive,
  fixtureTapeScoreboardRest,
  fixtureTapeScoreboardRuleLive,
  fixtureTapeScoreboardRuleRest,
  fixtureTapeScoreLead,
  fixtureTapeStatusLine,
  fixtureTapeStatusMeta,
  fixtureTapeStatusStack,
  fixtureTapeTeamLine,
  fixtureTapeTeamStack,
  fixtureTapeTrackCol,
  twoupTickSlotBox,
  favouriteStarIcon,
  backedNavTag,
  tapeGoalTag,
  filterPillCountState,
  filterPillGroup,
  listRowGroup,
  sectionTitle,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, ChevronDown, Flame, Loader2, NotebookPen, Pin, Radio, Zap } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";

export type FixtureStatusFilter = "all" | "live" | "scheduled" | "picks";

function matchesStatusFilter(
  status: "upcoming" | "live" | "finished",
  filter: FixtureStatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "live") return status === "live";
  if (filter === "picks" || filter === "scheduled") return status === "upcoming";
  return status === "upcoming";
}

function fixtureScoutKey(fixture: Fixture): string {
  return twoupScoutKey({
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    startTime: fixture.startTime,
  });
}

function fixtureHasTwoupEdgePick(
  fixture: Fixture,
  scoutByKey: Map<string, TwoupOpennessResult>
): boolean {
  if (fixture.status !== "upcoming") return false;
  return twoupHasEdgePick(scoutByKey.get(fixtureScoutKey(fixture)));
}

function sortFixturesByTwoupPick(
  fixtures: Fixture[],
  scoutByKey: Map<string, TwoupOpennessResult>
): Fixture[] {
  return [...fixtures].sort((a, b) => {
    const awayFirst =
      (twoupTakeWindfallPct(scoutByKey.get(fixtureScoutKey(b))) ?? 0) -
      (twoupTakeWindfallPct(scoutByKey.get(fixtureScoutKey(a))) ?? 0);
    if (awayFirst !== 0) return awayFirst;
    return a.startTime - b.startTime;
  });
}

const TWOUP_PICKS_EMPTY =
  "A Fair or Strong take on a pinned match.";
const TWOUP_PICKS_EMPTY_RETRY =
  "A Fair or Strong take on a pinned match. Try another day, or show all.";

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
  backedOnly?: boolean,
) {
  if (loadFailed) return { title: emptyTitle, description: emptyDescription };
  if (backedOnly) {
    const statusBit =
      statusFilter === "live"
        ? sport === "horse_racing"
          ? "live races"
          : "live fixtures"
        : statusFilter === "scheduled"
          ? sport === "horse_racing"
            ? "scheduled races"
            : "scheduled fixtures"
          : statusFilter === "picks"
            ? "2UP picks"
            : sport === "horse_racing"
              ? "races"
              : "fixtures";
    return {
      title: `No backed ${statusBit}`,
      description:
        sport === "horse_racing"
          ? "None of today's cards have a desk back. Show all, or try another day."
          : "None of today's matches have a desk back. Show all, or try another day.",
    };
  }
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
    if (statusFilter === "picks") {
      return {
        title: "No 2UP picks in Pinned only",
        description:
          TWOUP_PICKS_EMPTY_RETRY,
      };
    }
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
  if (statusFilter === "picks") {
    return {
      title: favouritesOnly && !hasFavouritePins
        ? "No pinned competitions"
        : `No 2UP picks${scoped}`,
      description:
        favouritesOnly && !hasFavouritePins
          ? "Pin a competition. 2UP picks come from the competitions you follow."
          : scopeLabel || favouritesOnly
            ? TWOUP_PICKS_EMPTY_RETRY
            : TWOUP_PICKS_EMPTY,
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
  onUntrack,
  onTrackAndBet,
  onEpDesk,
  showEpDesk,
  twoUpActionLabel = "Early-payout Desk",
}: {
  isTracked: boolean;
  onTrack: () => void;
  onUntrack: () => void;
  onTrackAndBet: () => void;
  onEpDesk?: () => void;
  showEpDesk?: boolean;
  twoUpActionLabel?: string;
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
              aria-label={twoUpActionLabel}
              onClick={onEpDesk}
            >
              <Flame className="size-4 text-warning" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" sideOffset={6}>
            {twoUpActionLabel}
          </TooltipContent>
        </Tooltip>
      ) : null}
      <TrackToggleButton
        appearance="icon"
        tracked={isTracked}
        onTrack={onTrack}
        onUntrack={onUntrack}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={isTracked ? "Add bet on this event" : "Track and add bet"}
            onClick={onTrackAndBet}
          >
            <NotebookPen className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {isTracked ? "Add bet" : "Track and add bet"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

const tapeFigureRestTimings = {
  transformTiming: { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  spinTiming: { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  opacityTiming: { duration: 100, easing: "ease-out" },
} as const;

const tapeFigureGoalTimings = {
  transformTiming: { duration: 750, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  spinTiming: { duration: 750, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  opacityTiming: { duration: 250, easing: "ease-out" },
} as const;

function TapeScoreFigure({
  value,
  scored,
  live,
}: {
  value: number;
  scored?: boolean;
  live: boolean;
}) {
  return (
    <span
      className={cn(
        fixtureTapeScoreboardCell,
        live && (scored ? fixtureTapeScoreboardCellGoal : fixtureTapeScoreboardCellLive)
      )}
    >
      <NumberFlow
        value={value}
        {...(scored ? { trend: 1 as const, ...tapeFigureGoalTimings } : tapeFigureRestTimings)}
        format={{ useGrouping: false, maximumFractionDigits: 0 }}
        className="translate-y-[-1px] tabular-nums leading-none"
      />
    </span>
  );
}

function FixtureScoreboard({
  home,
  away,
  live,
  homeScored,
  awayScored,
}: {
  home?: number | null;
  away?: number | null;
  live: boolean;
  homeScored?: boolean;
  awayScored?: boolean;
}) {
  return (
    <div
      className={cn(
        fixtureTapeScoreboard,
        live ? fixtureTapeScoreboardLive : fixtureTapeScoreboardRest
      )}
      aria-label={
        live
          ? `Live ${home ?? 0}–${away ?? 0}`
          : `Full time ${home ?? 0}–${away ?? 0}`
      }
    >
      <TapeScoreFigure
        value={home ?? 0}
        scored={homeScored}
        live={live}
      />
      <div
        className={cn(
          "h-px",
          live ? fixtureTapeScoreboardRuleLive : fixtureTapeScoreboardRuleRest
        )}
        aria-hidden
      />
      <TapeScoreFigure
        value={away ?? 0}
        scored={awayScored}
        live={live}
      />
    </div>
  );
}

function TapeGoalMark({ team }: { team: string }) {
  return (
    <span
      className={cn(tapeGoalTag, "animate-tape-goal-tag shrink-0")}
      aria-label={`${team} scored`}
    >
      Goal
    </span>
  );
}

function tapeClockClass(live: boolean, align: "end" | "start" = "end") {
  return cn(
    "flex items-center gap-1 text-sm font-semibold tabular-nums leading-none",
    align === "start"
      ? cn("shrink-0 justify-start text-left", fixtureTapeClockMin)
      : "shrink-0 justify-end text-right",
    live ? "text-profit" : "text-muted-foreground"
  );
}

function fixtureTapeEvent(
  fixture: Fixture,
  eventId?: number,
  goalSeed?: FootballTapeDialogEvent["goalSeed"]
): FootballTapeDialogEvent {
  const extra = fixture as Fixture & {
    period?: string | null;
    matchEnding?: "ft" | "aet" | "pen" | null;
  };
  return {
    id: eventId,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    status: fixture.status,
    minute: fixture.minute,
    period: extra.period ?? undefined,
    matchEnding: extra.matchEnding ?? undefined,
    startTime: fixture.startTime,
    competition: fixture.competition,
    leagueCountry: fixture.leagueCountry,
    externalId: fixture.externalId,
    source: "api",
    sport: "football",
    lastGoalSide: fixture.lastGoalSide,
    lastGoalMinute: fixture.lastGoalMinute,
    goalSeed:
      goalSeed && (goalSeed.home || goalSeed.away) && !(goalSeed.home && goalSeed.away)
        ? goalSeed
        : undefined,
  };
}

function liveTapeDialogEvent(
  tape: FootballTapeDialogEvent,
  fixtures: Fixture[]
): FootballTapeDialogEvent {
  const row = fixtures.find((fixture) => fixture.externalId === tape.externalId);
  if (!row) return tape;
  const extra = row as Fixture & {
    period?: string | null;
    matchEnding?: "ft" | "aet" | "pen" | null;
  };
  return {
    ...tape,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    status: row.status,
    minute: row.minute,
    period: extra.period ?? tape.period,
    matchEnding: extra.matchEnding ?? tape.matchEnding,
    lastGoalSide: extra.lastGoalSide ?? tape.lastGoalSide,
    lastGoalMinute: extra.lastGoalMinute ?? tape.lastGoalMinute,
  };
}

function fixtureTeamBack(
  fixture: Fixture,
  eventId: number | undefined,
  teamBackByEventId: Map<number, { home: SideBackMark | null; away: SideBackMark | null }>,
  footballEventById: Map<
    number,
    { homeTeam: string; awayTeam: string; goals?: string | null }
  >
) {
  if (eventId == null) return undefined;
  const marks = teamBackByEventId.get(eventId);
  const event = footballEventById.get(eventId);
  if (!marks || !event) return marks;
  return alignSideBackMarksToFixture(event, fixture, marks);
}

function FixtureBackedTag({ mark }: { mark: SideBackMark | null | undefined }) {
  if (!mark) return null;
  const detail =
    mark.kind === "open"
      ? mark.betCount > 1
        ? `${mark.betCount} open bets on this team`
        : "Open bet on this team"
      : mark.betCount > 1
        ? `${mark.betCount} settled bets on this team`
        : "Settled bet on this team";
  return (
    <span className={cn(backedNavTag, "shrink-0")} title={detail} aria-label={detail}>
      <Check className="size-3 stroke-[2.5]" aria-hidden />
      Backed
      {mark.betCount > 1 ? ` · ${mark.betCount}` : ""}
    </span>
  );
}

function fixtureTapeScout(
  fixture: Fixture,
  scoutByKey?: Map<string, TwoupOpennessResult>
): TwoupOpennessResult | null {
  return (
    scoutByKey?.get(
      twoupScoutKey({
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        startTime: fixture.startTime,
      })
    ) ?? null
  );
}

function FootballTapeStatus({
  fixture,
  displayTimezone,
}: {
  fixture: Fixture;
  displayTimezone: string;
}) {
  const live = fixture.status === "live";
  const kickoff = formatClockTime(fixture.startTime, { timeZone: displayTimezone });
  const phase = footballPhaseLabel(fixture) ?? (live ? "Live" : null);
  return (
    <div className={fixtureTapeStatusStack}>
      <span className={fixtureTapeStatusLine}>{kickoff}</span>
      {phase ? (
        <span
          className={cn(
            fixtureTapeStatusMeta,
            live ? "text-profit" : "text-muted-foreground"
          )}
        >
          {phase}
        </span>
      ) : null}
    </div>
  );
}

function FootballTapeRow({
  fixture,
  eventId,
  displayTimezone,
  scope,
  onOpenTape,
  showMeter,
  scout,
  scoutLoading,
  homeBack,
  awayBack,
  tracked,
  onTrack,
  onUntrack,
  goalPreview,
  trackedGoals,
}: {
  fixture: Fixture;
  eventId?: number;
  displayTimezone: string;
  scope?: string;
  onOpenTape: (event: FootballTapeDialogEvent) => void;
  showMeter?: boolean;
  scout?: TwoupOpennessResult | null;
  scoutLoading?: boolean;
  homeBack?: SideBackMark | null;
  awayBack?: SideBackMark | null;
  tracked?: boolean;
  onTrack?: () => void;
  onUntrack?: () => void;
  goalPreview?: boolean;
  trackedGoals?: string | null;
}) {
  const live = fixture.status === "live";
  const rowRef = useRef<HTMLLIElement>(null);
  const upcoming = fixture.status === "upcoming";
  const finished = fixture.status === "finished";
  const lastGoal = resolveTapeLastGoal(
    { home: fixture.homeScore ?? 0, away: fixture.awayScore ?? 0 },
    trackedGoals,
    fixture
  );
  const goalFlash = useTapeGoalFlash(
    fixture.externalId ?? fixtureScoutKey(fixture),
    fixture.homeScore ?? 0,
    fixture.awayScore ?? 0,
    live,
    undefined,
    lastGoal,
    fixture.minute
  );
  useEffect(() => {
    if (!goalPreview) return;
    rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [goalPreview]);
  const canTrack = !finished;
  const showOdds =
    validTapeBack(scout?.markets.home) || validTapeBack(scout?.markets.away);
  function fitMeter(side: "home" | "away") {
    if (!showMeter) {
      return (
        <span
          className="w-0 shrink-0 overflow-hidden"
          style={{ height: twoupTickSlotBox("list").height }}
          aria-hidden
        />
      );
    }
    return (
      <TwoupFitTickSlot>
        <TwoupOpennessMeter
          result={scout}
          loading={scoutLoading}
          side={side}
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
        />
      </TwoupFitTickSlot>
    );
  }

  return (
    <li
      ref={rowRef}
      className={cn(fixtureTapeFootballRow, "cursor-pointer")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        onOpenTape(
          fixtureTapeEvent(
            fixture,
            eventId,
            goalFlash.home || goalFlash.away ? goalFlash : undefined
          )
        );
      }}
    >
      <div className={upcoming ? fixtureTapeFootballGridNoScore : fixtureTapeFootballGrid}>
        <FootballTapeStatus fixture={fixture} displayTimezone={displayTimezone} />
        {upcoming ? null : (
          <div className={fixtureTapeScoreLead}>
            <FixtureScoreboard
              home={fixture.homeScore}
              away={fixture.awayScore}
              live={live}
              homeScored={goalFlash.home}
              awayScored={goalFlash.away}
            />
          </div>
        )}
        <div className="min-w-0">
        <div className={fixtureTapeTeamStack}>
          <span className={fixtureTapeTeamLine}>
            <TeamCrest src={fixture.homeLogo} alt={fixture.homeTeam} />
            <span
              className={cn(
                "min-w-0 truncate",
                fixtureTapeNameWeightClass(
                  footballFinishedNameWeight("home", fixture)
                )
              )}
              title={fixture.homeTeam}
            >
              {fixture.homeTeam}
            </span>
            {goalFlash.home ? <TapeGoalMark team={fixture.homeTeam} /> : null}
            {fitMeter("home")}
            {showMeter && !scoutLoading && twoupSideIsEdgePick(scout, "home") ? (
              <TwoupEdgeMark />
            ) : null}
            <FixtureBackedTag mark={homeBack} />
          </span>
          <span className={fixtureTapeTeamLine}>
            <TeamCrest src={fixture.awayLogo} alt={fixture.awayTeam} />
            <span
              className={cn(
                "min-w-0 truncate",
                fixtureTapeNameWeightClass(
                  footballFinishedNameWeight("away", fixture)
                )
              )}
              title={fixture.awayTeam}
            >
              {fixture.awayTeam}
            </span>
            {goalFlash.away ? <TapeGoalMark team={fixture.awayTeam} /> : null}
            {fitMeter("away")}
            {showMeter && !scoutLoading && twoupSideIsEdgePick(scout, "away") ? (
              <TwoupEdgeMark />
            ) : null}
            <FixtureBackedTag mark={awayBack} />
          </span>
        </div>
        {scope ? (
          <p className="mt-0.5 min-w-0 truncate text-xs text-muted-foreground" title={scope}>
            {scope}
          </p>
        ) : null}
        </div>
        <div className={cn(fixtureTapeOddsCol, "justify-self-end")}>
          {showOdds ? (
            <ExchangeBackStack
              homeOdds={scout?.markets.home}
              awayOdds={scout?.markets.away}
              homeLabel={fixture.homeTeam}
              awayLabel={fixture.awayTeam}
              chevronSide="left"
            />
          ) : null}
        </div>
        <div className={fixtureTapeTrackCol}>
          {canTrack ? (
            <TrackToggleButton
              appearance="icon"
              tracked={Boolean(tracked)}
              onTrack={onTrack}
              onUntrack={onUntrack}
            />
          ) : null}
        </div>
      </div>
      <button
        type="button"
        className="sr-only"
        onClick={() =>
          onOpenTape(
            fixtureTapeEvent(
              fixture,
              eventId,
              goalFlash.home || goalFlash.away ? goalFlash : undefined
            )
          )
        }
      >
        Open match events for {fixture.homeTeam} v {fixture.awayTeam}
        {homeBack ? `. ${fixture.homeTeam} backed` : null}
        {awayBack ? `. ${fixture.awayTeam} backed` : null}
        {showMeter
          ? `. ${twoupSideFitSummary({
              result: scout,
              loading: scoutLoading,
              side: "home",
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
            })}. ${twoupSideFitSummary({
              result: scout,
              loading: scoutLoading,
              side: "away",
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
            })}`
          : null}
      </button>
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
  onUntrack,
  onTrackAndBet,
}: {
  race: RacingFixture;
  tracked: boolean;
  displayTimezone: string;
  scope?: string;
  onOpenTape: (race: RacingFixture) => void;
  onTrack: (race: RacingFixture) => void;
  onUntrack: (race: RacingFixture) => void;
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
        <span className={tapeClockClass(live, "start")}>
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
          onUntrack={() => onUntrack(race)}
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
  expandLabel,
  columns = "flex",
  children,
}: {
  open: boolean;
  onToggle: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
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
          fixtureTapeSectionBar,
          "grid grid-cols-[auto_minmax(0,1fr)_2rem] items-center",
          fixtureTapeSectionHover,
        )}
      >
        <div className="pr-2">{leading}</div>
        <div className="flex min-w-0 items-center gap-3">
          {titleButton}
          {trailing}
        </div>
        {chevron}
      </div>
    );
  }

  return (
    <div
      className={cn(
        fixtureTapeSectionBar,
        "flex w-full items-center gap-3",
        fixtureTapeSectionHover,
      )}
    >
      {leading}
      {titleButton}
      {trailing}
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
  teamBackByEventId,
  footballEventById,
  displayTimezone,
  favourite,
  onToggleFavourite,
  hidden,
  onToggleHidden,
  empty,
  showScout,
  unlockOdds,
  scoutByKey,
  scoutLoading,
  trackedExternalIds,
  onTrackFixture,
  onUntrackFixture,
  goalPreviewKey,
}: {
  scopeId: string;
  competition: string;
  title: string;
  label: string;
  leagueCountry?: string | null;
  fixtures: Fixture[];
  onOpenTape: (event: FootballTapeDialogEvent) => void;
  eventIdByExternalId: Map<string, number>;
  teamBackByEventId: Map<number, { home: SideBackMark | null; away: SideBackMark | null }>;
  footballEventById: Map<
    number,
    { homeTeam: string; awayTeam: string; goals?: string | null }
  >;
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
  showScout?: boolean;
  unlockOdds?: boolean;
  scoutByKey?: Map<string, TwoupOpennessResult>;
  scoutLoading?: boolean;
  trackedExternalIds: Set<string>;
  onTrackFixture: (fixture: Fixture) => void;
  onUntrackFixture: (fixture: Fixture) => void;
  goalPreviewKey?: string | null;
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
          <FavouriteStar
            favourite={favourite}
            label={label}
            onToggle={onToggleFavourite}
            unlockOdds={unlockOdds}
          />
        }
        trailing={
          hidden || !favourite ? (
            <HideScopeButton hidden={hidden} label={label} onToggle={onToggleHidden} />
          ) : null
        }
        expandLabel={countCopy.aria ? `Expand, ${countCopy.aria}` : undefined}
      >
        <p id={headingId} className={cn(sectionTitle, "flex min-w-0 items-center gap-2")}>
          <CompetitionHeaderIcon
            competition={competition}
            leagueCountry={leagueCountry}
          />
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex min-w-0 items-baseline gap-1.5 truncate" title={label}>
              {heading.country ? (
                <>
                  <span className="shrink-0">{heading.country}</span>
                  <span className="shrink-0">-</span>
                </>
              ) : null}
              <span className="min-w-0 truncate">{heading.name}</span>
            </span>
            {!open ? <CollapsedScopeCount items={fixtures} /> : null}
          </span>
        </p>
      </CollapsibleSectionHeader>
      {open ? (
        <div className={cn(fixtureTapeSectionBody, fixtures.length === 0 && empty && "p-4")}>
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
              {fixtures.map((fixture) => {
                const eventId = eventIdByExternalId.get(fixture.externalId);
                const teamBack = fixtureTeamBack(
                  fixture,
                  eventId,
                  teamBackByEventId,
                  footballEventById
                );
                return (
                  <FootballTapeRow
                    key={fixture.externalId}
                    fixture={fixture}
                    displayTimezone={displayTimezone}
                    onOpenTape={onOpenTape}
                    eventId={eventId}
                    homeBack={teamBack?.home}
                    awayBack={teamBack?.away}
                    showMeter={Boolean(showScout && fixture.status === "upcoming")}
                    scout={fixtureTapeScout(fixture, scoutByKey)}
                    scoutLoading={scoutLoading}
                    tracked={trackedExternalIds.has(fixture.externalId)}
                    onTrack={() => onTrackFixture(fixture)}
                    onUntrack={() => onUntrackFixture(fixture)}
                    trackedGoals={eventId != null ? footballEventById.get(eventId)?.goals : undefined}
                    goalPreview={
                      (fixture.externalId ?? fixtureScoutKey(fixture)) ===
                      goalPreviewKey
                    }
                  />
                );
              })}
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
  onUntrack,
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
  onUntrack: (race: RacingFixture) => void;
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
        columns="match"
        leading={
          <FavouriteStar favourite={favourite} label={course} onToggle={onToggleFavourite} />
        }
        trailing={
          hidden || !favourite ? (
            <HideScopeButton hidden={hidden} label={course} onToggle={onToggleHidden} />
          ) : null
        }
        expandLabel={countCopy.aria ? `Expand, ${countCopy.aria}` : undefined}
      >
        <p id={headingId} className={cn(sectionTitle, "flex min-w-0 items-center gap-2")}>
          {hasRegionFlag ? (
            <RegionFlag code={region} size="md" />
          ) : (
            <SportIcon sport="horse_racing" size={16} className="text-muted-foreground" />
          )}
          <span className="flex min-w-0 items-center gap-3">
            <span
              className="flex min-w-0 items-baseline gap-1.5 truncate"
              title={`${racingRegionLabel(region).toUpperCase()} - ${course.toUpperCase()}`}
            >
              <span className="shrink-0">{racingRegionLabel(region).toUpperCase()}</span>
              <span className="shrink-0">-</span>
              <span className="min-w-0 truncate">{course.toUpperCase()}</span>
            </span>
            {!open ? <CollapsedScopeCount items={races} /> : null}
          </span>
        </p>
      </CollapsibleSectionHeader>

      {open ? (
        <div className={cn(fixtureTapeSectionBody, races.length === 0 && empty && "p-4")}>
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
                  onUntrack={onUntrack}
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
  teamBackByEventId,
  footballEventById,
  displayTimezone,
  showScope = true,
  favouriteScopeIds,
  showScout,
  scoutByKey,
  scoutLoading,
  trackedExternalIds,
  onTrackFixture,
  onUntrackFixture,
}: {
  fixtures: Fixture[];
  onOpenTape: (event: FootballTapeDialogEvent) => void;
  eventIdByExternalId: Map<string, number>;
  teamBackByEventId: Map<number, { home: SideBackMark | null; away: SideBackMark | null }>;
  footballEventById: Map<
    number,
    { homeTeam: string; awayTeam: string; goals?: string | null }
  >;
  displayTimezone: string;
  showScope?: boolean;
  favouriteScopeIds?: Set<string>;
  showScout?: boolean;
  scoutByKey?: Map<string, TwoupOpennessResult>;
  scoutLoading?: boolean;
  trackedExternalIds: Set<string>;
  onTrackFixture: (fixture: Fixture) => void;
  onUntrackFixture: (fixture: Fixture) => void;
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
          const eventId = eventIdByExternalId.get(fixture.externalId);
          const teamBack = fixtureTeamBack(
            fixture,
            eventId,
            teamBackByEventId,
            footballEventById
          );
          return (
            <FootballTapeRow
              key={fixture.externalId}
              fixture={fixture}
              displayTimezone={displayTimezone}
              scope={scope}
              onOpenTape={onOpenTape}
              eventId={eventId}
              homeBack={teamBack?.home}
              awayBack={teamBack?.away}
              showMeter={Boolean(
                showScout &&
                  fixture.status === "upcoming" &&
                  favouriteScopeIds?.has(
                    footballScopeId(fixture.competition, fixture.leagueCountry)
                  )
              )}
              scout={fixtureTapeScout(fixture, scoutByKey)}
              scoutLoading={scoutLoading}
              tracked={trackedExternalIds.has(fixture.externalId)}
              onTrack={() => onTrackFixture(fixture)}
              onUntrack={() => onUntrackFixture(fixture)}
              trackedGoals={eventId != null ? footballEventById.get(eventId)?.goals : undefined}
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
  onUntrack,
  onTrackAndBet,
  displayTimezone,
  showScope = true,
}: {
  races: RacingFixture[];
  trackedExternalIds: Set<string>;
  onOpenTape: (race: RacingFixture) => void;
  onTrack: (race: RacingFixture) => void;
  onUntrack: (race: RacingFixture) => void;
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
            onUntrack={onUntrack}
            onTrackAndBet={onTrackAndBet}
          />
        ))}
      </ul>
    </div>
  );
}

export function DeskFixtureBoard({
  sport,
  football: footballRaw,
  competitions = [],
  racing: racingRaw,
  trackedExternalIds,
  onTrackFixture,
  onUntrackFixture,
  onTrackAndBetFixture,
  onAddBetFixture,
  onEpDesk,
  onTrackRace,
  onUntrackRace,
  onTrackAndBetRace,
  onAddBetRace,
  emptyTitle,
  emptyDescription,
  loading = false,
  loadFailed = false,
  displayTimezone = DEFAULT_DISPLAY_TIMEZONE,
  emptyCompact = true,
  dayControl = null,
  pinDayControl = false,
  listKey,
  sportControl = null,
  pageHeader = null,
  persistView = true,
  statusOverride,
  trackedOnly = false,
  hideStatusPills = false,
  twoUpActionLabel = "Early-payout Desk",
  onPicksCount,
  className,
}: {
  sport: "football" | "horse_racing";
  football: Fixture[];
  competitions?: FootballCompetition[];
  racing: RacingFixture[];
  trackedExternalIds: Set<string>;
  onTrackFixture: (fixture: Fixture) => void;
  onUntrackFixture: (fixture: Fixture) => void;
  onTrackAndBetFixture: (fixture: Fixture) => void;
  onAddBetFixture: (fixture: Fixture) => void;
  onEpDesk: (fixture: Fixture) => void;
  onTrackRace: (race: RacingFixture) => void;
  onUntrackRace: (race: RacingFixture) => void;
  onTrackAndBetRace: (race: RacingFixture) => void;
  onAddBetRace: (race: RacingFixture) => void;
  emptyTitle: string;
  emptyDescription: string;
  loading?: boolean;
  loadFailed?: boolean;
  displayTimezone?: string;
  emptyCompact?: boolean;
  dayControl?: ReactNode | ((opts: { stretch?: boolean }) => ReactNode);
  /** Early-payout Desk: day stepper and Filter sit at the top of the pin rail on lg.
   *  Rail is one StatStrip column wide; gutter to the tape is `--layout-page-x`. */
  pinDayControl?: boolean;
  /** Day identity for re-pinning the tape (UK date). */
  listKey?: string;
  sportControl?: ReactNode;
  /** Page title band. Sticks with the sport tabs and feed bar. */
  pageHeader?: ReactNode;
  /** When false, status and rail stay local so 2UP Desk does not rewrite Fixtures prefs. */
  persistView?: boolean;
  statusOverride?: FixtureStatusFilter;
  trackedOnly?: boolean;
  hideStatusPills?: boolean;
  twoUpActionLabel?: string;
  onPicksCount?: (count: number) => void;
  className?: string;
}) {
  const { state, applyLocalSettingsPatch } = useAppState();
  const now = useNow(15_000);
  const footballBase = useMemo(() => {
    const tracked = (state?.events ?? []).filter(
      (event) => event.externalId && (event.sport ?? "football") !== "horse_racing"
    );
    const merged = mergeLiveFixtureOverlay(footballRaw, tracked).map((fixture) =>
      withEffectiveFeedStatus(fixture, now)
    );
    if (!trackedOnly) return merged;
    return merged.filter(
      (fixture) => fixture.externalId != null && trackedExternalIds.has(fixture.externalId)
    );
  }, [footballRaw, now, state?.events, trackedOnly, trackedExternalIds]);
  const livePreviewKeys = useMemo(() => {
    const live = footballBase.filter((fixture) => fixture.status === "live");
    const first = live[0];
    if (!first) return [];
    const scope = footballScopeId(first.competition, first.leagueCountry);
    const peers = live.filter(
      (fixture) =>
        footballScopeId(fixture.competition, fixture.leagueCountry) === scope
    );
    const pick = peers.length >= 2 ? peers.slice(0, 2) : live.slice(0, 2);
    return pick.map((fixture) => fixture.externalId ?? fixtureScoutKey(fixture));
  }, [footballBase]);
  const goalPreviewKeys = useLocalTapeGoalPreview(livePreviewKeys);
  const football = useMemo(() => {
    if (goalPreviewKeys.length === 0) return footballBase;
    const bump = new Set(goalPreviewKeys);
    return footballBase.map((fixture) => {
      const key = fixture.externalId ?? fixtureScoutKey(fixture);
      return bump.has(key) ? bumpTapeGoalPreviewHome(fixture) : fixture;
    });
  }, [footballBase, goalPreviewKeys]);
  const racing = useMemo(
    () => racingRaw.map((race) => withEffectiveFeedStatus(race, now)),
    [racingRaw, now]
  );
  const boardView = normalizeFixtureBoardView(state?.settings.fixtureBoardView);
  const sportView = fixtureBoardSportView(boardView, sport);
  const [statusFilter, setStatusFilter] = useState<FixtureStatusFilter>(sportView.status);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!tapeGoalPreviewRequested(window.location.hostname, window.location.search)) {
      return;
    }
    setStatusFilter("live");
  }, []);
  const [scopeFilter, setScopeFilter] = useState(
    () => applyFixtureBoardRail(sportView.rail).scopeFilter
  );
  const [favouritesOnly, setFavouritesOnly] = useState(
    () => applyFixtureBoardRail(sportView.rail).favouritesOnly
  );
  const [backedOnly, setBackedOnly] = useState(
    () => applyFixtureBoardRail(sportView.rail).backedOnly
  );
  const [scoutByKey, setScoutByKey] = useState<Map<string, TwoupOpennessResult>>(
    () => new Map()
  );
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutFailed, setScoutFailed] = useState(false);
  const [scoutRetry, setScoutRetry] = useState(0);
  const [scoutLocked, setScoutLocked] = useState(false);
  const canScoutPlan = canUseTwoupScout(state?.settings);
  const canScout = canScoutPlan && !scoutLocked;
  if (!canScoutPlan && statusFilter === "picks") {
    setStatusFilter("all");
  }
  const scoutReadyRef = useRef(false);
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

  const sportViewKey = `${sport}\0${sportView.rail}\0${sportView.status}\0${statusOverride ?? ""}\0${persistView}`;
  const [appliedViewKey, setAppliedViewKey] = useState(sportViewKey);
  if (appliedViewKey !== sportViewKey) {
    setAppliedViewKey(sportViewKey);
    if (persistView) {
      const nextRail = applyFixtureBoardRail(sportView.rail);
      setFavouritesOnly(nextRail.favouritesOnly);
      setBackedOnly(nextRail.backedOnly);
      setScopeFilter(nextRail.scopeFilter);
    }
    setStatusFilter(statusOverride ?? (persistView ? sportView.status : "all"));
  }
  if (statusOverride && statusFilter !== statusOverride) {
    setStatusFilter(statusOverride);
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
  const footballPinKey = sport === "football" ? favouriteIds.join("\0") : "";

  useEffect(() => {
    if (sport !== "football" || !listKey || footballPinKey.length === 0) {
      scoutReadyRef.current = false;
      setScoutByKey(new Map());
      setScoutLoading(false);
      setScoutFailed(false);
      return;
    }
    if (!canScoutPlan) {
      scoutReadyRef.current = false;
      setScoutByKey(new Map());
      setScoutLoading(false);
      setScoutFailed(false);
      return;
    }
    const scoutDate = listKey;
    let cancelled = false;
    function loadScout() {
      if (!scoutReadyRef.current) setScoutLoading(true);
      setScoutFailed(false);
      void api<{
        source?: string;
        items?: Array<{ key: string; openness: TwoupOpennessResult }>;
      }>(`/api/fixtures/twoup-scout?date=${encodeURIComponent(scoutDate)}`)
        .then((payload) => {
          if (cancelled) return;
          if (payload.source === "locked") {
            setScoutLocked(true);
            setScoutByKey(new Map());
            setScoutFailed(false);
            scoutReadyRef.current = false;
            return;
          }
          if (payload.source === "error") {
            setScoutLocked(false);
            if (!scoutReadyRef.current) setScoutByKey(new Map());
            setScoutFailed(true);
            return;
          }
          setScoutLocked(false);
          setScoutFailed(false);
          const next = new Map<string, TwoupOpennessResult>();
          for (const item of payload.items ?? []) {
            if (item.key && item.openness) next.set(item.key, item.openness);
          }
          setScoutByKey(next);
          scoutReadyRef.current = true;
        })
        .catch(() => {
          if (cancelled) return;
          if (!scoutReadyRef.current) {
            setScoutByKey(new Map());
            setScoutFailed(true);
          }
        })
        .finally(() => {
          if (!cancelled) setScoutLoading(false);
        });
    }
    loadScout();
    const poll = window.setInterval(loadScout, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [canScoutPlan, sport, listKey, footballPinKey, scoutRetry]);
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
  const footballEventById = useMemo(() => {
    const map = new Map<
      number,
      { homeTeam: string; awayTeam: string; goals?: string | null }
    >();
    for (const event of state?.events ?? []) {
      if ((event.sport ?? "football") === "horse_racing") continue;
      map.set(event.id, event);
    }
    return map;
  }, [state?.events]);
  const teamBackByEventId = useMemo(() => {
    const map = new Map<number, { home: SideBackMark | null; away: SideBackMark | null }>();
    const bets = state?.bets ?? [];
    for (const event of state?.events ?? []) {
      if ((event.sport ?? "football") === "horse_racing") continue;
      const home = eventSideBackMark(event, "home", bets);
      const away = eventSideBackMark(event, "away", bets);
      if (home || away) map.set(event.id, { home, away });
    }
    return map;
  }, [state?.bets, state?.events]);
  const backedExternalIds = useMemo(() => {
    const ids = new Set<string>();
    const bets = state?.bets ?? [];
    for (const event of state?.events ?? []) {
      if (!event.externalId) continue;
      if (eventHasAnyUserBack(event, bets)) ids.add(event.externalId);
    }
    return ids;
  }, [state?.bets, state?.events]);

  function persistBoardView(next: {
    rail?: string;
    status?: FixtureStatusFilter;
  }) {
    const current = normalizeFixtureBoardView(state?.settings.fixtureBoardView);
    const side = sport === "horse_racing" ? "racing" : "football";
    if (!persistView) return;
    const fixtureBoardView = mergeFixtureBoardView(current, {
      sport,
      [side]: {
        ...fixtureBoardSportView(current, sport),
        ...(next.rail != null ? { rail: next.rail } : {}),
        ...(next.status != null ? { status: next.status } : {}),
      },
    });
    applyLocalSettingsPatch({ fixtureBoardView });
    void api("/api/settings", { method: "PATCH", json: { fixtureBoardView } }).catch(() => {
      applyLocalSettingsPatch({ fixtureBoardView: current });
    });
  }

  function selectAllRail() {
    setFavouritesOnly(false);
    setBackedOnly(false);
    setScopeFilter("all");
    persistBoardView({ rail: "all" });
  }

  function selectPinnedRail() {
    setFavouritesOnly(true);
    setBackedOnly(false);
    setScopeFilter("all");
    persistBoardView({ rail: "pins" });
  }

  function selectBackedRail() {
    setFavouritesOnly(false);
    setBackedOnly(true);
    setScopeFilter("all");
    persistBoardView({ rail: "backed" });
  }

  function selectScopeRail(id: string) {
    setFavouritesOnly(false);
    setBackedOnly(false);
    setScopeFilter(id);
    persistBoardView({ rail: id });
  }

  function selectStatus(id: FixtureStatusFilter) {
    setStatusFilter(id);
    persistBoardView({ status: id });
  }

  async function persistFavourites(next: string[]) {
    const previous = favouriteIds;
    setFavouriteIds(next);
    const json =
      sport === "football"
        ? { favouriteFootballScopes: next }
        : { favouriteRacingCourses: next };
    applyLocalSettingsPatch(json);
    if (next.length === 0 && favouritesOnly) {
      setFavouritesOnly(false);
      persistBoardView({ rail: "all" });
    }
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
    if (scopeFilter === id && next.includes(id)) {
      setScopeFilter("all");
      persistBoardView({ rail: "all" });
    }
    void persistHidden(next);
  }

  function changeScope(id: string) {
    selectScopeRail(id);
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
    const visible = backedOnly
      ? scoped.filter((f) => backedExternalIds.has(f.externalId))
      : !favouritesOnly
        ? scopeFilter !== "all"
          ? scoped
          : scoped.filter(
              (f) => !hiddenSet.has(footballScopeId(f.competition, f.leagueCountry))
            )
        : scoped.filter((f) =>
            favouriteSet.has(footballScopeId(f.competition, f.leagueCountry))
          );
    if (statusFilter !== "picks") return visible;
    return visible.filter((f) => fixtureHasTwoupEdgePick(f, scoutByKey));
  }, [
    filteredFootball,
    scopeFilter,
    favouritesOnly,
    backedOnly,
    backedExternalIds,
    favouriteSet,
    hiddenSet,
    statusFilter,
    scoutByKey,
  ]);
  const scopedRacing = useMemo(() => {
    const scoped =
      scopeFilter === "all"
        ? filteredRacing
        : filteredRacing.filter((r) => r.course === scopeFilter);
    if (backedOnly) return scoped.filter((r) => backedExternalIds.has(r.externalId));
    if (!favouritesOnly) {
      if (scopeFilter !== "all") return scoped;
      return scoped.filter((r) => !hiddenSet.has(r.course));
    }
    return scoped.filter((r) => favouriteSet.has(r.course));
  }, [
    filteredRacing,
    scopeFilter,
    favouritesOnly,
    backedOnly,
    backedExternalIds,
    favouriteSet,
    hiddenSet,
  ]);

  const footballGroups = useMemo(() => {
    if (sport !== "football") return [];
    const peers = [...football, ...footballCatalogAsFixtures(competitions)];
    const groups = groupFootballByLeague(scopedFootball, peers).map((group) => ({
      ...group,
      fixtures:
        statusFilter === "picks"
          ? sortFixturesByTwoupPick(group.fixtures, scoutByKey)
          : sortFixturesByKickoff(group.fixtures),
    }));
    const withMatches = groups.filter((group) => group.fixtures.length > 0);
    if (statusFilter === "picks") {
      return [...withMatches].sort((a, b) => {
        const topA =
          twoupTakeWindfallPct(scoutByKey.get(fixtureScoutKey(a.fixtures[0]!))) ?? 0;
        const topB =
          twoupTakeWindfallPct(scoutByKey.get(fixtureScoutKey(b.fixtures[0]!))) ?? 0;
        return topB - topA;
      });
    }
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
    statusFilter,
    scoutByKey,
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
    if (backedOnly) return scoped.filter((f) => backedExternalIds.has(f.externalId));
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
    if (backedOnly) return scoped.filter((r) => backedExternalIds.has(r.externalId));
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
  const picksCount =
    sport === "football"
      ? scopedSourceFootball.filter((f) => fixtureHasTwoupEdgePick(f, scoutByKey)).length
      : 0;
  useEffect(() => {
    onPicksCount?.(picksCount);
  }, [onPicksCount, picksCount]);
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
    backedOnly,
  );
  const dayBackedCount =
    sport === "football"
      ? football.filter((f) => backedExternalIds.has(f.externalId)).length
      : racing.filter((r) => backedExternalIds.has(r.externalId)).length;
  useEffect(() => {
    if (state == null || !backedOnly || dayBackedCount > 0) return;
    setFavouritesOnly(false);
    setBackedOnly(false);
    setScopeFilter("all");
    persistBoardView({ rail: "all" });
  }, [state, backedOnly, dayBackedCount]);
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
  const showPinRail = !settingsReady || hasPins || dayBackedCount > 0;
  const pinDayOnRail = pinDayControl && showPinRail && dayControl != null;
  const renderDayControl = (stretch = false) =>
    typeof dayControl === "function" ? dayControl({ stretch }) : dayControl;
  const footballFilterIcon = sport === "football"
    ? (option: { name?: string; label: string; country?: string | null }) => (
        <CompetitionHeaderIcon
          competition={option.name ?? option.label}
          leagueCountry={option.country}
          size="sm"
        />
      )
    : undefined;

  const renderListFilter = () => (
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
      unlockOdds={sport === "football" && canScoutPlan}
    />
  );

  const railProps = {
    sport,
    pinned: pinnedOptions,
    scopeFilter,
    favouritesOnly,
    backedOnly,
    backedCount: dayBackedCount,
    onSelectAll: selectAllRail,
    onSelectSaved: selectPinnedRail,
    onSelectBacked: selectBackedRail,
    onSelectScope: selectScopeRail,
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
        {hideStatusPills ? (
          <div className={cn("min-w-0 flex-1", pinDayOnRail && "lg:hidden")} />
        ) : (
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
                onClick={() => selectStatus(f.id)}
                hasCount
              >
                {f.label}
                <span className={filterPillCountState(active)}>{f.count ?? 0}</span>
              </FilterPill>
            );
          })}
          {sport === "football" && canScoutPlan ? (
            <FilterPill
              tone="edge"
              active={statusFilter === "picks"}
              onClick={() => selectStatus("picks")}
              hasCount
            >
              <Zap
                className={cn("size-3", statusFilter !== "picks" && "text-edge")}
                aria-hidden
              />
              2UP picks
              <span className={filterPillCountState(statusFilter === "picks")}>
                {picksCount}
              </span>
            </FilterPill>
          ) : null}
        </div>
        )}
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            {dayControl != null ? (
              <div className={pinDayOnRail ? "lg:hidden" : undefined}>
                {renderDayControl()}
              </div>
            ) : null}
            <div className={pinDayOnRail ? "lg:hidden" : undefined}>
              {renderListFilter()}
            </div>
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
        ) : sport === "football" && statusFilter === "picks" && !canScoutPlan ? (
          <PlanLockEmpty compact={emptyCompact} feature="twoup_scout" />
        ) : sport === "football" &&
          statusFilter === "picks" &&
          scoutFailed &&
          !scoutLoading ? (
          <EmptyState
            compact={emptyCompact}
            icon={FootballIcon}
            title="Could not load 2UP picks"
            description="Check the connection, then try again."
            action={{
              label: "Try again",
              onClick: () => setScoutRetry((n) => n + 1),
            }}
          />
        ) : sport === "football" &&
          statusFilter === "picks" &&
          scoutLoading &&
          footballGroups.length === 0 ? (
          <EmptyState
            compact={emptyCompact}
            busy
            title="Finding 2UP picks…"
            description={TWOUP_PICKS_EMPTY}
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
                teamBackByEventId={teamBackByEventId}
                footballEventById={footballEventById}
                displayTimezone={displayTimezone}
                favourite={favouriteSet.has(group.id)}
                onToggleFavourite={() => toggleFavourite(group.id)}
                hidden={hiddenSet.has(group.id)}
                onToggleHidden={() => toggleHidden(group.id)}
                showScout={canScout && favouriteSet.has(group.id)}
                unlockOdds={canScoutPlan}
                scoutByKey={scoutByKey}
                scoutLoading={scoutLoading}
                trackedExternalIds={trackedExternalIds}
                onTrackFixture={onTrackFixture}
                onUntrackFixture={onUntrackFixture}
                goalPreviewKey={goalPreviewKeys[0] ?? null}
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
                onUntrack={onUntrackRace}
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
              scopeFilter !== "all" || favouritesOnly || backedOnly
                ? {
                    label: "Show all",
                    variant: "secondary",
                    onClick: selectAllRail,
                  }
                : undefined
            }
            secondaryAction={
              scopeFilter !== "all"
                ? {
                    label: "Show pinned",
                    variant: "secondary",
                    onClick: selectPinnedRail,
                  }
                : undefined
            }
          />
        );

  return (
    <TooltipProvider delayDuration={200}>
      {tapeEvent ? (
        <FootballLiveTapeDialog
          event={liveTapeDialogEvent(tapeEvent, football)}
          open
          showTwoupScout={canScout}
          scout={
            tapeEvent.startTime != null
              ? scoutByKey.get(
                  twoupScoutKey({
                    homeTeam: tapeEvent.homeTeam,
                    awayTeam: tapeEvent.awayTeam,
                    startTime: tapeEvent.startTime,
                  })
                ) ?? null
              : null
          }
          scoutLoading={scoutLoading}
          tracked={Boolean(
            tapeEvent.externalId && trackedExternalIds.has(tapeEvent.externalId)
          )}
          onTrack={() => {
            const fixture = football.find(
              (row) => row.externalId === tapeEvent.externalId
            );
            if (fixture) onTrackFixture(fixture);
          }}
          onUntrack={() => {
            const fixture = football.find(
              (row) => row.externalId === tapeEvent.externalId
            );
            if (fixture) onUntrackFixture(fixture);
          }}
          onAddBet={() => {
            const fixture = football.find(
              (row) => row.externalId === tapeEvent.externalId
            );
            setTapeEvent(null);
            if (fixture) onAddBetFixture(fixture);
          }}
          twoUpActionLabel={twoUpActionLabel}
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
          onUntrack={() => {
            const race =
              racing.find((row) => row.externalId === tapeRace.externalId) ?? tapeRace;
            onUntrackRace(race);
          }}
          onAddBet={() => {
            const race =
              racing.find((row) => row.externalId === tapeRace.externalId) ?? tapeRace;
            setTapeRace(null);
            onAddBetRace(race);
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
          <div
            className={cn(
              "w-full min-w-0 py-4",
              hideStatusPills && pinDayOnRail && "lg:hidden"
            )}
          >
            {slice}
          </div>
        </div>
        <div className="relative flex min-h-0 min-w-0 flex-1 gap-[var(--layout-page-x)]">
          <ScrollFadeEdges
            className="my-4 min-h-0 min-w-0 flex-1"
            fadeClassName="from-page"
            fadeSize={FIXTURE_TAPE_GUTTER_PX}
            fadeOnScroll
            overlayScrollbar
            pinScrollStart
            scrollStartKey={`${listKey ?? ""}:${sport}:${statusFilter}:${scopeFilter}:${backedOnly ? "backed" : favouritesOnly ? "pins" : "all"}`}
            scrollClassName="app-scroll-float"
          >
            {body}
          </ScrollFadeEdges>
          {showPinRail ? (
            <aside
              className={cn(
                "my-4 hidden min-h-0 shrink-0 lg:flex lg:flex-col",
                pinDayControl ? statStripFiveColWidth : "w-56"
              )}
            >
              {pinDayOnRail ? (
                <div className="mb-4 flex w-full min-w-0 shrink-0 items-center gap-2">
                  <div className="min-w-0 flex-1">{renderDayControl(true)}</div>
                  {renderListFilter()}
                </div>
              ) : null}
              <ScrollFadeEdges
                className="min-h-0 min-w-0 flex-1"
                fadeClassName="from-page"
                fadeSize={FIXTURE_TAPE_GUTTER_PX}
                fadeOnScroll
                overlayScrollbar
                pinScrollStart
                scrollStartKey={`${listKey ?? ""}:${sport}:${scopeFilter}:${backedOnly ? "backed" : favouritesOnly ? "pins" : "all"}`}
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
