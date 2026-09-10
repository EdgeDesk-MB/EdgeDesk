"use client";

import NumberFlow from "@number-flow/react";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { Flame, Goal, NotebookPen, Scale, Shirt } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { TrackToggleButton } from "@/components/events/track-toggle-button";
import { ExchangeBackCell } from "@/components/events/exchange-back-tags";
import { TwoupFitTicks } from "@/components/events/twoup-openness-meter";
import { TwoupScoutPanel } from "@/components/events/twoup-scout-panel";
import { EmptyState } from "@/components/help/empty-state";
import { TeamCrest } from "@/components/team-crest";
import { api } from "@/hooks/use-app-state";
import {
  pagePrimaryButtonProps,
  pageSecondaryButtonProps,
} from "@/components/layout/page-header-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  Tabs,
  TabsContent,
  TabsLineBar,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useEventCrests } from "@/hooks/use-event-crests";
import { useTapeGoalFlash } from "@/hooks/use-tape-goal-flash";
import {
  TWOUP_TIER_SHORT,
  twoupIsEdgePick,
  twoupSideTierFromPct,
  type TwoupOpennessResult,
} from "@/lib/calc/ep/twoup-openness";
import { effectiveEventStatus, eventShowsScore, footballPhaseLabel } from "@/lib/events";
import type { TapeGoalFlash } from "@/lib/events/fixture-tape-goal";
import {
  footballFinishedNameWeight,
  matchTapeNameWeightClass,
} from "@/lib/events/fixture-result-weight";
import {
  formatLineupsCaption,
  lineupGridRows,
  parseFootballLineups,
  type FootballLineupPlayer,
  type FootballLineups,
} from "@/lib/events/lineups";
import {
  cardCaption,
  cardTone,
  formatTapeDetail,
  formatTapeMinute,
  formatTapeScore,
  goalCaption,
  groupTapeByPeriod,
  parseMatchTape,
  periodEndScore,
  tapeRunningScores,
  TAPE_PERIOD_LABEL,
  type MatchTapeEvent,
  type TapeScore,
} from "@/lib/events/match-tape";
import { formatClockTime } from "@/lib/time-format";
import {
  captionHeading,
  deskTableBodyCell,
  deskTableHeaderRowSticky,
  listRow,
  listRowGroup,
  fixtureTapeScoreboardCellGoal,
  fixtureTapeScoreboardCellLive,
  fixtureTapeScoreboardRest,
  matchTapeScoreboard,
  matchTapeScoreboardCell,
  matchTapeScoreboardRule,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Match the scoreboard / tab inset (24px), not Racing Desk table edges. */
const tapeEdgeStart = "pl-6";
const tapeEdgeEnd = "pr-6";

export type FootballTapeDialogEvent = {
  id?: number;
  homeTeam: string;
  awayTeam: string;
  goals?: string | null;
  lineups?: string | null;
  homeScore?: number;
  awayScore?: number;
  htHomeScore?: number | null;
  htAwayScore?: number | null;
  status?: string;
  period?: string | null;
  matchEnding?: string | null;
  minute?: number | null;
  startTime?: number;
  competition?: string | null;
  leagueCountry?: string | null;
  externalId?: string | null;
  source?: string | null;
  sport?: string;
  /** List Goal window, if the row was already flashing when opened. */
  goalSeed?: TapeGoalFlash;
};

function CardMark({
  tone,
}: {
  tone: ReturnType<typeof cardTone>;
}) {
  /** Referee plates — not `--warning` / `--negative` type tokens (those read muddy as fills). */
  const plate = "h-3 w-2 shrink-0 rounded-[2px] ring-1 ring-black/15 dark:ring-white/20";
  const yellow = "bg-[#ffd400]";
  const red = "bg-[#e10600]";
  if (tone === "second-yellow") {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5" aria-hidden>
        <span className={cn(plate, yellow)} />
        <span className={cn(plate, red)} />
      </span>
    );
  }
  return (
    <span
      className={cn(plate, tone === "red" ? red : yellow)}
      aria-hidden
    />
  );
}

function SubstitutionMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path
        d="M6 11.25V4.75M4.4 6.6 6 4.75 7.6 6.6"
        className="fill-none stroke-profit"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 4.75v6.5M8.4 9.4 10 11.25 11.6 9.4"
        className="fill-none stroke-negative"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TapeGlyph({ event }: { event: MatchTapeEvent }) {
  let mark: ReactNode;
  if (event.kind === "goal") mark = <span className="text-[13px] leading-none">⚽</span>;
  else if (event.kind === "card") mark = <CardMark tone={cardTone(event.detail)} />;
  else if (event.kind === "subst") mark = <SubstitutionMark />;
  else if (event.kind === "var") mark = <Scale className="size-3" />;
  else mark = <Goal className="size-3 text-muted-foreground" />;

  return (
    <span
      className="inline-flex h-4 min-w-4 shrink-0 items-start justify-center pt-px"
      aria-hidden
    >
      {mark}
    </span>
  );
}

function playerLabel(
  event: MatchTapeEvent,
  teams: { homeTeam: string; awayTeam: string }
): string {
  return event.player ?? (event.side === "home" ? teams.homeTeam : teams.awayTeam);
}

function tapeRowLabel(
  event: MatchTapeEvent,
  teams: { homeTeam: string; awayTeam: string }
): string {
  const clock = formatTapeMinute(event);
  const who = playerLabel(event, teams);
  switch (event.kind) {
    case "goal": {
      const extra = goalCaption(event);
      return extra ? `Goal, ${who} (${extra}), ${clock}` : `Goal, ${who}, ${clock}`;
    }
    case "card":
      return `${cardCaption(event.detail)}, ${who}, ${clock}`;
    case "subst":
      return event.assist
        ? `Substitution, ${event.assist} on for ${who}, ${clock}`
        : `Substitution, ${who}, ${clock}`;
    case "var":
      return `${formatTapeDetail(event.detail) ?? "VAR"}, ${clock}`;
    default:
      return `${formatTapeDetail(event.detail) ?? who}, ${clock}`;
  }
}

function EventCopy({
  event,
  teams,
  score,
  align,
}: {
  event: MatchTapeEvent;
  teams: { homeTeam: string; awayTeam: string };
  score?: TapeScore;
  align: "home" | "away";
}) {
  const away = align === "away";
  const clock = (
    <span className="shrink-0 tabular-nums text-muted-foreground">
      {formatTapeMinute(event)}
    </span>
  );
  const glyph = <TapeGlyph event={event} />;
  const scoreMark =
    event.kind === "goal" && score ? (
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {formatTapeScore(score)}
      </span>
    ) : null;

  let names: ReactNode;
  if (event.kind === "subst") {
    const incoming = event.assist;
    const outgoing = event.player;
    names = (
      <span className="flex min-w-0 flex-col gap-0.5 text-pretty break-words">
        {incoming ? (
          <span className="font-medium text-foreground">{incoming}</span>
        ) : null}
        {outgoing ? (
          <span className="text-muted-foreground">{outgoing}</span>
        ) : null}
        {!incoming && !outgoing ? (
          <span className="font-medium text-foreground">Substitution</span>
        ) : null}
      </span>
    );
  } else {
    const caption =
      event.kind === "goal"
        ? goalCaption(event)
        : event.kind === "card"
          ? cardCaption(event.detail)
          : formatTapeDetail(event.detail);
    const who = (
      <span className="font-medium text-foreground">
        {playerLabel(event, teams)}
      </span>
    );
    const detail = caption ? (
      <span className="text-muted-foreground">({caption})</span>
    ) : null;
    names = (
      <span className="min-w-0 text-pretty break-words">
        {away ? (
          <>
            {detail}
            {detail ? " " : null}
            {who}
          </>
        ) : (
          <>
            {who}
            {detail ? " " : null}
            {detail}
          </>
        )}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-1.5 text-xs leading-snug",
        away ? "justify-end text-right" : "justify-start text-left"
      )}
    >
      {away ? (
        <>
          {names}
          {scoreMark}
          {glyph}
          {clock}
        </>
      ) : (
        <>
          {clock}
          {glyph}
          {scoreMark}
          {names}
        </>
      )}
    </div>
  );
}

const minuteFlowTimings = {
  transformTiming: { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  spinTiming: { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  opacityTiming: { duration: 100, easing: "ease-out" },
} as const;

const scoreGoalTimings = {
  transformTiming: { duration: 750, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  spinTiming: { duration: 750, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  opacityTiming: { duration: 250, easing: "ease-out" },
} as const;

function MatchScoreDigit({
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
        matchTapeScoreboardCell,
        live
          ? scored
            ? fixtureTapeScoreboardCellGoal
            : fixtureTapeScoreboardCellLive
          : fixtureTapeScoreboardRest
      )}
    >
      <NumberFlow
        value={value}
        trend={1}
        {...(scored ? scoreGoalTimings : minuteFlowTimings)}
        format={{ useGrouping: false, maximumFractionDigits: 0 }}
        className="tabular-nums bg-transparent! [&_*]:bg-transparent!"
      />
    </span>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** Advances the last known feed minute while the dialog is open (state poll pauses). */
function useTickingLiveMinute(minute: number | null, live: boolean): number | null {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    setOffset(0);
    if (!live || minute == null) return;
    const id = window.setInterval(() => setOffset((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [live, minute]);
  if (minute == null) return null;
  return minute + offset;
}

function LiveMinute({ minute }: { minute: number }) {
  const [mounted, setMounted] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  if (!mounted || reducedMotion) {
    return (
      <span className="tabular-nums">
        {minute}&apos;
      </span>
    );
  }

  return (
    <NumberFlow
      value={minute}
      trend={1}
      suffix="'"
      {...minuteFlowTimings}
      format={{ useGrouping: false, maximumFractionDigits: 0 }}
      className="tabular-nums"
    />
  );
}

function MatchStatusMark({ event }: { event: FootballTapeDialogEvent }) {
  const status = effectiveEventStatus({
    status: event.status ?? "upcoming",
    source: event.source,
    startTime: event.startTime,
    sport: event.sport,
  });
  const period = event.period?.trim().toUpperCase();
  const inPlay =
    status === "live" && period !== "HT" && period !== "P";
  const rawMinute =
    inPlay && typeof event.minute === "number" && event.minute > 0
      ? event.minute
      : null;
  const minute = useTickingLiveMinute(rawMinute, inPlay);

  const live = status === "live";
  const phase =
    footballPhaseLabel({
      minute: event.minute,
      period: event.period,
      matchEnding: event.matchEnding,
    }) ?? (live ? "Live" : status === "finished" ? "FT" : null);
  if (!phase) return null;

  const showTickingMinute =
    live &&
    period !== "HT" &&
    period !== "P" &&
    /^\d/.test(phase) &&
    minute != null;

  return (
    <span
      className={cn(
        "justify-self-center text-xs font-semibold tabular-nums leading-none",
        live ? "text-profit" : "text-muted-foreground"
      )}
    >
      {showTickingMinute ? <LiveMinute minute={minute} /> : phase}
    </span>
  );
}

function commentaryEmptyCopy(event: FootballTapeDialogEvent): {
  title: string;
  description: string;
} {
  const status = effectiveEventStatus({
    status: event.status ?? "upcoming",
    source: event.source,
    startTime: event.startTime,
    sport: event.sport,
  });
  if (status === "upcoming") {
    return {
      title: "No commentary yet",
      description: "Goals, cards and substitutions will appear here after kick-off.",
    };
  }
  if (status === "finished") {
    return {
      title: "No commentary",
      description: "Goals, cards and substitutions were not recorded for this match.",
    };
  }
  return {
    title: "No commentary yet",
    description: "Live events will show here as they are recorded.",
  };
}

function lineupEmptyCopy(event: FootballTapeDialogEvent): {
  title: string;
  description: string;
} {
  const status = effectiveEventStatus({
    status: event.status ?? "upcoming",
    source: event.source,
    startTime: event.startTime,
    sport: event.sport,
  });
  if (status === "finished") {
    return {
      title: "No starting XI",
      description: "The team sheets were not recorded for this match.",
    };
  }
  return {
    title: "Starting XI is not in yet",
    description: "Names and shirt numbers appear once the team sheets are confirmed.",
  };
}

export function hasFootballLiveMeta(event: {
  goals?: string | null;
  lineups?: string | null;
}): boolean {
  return (
    parseMatchTape(event.goals).length > 0 ||
    Boolean(formatLineupsCaption(parseFootballLineups(event.lineups)))
  );
}

function teamNameClass({
  align,
  take,
  resultWeight,
}: {
  align: "home" | "away";
  take?: boolean;
  resultWeight?: ReturnType<typeof footballFinishedNameWeight>;
}) {
  return cn(
    "min-w-0 text-pretty break-words text-base leading-snug",
    align === "away" ? "text-right" : "text-left",
    matchTapeNameWeightClass(resultWeight ?? "base"),
    take ? "text-primary-text" : "text-foreground"
  );
}

function TeamNameBlock({
  name,
  formation,
  align,
  take,
  resultWeight,
}: {
  name: string;
  formation?: string | null;
  align: "home" | "away";
  take?: boolean;
  resultWeight?: ReturnType<typeof footballFinishedNameWeight>;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 self-center",
        align === "away" ? "items-end" : "items-start"
      )}
    >
      <p className={teamNameClass({ align, take, resultWeight })}>{name}</p>
      {formation ? (
        <p className="text-xs tabular-nums text-muted-foreground">{formation}</p>
      ) : null}
    </div>
  );
}

function TeamSideMeta({
  name,
  odds,
  align,
}: {
  name: string;
  odds?: number;
  align: "home" | "away";
}) {
  const showOdds = typeof odds === "number" && Number.isFinite(odds) && odds > 1;
  if (!showOdds) return <div />;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2",
        align === "away" ? "items-end text-right" : "items-start text-left"
      )}
    >
      <ExchangeBackCell odds={odds} label={`${name} back`} />
    </div>
  );
}

function MatchScoreboard({
  event,
  homeLogo,
  awayLogo,
  homeOdds,
  awayOdds,
  take,
}: {
  event: FootballTapeDialogEvent;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeOdds?: number;
  awayOdds?: number;
  take?: "home" | "away" | null;
}) {
  const resultStatus = effectiveEventStatus({
    status: event.status ?? "upcoming",
    source: event.source,
    startTime: event.startTime,
    sport: event.sport,
  });
  const lineups = parseFootballLineups(event.lineups);
  const kickoff =
    event.startTime != null
      ? `${format(new Date(event.startTime), "EEE d MMM", { locale: enGB })}, ${formatClockTime(event.startTime)}`
      : null;
  const showScore =
    eventShowsScore({
      sport: event.sport,
      status: event.status ?? "upcoming",
      source: event.source,
      startTime: event.startTime,
    }) || parseMatchTape(event.goals).some((row) => row.kind === "goal");
  const live = resultStatus === "live";
  const goalFlash = useTapeGoalFlash(
    event.externalId ?? `${event.homeTeam}\0${event.awayTeam}\0${event.startTime ?? ""}`,
    event.homeScore ?? 0,
    event.awayScore ?? 0,
    live,
    event.goalSeed
  );

  const homeWeight = footballFinishedNameWeight("home", {
    ...event,
    status: resultStatus,
  });
  const awayWeight = footballFinishedNameWeight("away", {
    ...event,
    status: resultStatus,
  });

  return (
    <div
      className="grid grid-cols-3 gap-x-3 gap-y-3"
      style={{ paddingTop: 32 }}
    >
      <div className="flex size-10 items-center justify-start">
        <TeamCrest src={homeLogo} alt="" size="xl" />
      </div>
      <div className="flex min-w-0 flex-col items-center justify-self-center gap-1 px-1 text-center">
        {event.competition ? (
          <p className="text-pretty break-words text-xs text-muted-foreground">
            {event.competition}
          </p>
        ) : null}
        {kickoff ? (
          <p className="text-xs tabular-nums text-muted-foreground">{kickoff}</p>
        ) : null}
      </div>
      <div className="flex size-10 items-center justify-center justify-self-end">
        <TeamCrest src={awayLogo} alt="" size="xl" />
      </div>

      <TeamNameBlock
        name={event.homeTeam}
        formation={lineups?.homeFormation}
        align="home"
        take={take === "home"}
        resultWeight={homeWeight}
      />
      {showScore ? (
        <div
          className={cn(matchTapeScoreboard, "justify-self-center self-center")}
          aria-label={`${event.homeScore ?? 0}–${event.awayScore ?? 0}`}
        >
          <MatchScoreDigit
            value={event.homeScore ?? 0}
            scored={goalFlash.home}
            live={live}
          />
          <div className={matchTapeScoreboardRule} aria-hidden />
          <MatchScoreDigit
            value={event.awayScore ?? 0}
            scored={goalFlash.away}
            live={live}
          />
        </div>
      ) : (
        <div />
      )}
      <TeamNameBlock
        name={event.awayTeam}
        formation={lineups?.awayFormation}
        align="away"
        take={take === "away"}
        resultWeight={awayWeight}
      />

      <TeamSideMeta
        name={event.homeTeam}
        odds={homeOdds}
        align="home"
      />
      <div className="justify-self-center">
        <MatchStatusMark event={event} />
      </div>
      <TeamSideMeta
        name={event.awayTeam}
        odds={awayOdds}
        align="away"
      />
    </div>
  );
}

function MatchTimeline({ event }: { event: FootballTapeDialogEvent }) {
  const tape = parseMatchTape(event.goals);
  if (tape.length === 0) return null;

  const groups = groupTapeByPeriod(tape);
  const flat = groups.flatMap((group) => group.events);
  const running = tapeRunningScores(flat);
  const runningByKey = new Map<MatchTapeEvent, TapeScore>();
  flat.forEach((row, i) => {
    runningByKey.set(row, running[i]!);
  });

  const live: TapeScore | null =
    typeof event.homeScore === "number" && typeof event.awayScore === "number"
      ? { home: event.homeScore, away: event.awayScore }
      : null;

  return (
    <div className="min-w-0 pb-6">
      {groups.map((group, groupIndex) => {
          const headerScore = periodEndScore(flat, group.period, {
            htHome: event.htHomeScore,
            htAway: event.htAwayScore,
            live,
            isLastPeriod: groupIndex === groups.length - 1,
          });
          return (
            <section key={`${group.period}-${groupIndex}`} className="min-w-0">
              <div
                className={cn(
                  deskTableHeaderRowSticky,
                  "flex items-center justify-between gap-2",
                  tapeEdgeStart,
                  tapeEdgeEnd
                )}
              >
                <h3 className={captionHeading}>{TAPE_PERIOD_LABEL[group.period]}</h3>
                <p className="text-xs font-semibold tabular-nums text-foreground">
                  {formatTapeScore(headerScore)}
                </p>
              </div>
              <ol className={cn("min-w-0", listRowGroup)}>
                {group.events.map((row, i) => (
                  <li
                    key={`${row.kind}-${row.minute}-${row.extra ?? 0}-${i}`}
                    aria-label={tapeRowLabel(row, event)}
                    className={cn(
                      listRow,
                      deskTableBodyCell,
                      "min-w-0",
                      tapeEdgeStart,
                      tapeEdgeEnd
                    )}
                  >
                    <EventCopy
                      event={row}
                      teams={event}
                      score={runningByKey.get(row)}
                      align={row.side === "away" ? "away" : "home"}
                    />
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
    </div>
  );
}

function ShirtName({
  player,
  align,
}: {
  player: FootballLineupPlayer;
  align: "home" | "away";
}) {
  const number = (
    <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
      {player.number ?? "–"}
    </span>
  );
  const name = (
    <span className="min-w-0 text-pretty break-words font-medium text-foreground">
      {player.name}
    </span>
  );
  return (
    <div
      className={cn(
        "flex min-w-0 items-baseline gap-2 text-xs leading-snug",
        align === "away" ? "justify-end text-right" : "justify-start text-left"
      )}
    >
      {align === "away" ? (
        <>
          {name}
          {number}
        </>
      ) : (
        <>
          {number}
          {name}
        </>
      )}
    </div>
  );
}

function XiColumn({
  players,
  coach,
  align,
}: {
  players: FootballLineupPlayer[];
  coach?: string | null;
  align: "home" | "away";
}) {
  const rows = lineupGridRows(players);
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        align === "away" ? "items-end" : "items-start"
      )}
    >
      {rows.map((row, i) => (
        <div key={i} className="flex w-full min-w-0 flex-col gap-1">
          {row.map((player) => (
            <ShirtName key={`${player.number ?? ""}-${player.name}`} player={player} align={align} />
          ))}
        </div>
      ))}
      {coach ? (
        <p className="text-pretty break-words text-xs text-muted-foreground">
          {coach}
        </p>
      ) : null}
    </div>
  );
}

function LineupSection({
  title,
  home,
  away,
  homeCoach,
  awayCoach,
}: {
  title: string;
  home: FootballLineupPlayer[];
  away: FootballLineupPlayer[];
  homeCoach?: string | null;
  awayCoach?: string | null;
}) {
  if (home.length === 0 && away.length === 0) return null;
  return (
    <section className="min-w-0">
      <div
        className={cn(
          deskTableHeaderRowSticky,
          "flex items-center justify-between gap-2",
          tapeEdgeStart,
          tapeEdgeEnd
        )}
      >
        <h3 className={captionHeading}>{title}</h3>
      </div>
      <div
        className={cn(
          deskTableBodyCell,
          "grid min-w-0 grid-cols-2 gap-3",
          tapeEdgeStart,
          tapeEdgeEnd
        )}
      >
        <XiColumn players={home} coach={homeCoach} align="home" />
        <XiColumn players={away} coach={awayCoach} align="away" />
      </div>
    </section>
  );
}

function MatchLineups({ lineups }: { lineups: FootballLineups }) {
  return (
    <div className="min-w-0 pb-6">
      <LineupSection
        title="Starting XI"
        home={lineups.home}
        away={lineups.away}
        homeCoach={lineups.homeCoach}
        awayCoach={lineups.awayCoach}
      />
      <LineupSection
        title="Bench"
        home={lineups.homeSubs ?? []}
        away={lineups.awaySubs ?? []}
      />
    </div>
  );
}

function tapeFreezeKey(event: FootballTapeDialogEvent): string {
  return `${event.id ?? ""}:${event.externalId ?? ""}:${event.startTime ?? ""}:${event.homeTeam}:${event.awayTeam}`;
}

export function FootballLiveTapeDialog({
  event,
  open,
  onOpenChange,
  tracked = false,
  onTrack,
  onUntrack,
  onAddBet,
  onEpDesk,
  showTwoupScout = false,
  scout: scoutProp = null,
  scoutLoading: scoutLoadingProp = false,
}: {
  event: FootballTapeDialogEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, pin a Track / Add bet footer under the tape. */
  tracked?: boolean;
  onTrack?: () => void;
  onUntrack?: () => void;
  onAddBet?: () => void;
  onEpDesk?: () => void;
  showTwoupScout?: boolean;
  scout?: TwoupOpennessResult | null;
  scoutLoading?: boolean;
}) {
  const [frozen, setFrozen] = useState(event);
  const [hydratedGoals, setHydratedGoals] = useState<string | null>(null);
  const [hydratedLineups, setHydratedLineups] = useState<string | null>(null);
  const [tapeLoad, setTapeLoad] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >(() => (parseMatchTape(event.goals).length > 0 ? "ready" : "idle"));
  const [tapeRetry, setTapeRetry] = useState(0);
  const [tapeTab, setTapeTab] = useState("commentary");
  const [scoutFetched, setScoutFetched] = useState<TwoupOpennessResult | null>(null);
  const [scoutFetchLoad, setScoutFetchLoad] = useState(false);
  const [scoutFetchError, setScoutFetchError] = useState(false);
  const [scoutRetry, setScoutRetry] = useState(0);
  const incomingKey = tapeFreezeKey(event);
  const frozenKey = tapeFreezeKey(frozen);
  if (open && incomingKey !== frozenKey) {
    setFrozen(event);
  }
  const base = open && incomingKey !== frozenKey ? event : frozen;
  const view = {
    ...base,
    homeScore: event.homeScore ?? base.homeScore,
    awayScore: event.awayScore ?? base.awayScore,
    status: event.status ?? base.status,
    minute: event.minute ?? base.minute,
    period: event.period ?? base.period,
    matchEnding: event.matchEnding ?? base.matchEnding,
    htHomeScore: event.htHomeScore ?? base.htHomeScore,
    htAwayScore: event.htAwayScore ?? base.htAwayScore,
    goals: hydratedGoals ?? event.goals ?? base.goals,
    lineups: hydratedLineups ?? event.lineups ?? base.lineups,
    goalSeed: event.goalSeed,
  };
  const crests = useEventCrests(view, open);
  const tapeRows = parseMatchTape(view.goals);
  const xi = parseFootballLineups(view.lineups);
  const hasTape = tapeRows.length > 0;
  const matchStatus = effectiveEventStatus({
    status: view.status ?? "upcoming",
    source: view.source,
    startTime: view.startTime,
    sport: view.sport,
  });
  const matchFinished = matchStatus === "finished";
  const canTrack = matchStatus !== "finished";
  const scout = scoutProp ?? scoutFetched;
  const scoutBusy =
    scoutLoadingProp || (showTwoupScout && scoutProp == null && scoutFetchLoad);
  const scoutFetchFailed = scoutFetchError && !scoutBusy && scoutProp == null;
  const pickWindfallPct =
    scout?.pick === "home"
      ? scout.windfallHomePct
      : scout?.pick === "away"
        ? scout.windfallAwayPct
        : scout?.windfallPct;
  const pickTier = twoupSideTierFromPct(pickWindfallPct);
  const hasSideWindfall =
    (scout?.windfallHomePct ?? 0) > 0 || (scout?.windfallAwayPct ?? 0) > 0;
  const scoutWellEmpty =
    scoutBusy ||
    scoutFetchFailed ||
    !scout ||
    (scout.tier === "unknown" && !hasSideWindfall);
  const twoupTabGlimpse =
    !scoutBusy && scout ? TWOUP_TIER_SHORT[pickTier] : null;
  const canFetchTape = event.id != null || Boolean(event.externalId);
  const showLoading =
    open &&
    !hasTape &&
    (tapeLoad === "loading" || (tapeLoad === "idle" && canFetchTape));
  const showError = open && !hasTape && tapeLoad === "error";
  const showEmpty = open && !hasTape && !showLoading && !showError;

  useEffect(() => {
    if (!open) setFrozen(event);
    else setTapeTab("commentary");
  }, [open, event, incomingKey]);

  useEffect(() => {
    if (!open || !showTwoupScout) {
      setScoutFetched(null);
      setScoutFetchLoad(false);
      setScoutFetchError(false);
      return;
    }
    if (scoutProp) {
      setScoutFetched(null);
      setScoutFetchLoad(false);
      setScoutFetchError(false);
      return;
    }
    if (event.startTime == null) return;
    let cancelled = false;
    setScoutFetchLoad(true);
    setScoutFetchError(false);
    const params = new URLSearchParams({
      home: event.homeTeam,
      away: event.awayTeam,
      start: String(event.startTime),
    });
    if (event.competition) params.set("competition", event.competition);
    if (event.leagueCountry) params.set("country", event.leagueCountry);
    void api<{ items?: Array<{ openness: TwoupOpennessResult }> }>(
      `/api/fixtures/twoup-scout?${params.toString()}`
    )
      .then((payload) => {
        if (!cancelled) {
          setScoutFetched(payload.items?.[0]?.openness ?? null);
          setScoutFetchError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScoutFetched(null);
          setScoutFetchError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setScoutFetchLoad(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    showTwoupScout,
    scoutProp,
    event.homeTeam,
    event.awayTeam,
    event.startTime,
    event.competition,
    event.leagueCountry,
    incomingKey,
    scoutRetry,
  ]);

  useEffect(() => {
    if (!open) {
      setHydratedGoals(null);
      setHydratedLineups(null);
      setTapeLoad(parseMatchTape(event.goals).length > 0 ? "ready" : "idle");
      return;
    }
    if (event.lineups) setHydratedLineups(event.lineups);
    if (parseMatchTape(event.goals).length > 0) {
      setHydratedGoals(event.goals ?? null);
      setTapeLoad("ready");
      return;
    }
    const id = event.id;
    const externalId = event.externalId?.trim() ?? "";
    const tapeUrl =
      id != null
        ? `/api/events/${id}/tape`
        : externalId
          ? `/api/fixtures/tape?externalId=${encodeURIComponent(externalId)}&home=${encodeURIComponent(event.homeTeam)}`
          : null;
    if (!tapeUrl) {
      setTapeLoad("empty");
      return;
    }
    let cancelled = false;
    setTapeLoad("loading");
    api<{ goals: string | null; lineups: string | null }>(tapeUrl)
      .then((res) => {
        if (cancelled) return;
        const next = res.goals ?? null;
        setHydratedGoals(next);
        if (res.lineups) setHydratedLineups(res.lineups);
        setTapeLoad(parseMatchTape(next).length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) setTapeLoad("error");
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    event.id,
    event.externalId,
    event.homeTeam,
    event.goals,
    incomingKey,
    tapeRetry,
  ]);

  const commentaryEmpty = commentaryEmptyCopy(view);
  const lineupEmpty = lineupEmptyCopy(view);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex! min-h-0 max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 max-sm:overflow-hidden max-sm:pb-0 sm:h-[min(40rem,85dvh)] sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <Tabs
          value={tapeTab}
          onValueChange={setTapeTab}
          className="flex min-h-0 flex-1 flex-col !gap-0 overflow-hidden"
        >
          <div className="shrink-0 bg-card">
            <DialogHeader className="relative mx-0 mt-0! border-b-0 bg-transparent px-6 pt-0! pb-3.5 pr-6">
              <DialogTitle className="sr-only">
                {view.homeTeam} v {view.awayTeam}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Home on the left, away on the right.
                {showTwoupScout
                  ? " Commentary, starting XI and 2UP take."
                  : " Commentary and starting XI."}
              </DialogDescription>
              <MatchScoreboard
                event={view}
                homeLogo={crests.homeLogo}
                awayLogo={crests.awayLogo}
                homeOdds={scout?.markets.home}
                awayOdds={scout?.markets.away}
                take={
                  scout?.pick && pickTier !== "skip" && pickTier !== "unknown"
                    ? scout.pick
                    : null
                }
              />
            </DialogHeader>
            <TabsLineBar className="mt-3 bg-transparent [--tabs-line-inset:1.5rem]">
              <TabsList
                variant="line"
                className="justify-start"
                fadeClassName="from-card"
              >
                <TabsTrigger value="commentary">Commentary</TabsTrigger>
                <TabsTrigger value="lineup">Lineup</TabsTrigger>
                {showTwoupScout ? (
                  <TabsTrigger
                    value="twoup"
                    aria-label={
                      twoupTabGlimpse
                        ? twoupIsEdgePick(pickTier)
                          ? `2UP, Edge, ${twoupTabGlimpse}`
                          : `2UP, ${twoupTabGlimpse}`
                        : "2UP"
                    }
                  >
                    2UP
                    {!scoutBusy && scout ? (
                      <TwoupFitTicks
                        tier={pickTier}
                        size="list"
                        edge={twoupIsEdgePick(pickTier)}
                      />
                    ) : null}
                  </TabsTrigger>
                ) : null}
              </TabsList>
            </TabsLineBar>
          </div>
          {showTwoupScout ? (
            <TabsContent
              value="twoup"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col overflow-hidden bg-page px-6",
                  scoutWellEmpty ? "items-center justify-center py-4" : "h-full py-4"
                )}
              >
                <TwoupScoutPanel
                  homeTeam={view.homeTeam}
                  awayTeam={view.awayTeam}
                  result={scout}
                  loading={scoutBusy}
                  error={scoutFetchFailed}
                  onRetry={() => setScoutRetry((n) => n + 1)}
                />
              </div>
            </TabsContent>
          ) : null}
          <TabsContent
            value="commentary"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ScrollFadeEdges
              className="min-h-0 flex-1 bg-page"
              fadeClassName="from-page"
              startFade={false}
              overlayScrollbar
              scrollClassName="app-scroll-float overscroll-contain"
            >
              {showLoading ? (
                <div className="flex min-h-full items-center justify-center px-6 py-8">
                  <EmptyState
                    bare
                    compact
                    oneLine
                    busy
                    title="Loading commentary"
                    description="Goals, cards and substitutions."
                  />
                </div>
              ) : showError ? (
                <div className="flex min-h-full items-center justify-center px-6 py-8">
                  <EmptyState
                    bare
                    compact
                    oneLine
                    icon={Goal}
                    title="Could not load commentary"
                    description="Check the connection, then try again."
                    action={{
                      label: "Try again",
                      onClick: () => setTapeRetry((n) => n + 1),
                    }}
                  />
                </div>
              ) : showEmpty ? (
                <div className="flex min-h-full items-center justify-center px-6 py-8">
                  <EmptyState
                    bare
                    compact
                    oneLine
                    icon={Goal}
                    title={commentaryEmpty.title}
                    description={commentaryEmpty.description}
                  />
                </div>
              ) : (
                <MatchTimeline event={view} />
              )}
            </ScrollFadeEdges>
          </TabsContent>
          <TabsContent
            value="lineup"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ScrollFadeEdges
              className="min-h-0 flex-1 bg-page"
              fadeClassName="from-page"
              startFade={false}
              overlayScrollbar
              scrollClassName="app-scroll-float overscroll-contain"
            >
              {xi ? (
                <MatchLineups lineups={xi} />
              ) : (
                <div className="flex min-h-full items-center justify-center px-6 py-8">
                  <EmptyState
                    bare
                    compact
                    oneLine
                    icon={Shirt}
                    title={lineupEmpty.title}
                    description={lineupEmpty.description}
                  />
                </div>
              )}
            </ScrollFadeEdges>
          </TabsContent>
        </Tabs>
        {onEpDesk || (canTrack && (onTrack || onUntrack)) || (onAddBet && !matchFinished) ? (
          <DialogFooter className="mx-0 mb-0 shrink-0 flex-col bg-page px-6 dark:bg-card max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:justify-end">
            {onEpDesk ? (
              <Button
                type="button"
                variant="outline"
                {...pageSecondaryButtonProps}
                onClick={onEpDesk}
              >
                <Flame className="size-4 text-warning" aria-hidden />
                2UP Desk
              </Button>
            ) : null}
            {canTrack && (onTrack || onUntrack) ? (
              <TrackToggleButton
                appearance="label"
                tracked={tracked}
                onTrack={onTrack}
                onUntrack={onUntrack}
              />
            ) : null}
            {onAddBet && !matchFinished ? (
              <Button type="button" {...pagePrimaryButtonProps} onClick={onAddBet}>
                <NotebookPen className="size-4" aria-hidden />
                Add bet
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
