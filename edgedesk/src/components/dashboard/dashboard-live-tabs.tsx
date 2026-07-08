"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyFlow } from "@/components/money-flow";
import { EmptyState } from "@/components/help/empty-state";
import type { AppState } from "@/lib/services/state";
import type { EventRow } from "@/lib/db/schema";
import { effectiveEventStatus, formatEventTitle } from "@/lib/events";
import { SportEventBlock } from "@/components/sport-icon";
import { LiveEventStatusPanel } from "@/components/events/live-event-status";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { selectionSubtle } from "@/lib/ui/surface-styles";
import { dashboardPanelBody, dashboardSection } from "@/lib/ui/dashboard-layout";
import { cn } from "@/lib/utils";
import { Radio, Target } from "lucide-react";

function PositionList({ state }: { state: AppState | null }) {
  const positions = state?.livePositions ?? [];

  if (positions.length === 0) {
    return (
      <EmptyState
        compact
        title="No live positions"
        description="Attach bets to in-play events in the tracker, or start a simulated match."
        action={{ label: "Open tracker", href: "/tracker" }}
        className="rounded-none border-0 bg-transparent py-4 shadow-none ring-0"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {positions.map((position) => (
        <Link
          key={position.betId}
          href="/tracker"
          className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-selection-subtle"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium leading-snug">{position.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
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
            {position.triggerNote && (
              <div className="mt-1 line-clamp-2 text-[11px] text-amber-600 dark:text-amber-500">
                ⚡ {position.triggerNote}
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
                <div className="text-[10px] text-muted-foreground">
                  {position.valuationMode === "model" ? "model EV" : "if ended now"}
                </div>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">manual</span>
            )}
          </div>
        </Link>
      ))}
    </div>
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

function LiveEventRow({ event }: { event: EventRow }) {
  const subtitle = liveEventSubtitle(event);

  return (
    <Link
      href="/tracked-events"
      className="block overflow-hidden rounded-lg bg-card ring-1 ring-border/50 transition-colors hover:bg-selection-subtle/40"
    >
      <div className="px-3 py-2.5">
        <SportEventBlock sport={event.sport} title={formatEventTitle(event)} titleClassName="text-sm font-semibold">
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
          )}
        </SportEventBlock>
      </div>
      <div className={cn(selectionSubtle, "border-t border-border/60 px-3 py-2")}>
        <LiveEventStatusPanel event={event} layout="bar" />
      </div>
    </Link>
  );
}

function EventsList({ state }: { state: AppState | null }) {
  const liveEvents = (state?.events ?? []).filter((e) => effectiveEventStatus(e) === "live");

  if (liveEvents.length === 0) {
    return (
      <EmptyState
        compact
        title="Nothing in play"
        description="Browse fixtures or run a simulation to see live scores here."
        action={{ label: "Browse fixtures", href: "/fixtures" }}
        className="rounded-none border-0 bg-transparent py-4 shadow-none ring-0"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {liveEvents.map((event) => (
        <LiveEventRow key={event.id} event={event} />
      ))}
    </div>
  );
}

export function DashboardLiveTabs({
  state,
  className,
}: {
  state: AppState | null;
  className?: string;
}) {
  const positionCount = state?.livePositions.length ?? 0;
  const eventCount = (state?.events ?? []).filter((e) => effectiveEventStatus(e) === "live").length;
  const defaultTab = positionCount > 0 ? "positions" : "events";

  return (
    <section className={cn(dashboardSection, className)}>
      <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
        <DashboardSectionHeader
          icon={Radio}
          title="Live"
          description="Open positions and in-play events."
        />
        <div className="shrink-0 border-b border-border/60 px-[var(--layout-card-x)] py-2.5">
          <TabsList variant="segmented">
            <TabsTrigger value="positions">
              <Target className="size-3.5 shrink-0" />
              Positions
              {positionCount > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] tabular-nums">
                  {positionCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="events">
              <Radio className="size-3.5 shrink-0" />
              Events
              {eventCount > 0 && (
                <Badge variant="active" className="h-4 min-w-4 px-1 text-[10px] tabular-nums">
                  {eventCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        <CardContent className={cn("pb-3 pt-0", dashboardPanelBody)}>
          <TabsContent value="positions" className="mt-0 outline-none">
            <PositionList state={state} />
          </TabsContent>
          <TabsContent value="events" className="mt-0 outline-none">
            <EventsList state={state} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </section>
  );
}
