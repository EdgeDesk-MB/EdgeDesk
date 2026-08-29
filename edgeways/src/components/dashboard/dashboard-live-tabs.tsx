"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoneyFlow } from "@/components/money-flow";
import { EmptyState } from "@/components/help/empty-state";
import type { AppState } from "@/lib/services/state.types";
import type { BetRow, EventRow } from "@/lib/db/schema";
import { effectiveEventStatus, formatEventTitle } from "@/lib/events";
import { isEventPendingSettle } from "@/lib/racing/pending-settle";
import { isRaceResultIncomplete, parseRaceResults } from "@/lib/racing";
import { SportEventBlock } from "@/components/sport-icon";
import { LiveEventStatusPanel } from "@/components/events/live-event-status";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import {
  RacingPlacingsDialog,
  type PlacingsPayload,
} from "@/components/racing/racing-placings-dialog";
import { api, useAppState } from "@/hooks/use-app-state";
import { filterPillCountState, selectionSubtle } from "@/lib/ui/surface-styles";
import { dashboardSection } from "@/lib/ui/dashboard-layout";
import { livePositionTriggerNoteShowsBolt } from "@/lib/services/live-position-note";
import { sumEventIfEndedNow } from "@/lib/pnl/open-bet-worst-case";
import { deskLiveEventIds, deskNotesForEvent } from "@/lib/pnl/desk-live-positions";
import { liveMatchBackTags } from "@/lib/events/live-match-backs";
import { useLiveMatchBacks } from "@/hooks/use-live-match-backs";
import { ExchangeBackTags } from "@/components/events/exchange-back-tags";
import {
  pruneLiveDockLocks,
  readLiveDockExpanded,
  readLiveDockLocks,
  toggleLockId,
  writeLiveDockExpanded,
  writeLiveDockLocks,
  type LiveDockLocks,
} from "@/lib/ui/live-dock-prefs";
import { COLLAPSE_EASE, SPRING_DURATION_MS } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";
import { ChevronUp, Lock, Radio, Target } from "lucide-react";

const LIVE_DOCK_PANEL_ID = "dashboard-live-dock-panel";

/** Leading lock rail + content column. Same geometry for Events and Positions. */
const liveDockRowShell =
  "surface-glass overflow-hidden rounded-lg bg-card transition-colors hover:bg-selection-subtle/40";
/** icon-xs (24px) optically aligned to text-sm first line */
const liveDockLockRail = "flex shrink-0 items-start pl-3 pt-2.5";
const liveDockContentPad = "min-w-0 pr-3 pt-2.5";
const liveDockGap = "gap-x-2.5";

function LockToggle({
  locked,
  label,
  onToggle,
}: {
  locked: boolean;
  label: string;
  onToggle: () => void;
}) {
  // Same outline Lock always — locked reads from the face (success + pressed),
  // matching Track race / Tracked on the Racing Desk.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Wrapper keeps TooltipTrigger off the Button so Press stays on the 3D path. */}
        <span className="inline-flex shrink-0">
          <Button
            type="button"
            variant={locked ? "success" : "outline"}
            size="icon-xs"
            toggle
            active={locked}
            className="shrink-0"
            aria-label={locked ? `Unlock ${label}` : `Lock ${label} in view`}
            aria-pressed={locked}
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle();
            }}
          >
            <Lock className="size-3" aria-hidden />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {locked ? "Unlock, hide when collapsed" : "Lock in view when collapsed"}
      </TooltipContent>
    </Tooltip>
  );
}

function LiveDockRow({
  locked,
  lockLabel,
  onToggleLock,
  children,
  footer,
}: {
  locked: boolean;
  lockLabel: string;
  onToggleLock: () => void;
  children: ReactNode;
  /** Optional band under the title (Events status). Aligns to the content column. */
  footer?: ReactNode;
}) {
  return (
    <div className={liveDockRowShell}>
      <div className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-start", liveDockGap)}>
        <div className={liveDockLockRail}>
          <div className="pt-0.5">
            <LockToggle
              locked={locked}
              label={lockLabel}
              onToggle={onToggleLock}
            />
          </div>
        </div>
        <div
          className={cn(
            liveDockContentPad,
            footer ? "pb-2" : "pb-2.5"
          )}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={cn(
              selectionSubtle,
              // Full-bleed hairline to the card edge; subgrid keeps status under the title column.
              "col-span-2 grid grid-cols-subgrid border-t border-border/60 py-2",
              liveDockGap
            )}
          >
            <div aria-hidden className="pl-3" />
            <div className="min-w-0 pr-3">{footer}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PositionList({
  state,
  visibleIds,
  lockedIds,
  onToggleLock,
  footerHint,
}: {
  state: AppState | null;
  visibleIds: Set<number> | null;
  lockedIds: Set<number>;
  onToggleLock: (betId: number) => void;
  footerHint?: ReactNode;
}) {
  const positions = state?.livePositions ?? [];
  const rows =
    visibleIds == null
      ? positions
      : positions.filter((p) => visibleIds.has(p.betId));

  if (rows.length === 0) {
    if (footerHint) return <>{footerHint}</>;
    return (
      <EmptyState
        compact
        icon={Target}
        title="No live positions"
        description="Attach bets to in-play events in the tracker, or start a simulated match."
        action={{ label: "Open tracker", href: "/tracker" }}
        className="shadow-none"
      />
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-2">
        {rows.map((position) => (
          <LiveDockRow
            key={position.betId}
            locked={lockedIds.has(position.betId)}
            lockLabel={position.label}
            onToggleLock={() => onToggleLock(position.betId)}
          >
            <Link
              href={position.href ?? "/tracker"}
              className="flex min-w-0 items-start justify-between gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <div className="min-w-0 text-pretty break-words text-sm font-semibold leading-snug">
                  {position.label}
                </div>
                <div className="mt-0.5 min-w-0 text-pretty break-words text-xs text-muted-foreground">
                  {position.eventName}
                  {position.eventSport === "horse_racing" ? (
                    <> · {position.eventStatusLabel}</>
                  ) : (
                    <>
                      {" · "}
                      {position.eventStatusLabel}
                      {position.minute > 0 ? ` · ${position.minute}'` : ""}
                    </>
                  )}
                </div>
                {position.valuationMode === "model" &&
                  position.snapshotProvisional != null &&
                  position.provisional != null &&
                  Math.abs(position.provisional - position.snapshotProvisional) >
                    0.05 && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      if ended now{" "}
                      <MoneyFlow
                        value={position.snapshotProvisional}
                        signColor
                        signDisplay
                        className="inline text-xs font-medium tabular-nums"
                      />
                    </div>
                  )}
                {position.triggerNote && (
                  <div className="mt-1 min-w-0 text-pretty break-words text-xs text-warning">
                    {livePositionTriggerNoteShowsBolt(position.triggerNote)
                      ? "⚡ "
                      : null}
                    {position.triggerNote}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {position.provisional != null ? (
                  <>
                    <MoneyFlow
                      value={position.provisional}
                      signColor
                      signDisplay
                      className="text-sm font-semibold tabular-nums"
                    />
                    <div className="text-xs text-muted-foreground">
                      {position.valuationMode === "model"
                        ? "model EV"
                        : "if ended now"}
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {position.kind && position.kind !== "bet" ? "In play" : "manual"}
                  </span>
                )}
              </div>
            </Link>
          </LiveDockRow>
        ))}
        {footerHint}
      </div>
    </TooltipProvider>
  );
}

function liveEventSubtitle(event: EventRow): string | null {
  const isRacing = event.sport === "horse_racing";
  const parts: string[] = [];

  if (isRacing) {
    const raceName = event.homeTeam?.trim();
    if (raceName && raceName !== "Race") parts.push(raceName);
  } else if (event.competition?.trim()) {
    parts.push(event.competition.trim());
  }

  if (event.source === "sim") parts.push("simulated");
  if (event.source === "api" && !isRacing) parts.push("live feed");

  return parts.length > 0 ? parts.join(" · ") : null;
}

function LiveEventRow({
  event,
  linkedBets,
  locked,
  onToggleLock,
  onRecordPlacings,
  ifEndedNow,
  deskNotes = [],
  backTags,
  backsSuspended,
  backsQuoteSeq,
  backsLoading,
}: {
  event: EventRow;
  linkedBets: BetRow[];
  locked: boolean;
  onToggleLock: () => void;
  onRecordPlacings: (eventId: number, payload: PlacingsPayload) => void;
  ifEndedNow: number | null;
  deskNotes?: { text: string; needsAction: boolean; href: string }[];
  backTags: ReturnType<typeof liveMatchBackTags>;
  backsSuspended: boolean;
  backsQuoteSeq: number;
  backsLoading: boolean;
}) {
  const [placingsOpen, setPlacingsOpen] = useState(false);
  const isRacing = event.sport === "horse_racing";
  const raceResult = isRacing ? parseRaceResults(event.goals) : null;
  const incomplete = !!raceResult && isRaceResultIncomplete(raceResult);
  const opensPlacings = isRacing && isEventPendingSettle(event);
  const subtitle = liveEventSubtitle(event);
  const title = formatEventTitle(event);

  const hitClass =
    "block w-full cursor-pointer text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const endedNowFigure =
    ifEndedNow != null ? (
      <div className="shrink-0 text-right">
        <MoneyFlow
          value={ifEndedNow}
          signColor
          signDisplay
          className="text-sm font-semibold tabular-nums"
        />
        <div className="text-xs text-muted-foreground">if ended now</div>
      </div>
    ) : null;

  const titleBlock = (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <SportEventBlock
          sport={event.sport}
          title={title}
          titleClassName="min-w-0 truncate text-sm font-semibold"
        >
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
        </SportEventBlock>
      </div>
      {endedNowFigure}
    </div>
  );

  const statusFooter = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <LiveEventStatusPanel event={event} layout="bar" />
      {backTags || backsSuspended ? (
        <ExchangeBackTags
          tags={backTags ?? []}
          suspended={backsSuspended}
          quoteSeq={backsQuoteSeq}
        />
      ) : backsLoading ? (
        <div className="h-6 min-w-[9.5rem]" aria-hidden />
      ) : null}
    </div>
  );

  const titleHit = opensPlacings ? (
    <button
      type="button"
      className={hitClass}
      aria-label={`Enter race result for ${title}`}
      onClick={() => setPlacingsOpen(true)}
    >
      {titleBlock}
    </button>
  ) : (
    <Link href="/tracked-events" className={hitClass}>
      {titleBlock}
    </Link>
  );

  const footerHit = opensPlacings ? (
    <button
      type="button"
      className={hitClass}
      aria-label={`Enter race result for ${title}`}
      onClick={() => setPlacingsOpen(true)}
    >
      {statusFooter}
    </button>
  ) : (
    <Link href="/tracked-events" className={hitClass}>
      {statusFooter}
    </Link>
  );

  const deskNoteLinks =
    deskNotes.length > 0 ? (
      <div className="mt-1 min-w-0 space-y-0.5 text-pretty break-words text-xs">
        {deskNotes.map((note) => (
          <Link
            key={`${note.href}:${note.text}`}
            href={note.href}
            className={cn(
              "block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              note.needsAction ? "text-warning" : "text-muted-foreground"
            )}
          >
            {note.text}
          </Link>
        ))}
      </div>
    ) : null;

  const row = (
    <LiveDockRow
      locked={locked}
      lockLabel={title}
      onToggleLock={onToggleLock}
      footer={footerHit}
    >
      {titleHit}
      {deskNoteLinks}
    </LiveDockRow>
  );

  if (opensPlacings) {
    return (
      <>
        {row}
        <RacingPlacingsDialog
          event={event}
          linkedBets={linkedBets}
          incomplete={incomplete}
          open={placingsOpen}
          onOpenChange={setPlacingsOpen}
          onRecord={(payload) => onRecordPlacings(event.id, payload)}
        />
      </>
    );
  }

  return row;
}

function liveDockEvents(state: AppState | null): EventRow[] {
  const deskIds = deskLiveEventIds(state?.livePositions ?? []);
  return (state?.events ?? []).filter(
    (event) => effectiveEventStatus(event) === "live" || deskIds.has(event.id)
  );
}

function EventsList({
  state,
  visibleIds,
  lockedIds,
  onToggleLock,
  onRecordPlacings,
  footerHint,
}: {
  state: AppState | null;
  visibleIds: Set<number> | null;
  lockedIds: Set<number>;
  onToggleLock: (eventId: number) => void;
  onRecordPlacings: (eventId: number, payload: PlacingsPayload) => void;
  footerHint?: ReactNode;
}) {
  const liveEvents = liveDockEvents(state);
  const { byId: matchBacks, loaded: matchBacksLoaded } = useLiveMatchBacks(liveEvents);
  const bets = state?.bets ?? [];
  const rows =
    visibleIds == null
      ? liveEvents
      : liveEvents.filter((e) => visibleIds.has(e.id));

  if (rows.length === 0) {
    if (footerHint) return <>{footerHint}</>;
    return (
      <EmptyState
        compact
        icon={Radio}
        title="Nothing in play"
        description="Browse fixtures or run a simulation to see live scores here."
        action={{ label: "Browse fixtures", href: "/fixtures" }}
        className="shadow-none"
      />
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col gap-2">
      {rows.map((event) => (
        <LiveEventRow
          key={event.id}
          event={event}
          linkedBets={bets.filter((b) => b.eventId === event.id)}
          locked={lockedIds.has(event.id)}
          onToggleLock={() => onToggleLock(event.id)}
          onRecordPlacings={onRecordPlacings}
          ifEndedNow={
            event.sport === "football"
              ? sumEventIfEndedNow(state?.livePositions ?? [], event.id)
              : null
          }
          deskNotes={deskNotesForEvent(state?.livePositions ?? [], event.id)}
          backTags={
            event.sport === "football"
              ? liveMatchBackTags({
                  homeTeam: event.homeTeam,
                  awayTeam: event.awayTeam,
                  odds: matchBacks.get(event.id)?.odds ?? {},
                  selections: bets
                    .filter((bet) => bet.eventId === event.id && bet.status === "open")
                    .map((bet) => bet.selection),
                })
              : null
          }
          backsSuspended={
            event.sport === "football" && !!matchBacks.get(event.id)?.suspended
          }
          backsQuoteSeq={matchBacks.get(event.id)?.quoteSeq ?? 0}
          backsLoading={event.sport === "football" && !matchBacksLoaded}
        />
      ))}
      {footerHint}
    </div>
    </TooltipProvider>
  );
}

function CollapsedEmptyHint({
  hiddenCount,
  onExpand,
}: {
  hiddenCount: number;
  onExpand: () => void;
}) {
  if (hiddenCount <= 0) return null;
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-full items-center justify-center rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-selection-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {hiddenCount} hidden · expand to view
    </button>
  );
}

export function DashboardLiveTabs({
  state,
  className,
  /** Dock under History feed: content-hugged, expandable, lockable rows. */
  docked = false,
}: {
  state: AppState | null;
  className?: string;
  docked?: boolean;
}) {
  const { refresh } = useAppState();
  const positionCount = state?.livePositions.length ?? 0;
  const liveEvents = useMemo(() => liveDockEvents(state), [state]);
  const eventCount = liveEvents.length;
  const hasLiveEvent = eventCount > 0;
  // Events first: score + match-level if-ended-now. Positions is one tap
  // away for per-leg live readings and 2UP trigger notes.
  const [tab, setTab] = useState("events");
  // Client lazy init avoids expanded→collapsed flash after localStorage read.
  const [expanded, setExpanded] = useState(() => readLiveDockExpanded(true));
  const [locks, setLocks] = useState<LiveDockLocks>(() => readLiveDockLocks());

  const liveEventIds = useMemo(() => liveEvents.map((e) => e.id), [liveEvents]);
  const livePositionIds = useMemo(
    () => (state?.livePositions ?? []).map((p) => p.betId),
    [state?.livePositions]
  );

  const [prevLiveIds, setPrevLiveIds] = useState<{
    events: number[];
    positions: number[];
  } | null>(null);
  if (
    prevLiveIds === null ||
    prevLiveIds.events !== liveEventIds ||
    prevLiveIds.positions !== livePositionIds
  ) {
    setPrevLiveIds({ events: liveEventIds, positions: livePositionIds });
    const pruned = pruneLiveDockLocks(locks, liveEventIds, livePositionIds);
    if (
      pruned.events.length !== locks.events.length ||
      pruned.positions.length !== locks.positions.length
    ) {
      setLocks(pruned);
    }
  }

  useEffect(() => {
    writeLiveDockLocks(locks);
  }, [locks]);

  const setExpandedPersist = useCallback((next: boolean) => {
    setExpanded(next);
    writeLiveDockExpanded(next);
  }, []);

  const toggleEventLock = useCallback((eventId: number) => {
    setLocks((prev) => {
      const next = { ...prev, events: toggleLockId(prev.events, eventId) };
      writeLiveDockLocks(next);
      return next;
    });
  }, []);

  const togglePositionLock = useCallback((betId: number) => {
    setLocks((prev) => {
      const next = { ...prev, positions: toggleLockId(prev.positions, betId) };
      writeLiveDockLocks(next);
      return next;
    });
  }, []);

  const recordPlacings = useCallback(
    async (eventId: number, payload: PlacingsPayload) => {
      try {
        await api(`/api/events/${eventId}`, {
          method: "PATCH",
          json: {
            raceWinner: payload.winner,
            raceRunners: payload.runners,
            status: "finished",
          },
        });
        await refresh();
        toast.success("Race result saved", {
          description:
            "Place-refund free bets will award if your horse finished 2nd–4th.",
        });
      } catch (e) {
        toast.error("Could not save result", { description: String(e) });
      }
    },
    [refresh]
  );

  const lockedEventSet = useMemo(() => new Set(locks.events), [locks.events]);
  const lockedPositionSet = useMemo(
    () => new Set(locks.positions),
    [locks.positions]
  );

  const tabCount = tab === "positions" ? positionCount : eventCount;
  const lockedForTab =
    tab === "positions" ? locks.positions.length : locks.events.length;
  const hiddenWhenCollapsed = Math.max(0, tabCount - lockedForTab);

  const visibleIds: Set<number> | null = expanded
    ? null
    : tab === "positions"
      ? lockedPositionSet
      : lockedEventSet;

  const collapsedHint =
    !expanded && hiddenWhenCollapsed > 0 ? (
      <CollapsedEmptyHint
        hiddenCount={hiddenWhenCollapsed}
        onExpand={() => setExpandedPersist(true)}
      />
    ) : undefined;

  let panel: ReactNode;
  if (tab === "positions") {
    panel = (
      <PositionList
        state={state}
        visibleIds={visibleIds}
        lockedIds={lockedPositionSet}
        onToggleLock={togglePositionLock}
        footerHint={collapsedHint}
      />
    );
  } else {
    panel = (
      <EventsList
        state={state}
        visibleIds={visibleIds}
        lockedIds={lockedEventSet}
        onToggleLock={toggleEventLock}
        onRecordPlacings={recordPlacings}
        footerHint={collapsedHint}
      />
    );
  }

  const showBody = expanded || lockedForTab > 0 || hiddenWhenCollapsed > 0;

  const expandControl = (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground hover:text-foreground"
      aria-expanded={expanded}
      aria-controls={LIVE_DOCK_PANEL_ID}
      aria-label={expanded ? "Collapse Live dock" : "Expand Live dock"}
      onClick={() => setExpandedPersist(!expanded)}
    >
      <ChevronUp
        className={cn(
          "size-3.5 transition-transform motion-reduce:transition-none",
          // Collapsed: point up (expand into History). Expanded: point down (collapse).
          expanded && "rotate-180"
        )}
        style={{
          transitionDuration: `${SPRING_DURATION_MS}ms`,
          transitionTimingFunction: COLLAPSE_EASE,
        }}
        aria-hidden
      />
    </Button>
  );

  return (
    <section
      className={cn(
        docked
          ? "flex min-h-0 shrink-0 flex-col overflow-hidden bg-transparent"
          : dashboardSection,
        className
      )}
    >
      <DashboardSectionHeader
        prominent
        className="bg-page"
        icon={hasLiveEvent ? Radio : undefined}
        iconClassName={
          hasLiveEvent
            ? "animate-pulse text-profit motion-reduce:animate-none"
            : undefined
        }
        title="Live"
        description="In-play events and open positions."
        action={
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Tabs value={tab} onValueChange={setTab} activationMode="manual">
              <TabsList variant="segmented">
                <TabsTrigger value="events">
                  <Radio className="size-3.5 shrink-0" />
                  Events
                  {eventCount > 0 ? (
                    <span className={filterPillCountState(tab === "events")}>
                      {eventCount}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="positions">
                  <Target className="size-3.5 shrink-0" />
                  Positions
                  {positionCount > 0 ? (
                    <span className={filterPillCountState(tab === "positions")}>
                      {positionCount}
                    </span>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {expandControl}
          </div>
        }
      />
      <CardContent
        id={LIVE_DOCK_PANEL_ID}
        className={cn(
          "flex min-h-0 flex-col overflow-hidden p-0",
          !showBody && "hidden"
        )}
      >
        <ScrollFadeEdges
          className={cn(
            "min-h-0 flex-1",
            docked &&
              (expanded
                ? "max-h-[min(42vh,22rem)]"
                : "max-h-[min(28vh,14rem)]")
          )}
          fadeClassName={docked ? "from-page" : "from-card"}
          scrollClassName="app-scroll-nested px-[var(--layout-card-x)] pb-3 pt-2"
        >
          {showBody ? panel : null}
        </ScrollFadeEdges>
      </CardContent>
    </section>
  );
}
