"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SportIcon } from "@/components/sport-icon";
import { EventSearchSelect } from "@/components/event-search-select";
import {
  bandNotTrackedFixtures,
  bandTrackedEvents,
  filterByOfferCourseScope,
  fixtureSelectValue,
  groupByHourBandIfDense,
  knownFixtureSearchOption,
  parseFixtureSelectValue,
  toEventSearchSection,
  trackedEventSearchOption,
  type EventSearchSection,
  type KnownFixtureOption,
} from "@/lib/add-bet-event-options";
import { type TrackedEventLike } from "@/lib/events";
import { api } from "@/hooks/use-app-state";
import { useKnownFixtures } from "@/hooks/use-known-fixtures";
import { useNow } from "@/hooks/use-now";
import { MARKETS, marketDef } from "@/lib/markets";
import {
  formatOfferScopeLabel,
  isRegionalScope,
} from "@/lib/offers/racing-offer-rules";
import { isRacingSport, SPORTS } from "@/lib/sports";
import type { EventRow } from "@/lib/db/schema";
import { sectionDescription } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export type DeskLegEventDraft = {
  sport: string;
  eventId: number | null;
  /** Untracked fixture held until parent save — never POSTs /track while editing. */
  pendingFixture: KnownFixtureOption | null;
  market: string;
  selection: string;
};

type HourBanded<T> = {
  key: string;
  label: string;
  hours: { key: string; label: string; items: T[] }[];
};

function selectionChoices(
  sport: string,
  market: string,
  teams: { homeTeam?: string | null; awayTeam?: string | null } | undefined,
  runners: string[]
): { value: string; label: string }[] {
  if (isRacingSport(sport) && runners.length > 0) {
    return runners.map((r) => ({ value: r, label: r }));
  }
  const def = marketDef(sport, market);
  const opts = def?.options;
  if (!opts?.length) return [];
  if (
    (market === "match_odds" || market === "match_winner" || market === "draw_no_bet") &&
    teams &&
    !isRacingSport(sport)
  ) {
    return opts.map((opt) => {
      if (opt === "home") return { value: "home", label: teams.homeTeam || "Home" };
      if (opt === "away") return { value: "away", label: teams.awayTeam || "Away" };
      if (opt === "draw") return { value: "draw", label: "Draw" };
      return { value: opt, label: opt };
    });
  }
  return opts.map((opt) => ({ value: opt, label: opt }));
}

function toHourBands<T extends { startTime?: number }>(
  dayBands: { key: string; label: string; items: T[] }[]
): HourBanded<T>[] {
  return dayBands.map((band) => ({
    key: band.key,
    label: band.label,
    hours: groupByHourBandIfDense(band.items),
  }));
}

/**
 * Sport + Add-bet-style Events list (full card, then Tracked) + market/selection.
 * Untracked picks stay pending until the parent saves (Create run / Save).
 */
export function DeskLegEventFields({
  value,
  onChange,
  events,
  disabled,
  showMarketSelection = true,
  /** Hide sport/event when the parent already owns the linked fixture (BB legs). */
  showSportEvent = true,
  scopeCourse,
  className,
  onEventLinked,
}: {
  value: DeskLegEventDraft;
  onChange: (next: DeskLegEventDraft) => void;
  events: EventRow[];
  disabled?: boolean;
  showMarketSelection?: boolean;
  showSportEvent?: boolean;
  /** Named-course lock (qualify). Event list stays on that meeting. */
  scopeCourse?: string | null;
  className?: string;
  /** Kick-off hint when an event or pending fixture is chosen (for schedule fields). */
  onEventLinked?: (hint: { startTime: number | null }) => void;
}) {
  const sport = value.sport || "football";
  const courseScope =
    scopeCourse?.trim() && !isRegionalScope(scopeCourse)
      ? scopeCourse.trim()
      : null;
  const courseScopeLocked = Boolean(courseScope);
  const courseScopeLabel = courseScope
    ? formatOfferScopeLabel(courseScope)
    : null;
  const sportSelectId = useId();
  const eventSelectId = useId();
  const eventHintId = useId();
  const marketSelectId = useId();
  const selectionFieldId = useId();
  const markets = MARKETS[sport] ?? MARKETS.other ?? [];

  const { fixtures: knownFixtures, loading: fixturesLoading } = useKnownFixtures(sport);
  const [runners, setRunners] = useState<string[]>([]);
  const [runnersLoading, setRunnersLoading] = useState(false);
  const now = useNow(30_000);

  const selectedEvent = useMemo(() => {
    if (value.eventId == null) return undefined;
    return events.find((e) => e.id === value.eventId);
  }, [value.eventId, events]);

  const keepIds = useMemo(() => {
    if (value.eventId == null) return undefined;
    return new Set([value.eventId]);
  }, [value.eventId]);

  const trackedForSport = useMemo(() => {
    const base = events.filter(
      (e) => e.sport === sport || (value.eventId != null && e.id === value.eventId)
    ) as TrackedEventLike[];
    if (!courseScope || !isRacingSport(sport)) return base;
    const scoped = filterByOfferCourseScope(base, courseScope);
    if (value.eventId != null && !scoped.some((e) => e.id === value.eventId)) {
      const linked = base.find((e) => e.id === value.eventId);
      if (linked) return [linked, ...scoped];
    }
    return scoped;
  }, [events, sport, value.eventId, courseScope]);

  const trackedHourBands = useMemo(
    () => toHourBands(bandTrackedEvents(trackedForSport, now, keepIds)),
    [trackedForSport, keepIds, now]
  );

  const trackedExternalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of events) {
      if (e.externalId) ids.add(e.externalId);
    }
    return ids;
  }, [events]);

  const fixturesForList = useMemo(() => {
    let base = knownFixtures.filter((f) => f.sport === sport);
    if (courseScope && isRacingSport(sport)) {
      base = filterByOfferCourseScope(base, courseScope);
    }
    const pending = value.pendingFixture;
    if (
      pending &&
      pending.sport === sport &&
      !base.some((f) => f.externalId === pending.externalId)
    ) {
      return [...base, pending];
    }
    return base;
  }, [knownFixtures, sport, value.pendingFixture, courseScope]);

  const notTrackedHourBands = useMemo(
    () => toHourBands(bandNotTrackedFixtures(fixturesForList, trackedExternalIds)),
    [fixturesForList, trackedExternalIds]
  );

  const eventSearchSections = useMemo<EventSearchSection[]>(
    () => [
      ...(notTrackedHourBands.length > 0
        ? [
            toEventSearchSection(
              "fixtures",
              isRacingSport(sport) ? "Today's races" : "Fixtures",
              notTrackedHourBands,
              knownFixtureSearchOption
            ),
          ]
        : []),
      ...(trackedHourBands.length > 0
        ? [
            toEventSearchSection(
              "tracked",
              "Tracked",
              trackedHourBands,
              trackedEventSearchOption
            ),
          ]
        : []),
    ],
    [notTrackedHourBands, trackedHourBands, sport]
  );

  // Runners for a tracked race only. Pending fixtures use card runners (no network).
  const runnersEventId =
    isRacingSport(sport) && value.eventId != null && !value.pendingFixture
      ? value.eventId
      : null;
  const [prevRunnersEventId, setPrevRunnersEventId] = useState(runnersEventId);
  if (prevRunnersEventId !== runnersEventId) {
    setPrevRunnersEventId(runnersEventId);
    if (runnersEventId === null) {
      if (runners.length > 0) setRunners([]);
      if (runnersLoading) setRunnersLoading(false);
    } else if (!runnersLoading) {
      setRunnersLoading(true);
    }
  }

  useEffect(() => {
    if (runnersEventId === null) return;
    let cancelled = false;
    api<{ runners: string[] }>(`/api/racing/runners?eventId=${runnersEventId}`)
      .then((res) => {
        if (!cancelled) setRunners(res.runners ?? []);
      })
      .catch(() => {
        if (!cancelled) setRunners([]);
      })
      .finally(() => {
        if (!cancelled) setRunnersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runnersEventId]);

  const effectiveRunners =
    value.pendingFixture?.runners?.length
      ? value.pendingFixture.runners
      : runners;
  const teamSource = value.pendingFixture ?? selectedEvent;
  const choices = selectionChoices(sport, value.market, teamSource, effectiveRunners);

  const selectValue = value.pendingFixture
    ? fixtureSelectValue(value.pendingFixture.externalId)
    : value.eventId != null
      ? String(value.eventId)
      : courseScopeLocked
        ? "__scope_pending__"
        : "none";

  function changeSport(next: string) {
    const nextMarkets = MARKETS[next] ?? MARKETS.other ?? [];
    const keepMarket = nextMarkets.some((m) => m.value === value.market);
    onChange({
      ...value,
      sport: next,
      eventId: null,
      pendingFixture: null,
      market: keepMarket ? value.market : (nextMarkets[0]?.value ?? "other"),
      selection: "",
    });
  }

  function changeEvent(raw: string) {
    if (raw === "none") {
      if (courseScopeLocked) return;
      onChange({ ...value, eventId: null, pendingFixture: null, selection: "" });
      return;
    }
    if (raw === "__scope_pending__") return;

    const externalId = parseFixtureSelectValue(raw);
    if (externalId) {
      const fixture =
        fixturesForList.find((f) => f.externalId === externalId) ??
        (value.pendingFixture?.externalId === externalId ? value.pendingFixture : null);
      if (!fixture) return;
      const nextSport = fixture.sport || value.sport;
      const nextMarkets = MARKETS[nextSport] ?? MARKETS.other ?? [];
      const keepMarket = nextMarkets.some((m) => m.value === value.market);
      onChange({
        ...value,
        sport: nextSport,
        eventId: null,
        pendingFixture: fixture,
        market: keepMarket ? value.market : (nextMarkets[0]?.value ?? "other"),
        selection: "",
      });
      onEventLinked?.({ startTime: fixture.startTime ?? null });
      return;
    }

    const id = Number(raw);
    const ev = events.find((e) => e.id === id);
    if (!ev) {
      onChange({ ...value, eventId: null, pendingFixture: null });
      return;
    }
    const nextSport = ev.sport || value.sport;
    const nextMarkets = MARKETS[nextSport] ?? MARKETS.other ?? [];
    const keepMarket = nextMarkets.some((m) => m.value === value.market);
    onChange({
      ...value,
      eventId: ev.id,
      pendingFixture: null,
      sport: nextSport,
      market: keepMarket ? value.market : (nextMarkets[0]?.value ?? "other"),
      selection: "",
    });
    onEventLinked?.({ startTime: ev.startTime ?? null });
  }

  function changeMarket(next: string) {
    onChange({ ...value, market: next, selection: "" });
  }

  function changeSelection(next: string) {
    onChange({ ...value, selection: next });
  }

  const sportLabel = SPORTS.find((s) => s.value === sport)?.label ?? sport;
  const fixtureSport = sport === "football" || sport === "horse_racing";
  const showLoadingHint =
    fixturesLoading && notTrackedHourBands.length === 0 && fixtureSport;
  const showEmptyHint =
    !fixturesLoading &&
    trackedHourBands.length === 0 &&
    notTrackedHourBands.length === 0 &&
    fixtureSport;
  return (
    <div className={cn("grid gap-2", className)}>
      {showSportEvent ? (
        <>
        <div className="grid min-w-0 grid-cols-2 gap-2 max-sm:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor={sportSelectId} className="text-xs text-muted-foreground">
              Sport
            </Label>
            <Select
              value={sport}
              onValueChange={changeSport}
              disabled={disabled || courseScopeLocked}
            >
              <SelectTrigger
                id={sportSelectId}
                className="w-full"
                aria-label={
                  courseScopeLocked
                    ? `Sport, locked to ${sportLabel} for this campaign`
                    : undefined
                }
              >
                <SelectValue>
                  <span className="flex items-center gap-1.5">
                    <SportIcon sport={sport} className="size-3.5 shrink-0" />
                    {sportLabel}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SPORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-1.5">
                      <SportIcon sport={s.value} className="size-3.5 shrink-0" />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor={eventSelectId}
                className="min-w-0 text-pretty break-words text-xs text-muted-foreground"
              >
                {courseScopeLocked && courseScopeLabel
                  ? `Event · ${courseScopeLabel}`
                  : "Event"}
              </Label>
              {value.eventId != null || value.pendingFixture ? (
                <button
                  type="button"
                  aria-label="Clear event"
                  className="shrink-0 text-xs font-medium text-primary-text underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...value,
                      eventId: null,
                      pendingFixture: null,
                      selection: "",
                    })
                  }
                >
                  Clear
                </button>
              ) : null}
            </div>
            <EventSearchSelect
              id={eventSelectId}
              value={selectValue}
              onValueChange={changeEvent}
              disabled={disabled}
              ariaDescribedBy={
                courseScopeLocked && courseScopeLabel ? eventHintId : undefined
              }
              placeholder={
                courseScopeLocked && courseScopeLabel
                  ? `Select a ${courseScopeLabel} race`
                  : "Manual entry"
              }
              searchPlaceholder={
                isRacingSport(sport) ? "Search races…" : "Search events…"
              }
              topRow={
                courseScopeLocked && courseScopeLabel
                  ? {
                      value: "__scope_pending__",
                      label: `Select a ${courseScopeLabel} race`,
                      disabled: true,
                    }
                  : { value: "none", label: "Manual entry" }
              }
              sections={eventSearchSections}
              loading={showLoadingHint}
              loadingLabel={
                isRacingSport(sport) ? "Loading races…" : "Loading fixtures…"
              }
              emptyLabel={
                showEmptyHint
                  ? courseScopeLocked && courseScopeLabel
                    ? `No ${courseScopeLabel} races loaded yet for this day.`
                    : `No ${sportLabel} fixtures loaded.`
                  : null
              }
            />
          </div>
        </div>
        {courseScopeLocked && courseScopeLabel ? (
          <span id={eventHintId} className={sectionDescription}>
            Limited to {courseScopeLabel} races for this campaign.
          </span>
        ) : null}
        </>
      ) : null}
      {showMarketSelection ? (
        <div className="grid min-w-0 grid-cols-2 gap-2 max-sm:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor={marketSelectId} className="text-xs text-muted-foreground">
              Market
            </Label>
            <Select
              value={value.market || markets[0]?.value || "other"}
              onValueChange={changeMarket}
              disabled={disabled}
            >
              <SelectTrigger id={marketSelectId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {markets.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor={selectionFieldId} className="text-xs text-muted-foreground">
              Selection
            </Label>
            {choices.length > 0 ? (
              <Select
                value={value.selection || undefined}
                onValueChange={changeSelection}
                disabled={disabled || runnersLoading}
              >
                <SelectTrigger id={selectionFieldId} className="w-full">
                  <SelectValue
                    placeholder={runnersLoading ? "Loading runners…" : "Pick selection"}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {choices.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={selectionFieldId}
                value={value.selection}
                onChange={(e) => changeSelection(e.target.value)}
                placeholder={
                  isRacingSport(sport)
                    ? runnersLoading
                      ? "Loading runners…"
                      : "e.g. horse name"
                    : "e.g. selection"
                }
                disabled={disabled}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
