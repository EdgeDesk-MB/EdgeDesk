/**
 * Pure helpers for the Add bet Events dropdown: Tracked / Not tracked sections
 * and Today / Tomorrow day bands.
 */

import {
  formatEventTime,
  isCurrentOrFutureFixture,
  localCalendarDate,
  londonWallToUtcMs,
  normalizeEventTimeInput,
  racingVenueLabel,
  sortFixturesByKickoff,
  sortTrackedEvents,
  type TrackedEventLike,
} from "@/lib/events";
import {
  courseMatchesScope,
  isRegionalScope,
} from "@/lib/offers/racing-offer-rules";
import { parseRacecardRunners, parseRaceResults } from "@/lib/racing";
import { titleCaseHorse } from "@/lib/racing/parse-race-result-text";
import { sortRunnerNamesByOdds, type OddsSortableRunner } from "@/lib/racing/odds";
import { formatClockString } from "@/lib/time-format";

/** Tomorrow's calendar date in the fixture timezone (DST-safe via noon). */
export function tomorrowCalendarDate(now = Date.now()): string {
  const today = localCalendarDate(new Date(now));
  const noon = londonWallToUtcMs(today, "12:00") ?? now;
  return localCalendarDate(new Date(noon + 86_400_000));
}

export const FIXTURE_SELECT_PREFIX = "fixture:";

/**
 * How long after off an event stays in the Add bet Events list (racing).
 * Football uses {@link ADD_BET_FOOTBALL_IN_PLAY_MS} so in-play bets stay linkable.
 */
export const ADD_BET_EVENT_PAST_GRACE_MS = 5 * 60_000;

/**
 * Football stays pickable after kick-off for in-play linking.
 * Same 4h window as `effectiveEventStatus` for API football.
 */
export const ADD_BET_FOOTBALL_IN_PLAY_MS = 4 * 60 * 60_000;

/** True when start is in the future, or at most `graceMs` in the past. */
export function isSelectableInAddBetEvents(
  startTime: number | null | undefined,
  now = Date.now(),
  graceMs = ADD_BET_EVENT_PAST_GRACE_MS
): boolean {
  if (startTime == null || !Number.isFinite(startTime)) return true;
  return startTime > now - graceMs;
}

/**
 * Whether a fixture/tracked row belongs in Add bet Events.
 * Racing: short post-off grace. Football: full in-play window (status live or kick-off within 4h).
 */
export function isAddBetEventSelectable(
  ev: {
    startTime?: number | null;
    status?: string | null;
    sport?: string | null;
  },
  now = Date.now()
): boolean {
  if (ev.status === "finished") return false;
  const sport = ev.sport ?? "football";
  if (sport === "football") {
    if (ev.startTime == null || !Number.isFinite(ev.startTime)) {
      return ev.status === "live" || ev.status === "upcoming" || ev.status == null;
    }
    if (ev.startTime > now) return true;
    return ev.startTime > now - ADD_BET_FOOTBALL_IN_PLAY_MS;
  }
  return isSelectableInAddBetEvents(ev.startTime, now);
}

/** LIVE chip: football for the in-play window; racing for the short post-off grace. */
export function isLiveInAddBetEvents(
  startTime: number | null | undefined,
  status: string | null | undefined,
  now = Date.now(),
  graceMs = ADD_BET_EVENT_PAST_GRACE_MS,
  sport?: string | null
): boolean {
  if (status === "finished") return false;
  if (startTime != null && Number.isFinite(startTime)) {
    if (startTime > now) return false;
    // Racing always uses the short grace. Football (or live with no sport) uses in-play.
    const ms =
      sport === "horse_racing"
        ? graceMs
        : sport === "football" || status === "live"
          ? ADD_BET_FOOTBALL_IN_PLAY_MS
          : graceMs;
    return startTime > now - ms;
  }
  return status === "live";
}

/** A known upcoming fixture from API / demo, not yet in the local track list. */
export interface KnownFixtureOption {
  externalId: string;
  sport: "football" | "horse_racing";
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  status: "upcoming" | "live" | "finished";
  /** Racing: race name (also mirrored on homeTeam). */
  raceName?: string;
  /** Racing: course (also mirrored on competition). */
  course?: string;
  offTime?: string;
  runners?: string[];
}

export interface EventDayBand<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Structured Add bet Events row: title left, kick-off right.
 * Day bands already carry the date, so `time` is clock-only.
 */
export interface EventOptionParts {
  title: string;
  /** Right-rail clock via formatClockString; empty when unknown. */
  time: string;
  /** Short status chip text (Live / Result / FT), empty when none. */
  status: string;
}

export function isFixtureSelectValue(value: string): boolean {
  return value.startsWith(FIXTURE_SELECT_PREFIX);
}

export function fixtureSelectValue(externalId: string): string {
  return `${FIXTURE_SELECT_PREFIX}${externalId}`;
}

export function parseFixtureSelectValue(value: string): string | null {
  if (!isFixtureSelectValue(value)) return null;
  const id = value.slice(FIXTURE_SELECT_PREFIX.length);
  return id || null;
}

/** Calendar day key in the fixture timezone (YYYY-MM-DD). */
export function eventDayKey(startTime: number): string {
  return localCalendarDate(new Date(startTime));
}

export function formatEventDayBandLabel(startTime: number, now = Date.now()): string {
  const day = localCalendarDate(new Date(startTime));
  const today = localCalendarDate(new Date(now));
  if (day === today) return "Today";
  if (day === tomorrowCalendarDate(now)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(startTime));
}

/** Group already-sorted items into ascending day bands (Today, Tomorrow, then later dates). */
export function groupByDayBand<T extends { startTime?: number }>(
  items: T[],
  now = Date.now()
): EventDayBand<T>[] {
  const bands: EventDayBand<T>[] = [];
  for (const item of items) {
    const start = item.startTime ?? 0;
    const key = eventDayKey(start);
    const last = bands[bands.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    bands.push({
      key,
      label: formatEventDayBandLabel(start, now),
      items: [item],
    });
  }
  return bands;
}

/** Local hour bucket key as canonical 24h `HH:00`. */
export function eventHourKey(startTime: number): string {
  const d = new Date(startTime);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

export function formatEventHourBandLabel(startTime: number): string {
  return formatClockString(eventHourKey(startTime));
}

/**
 * Nest hour bands under a day when fixtures span 2+ hours.
 * Single-hour days stay flat (one band with an empty label — skip the subheader).
 */
export function groupByHourBandIfDense<T extends { startTime?: number }>(
  items: T[]
): EventDayBand<T>[] {
  if (items.length === 0) return [];
  const distinctHours = new Set(
    items.map((item) => eventHourKey(item.startTime ?? 0))
  );
  if (distinctHours.size < 2) {
    return [{ key: "all", label: "", items }];
  }
  const bands: EventDayBand<T>[] = [];
  for (const item of items) {
    const start = item.startTime ?? 0;
    const key = eventHourKey(start);
    const last = bands[bands.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    bands.push({
      key,
      label: formatEventHourBandLabel(start),
      items: [item],
    });
  }
  return bands;
}

/**
 * Link-event picker bands: Today / Tomorrow / later (ascending), then past days
 * newest-first so history is reachable without scrolling past months of races.
 */
export function bandLinkableEventsForPicker<T extends { startTime?: number }>(
  events: T[],
  now = Date.now()
): EventDayBand<T>[] {
  const today = localCalendarDate(new Date(now));
  const sorted = [...events].sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const item of sorted) {
    const day = eventDayKey(item.startTime ?? 0);
    if (day >= today) upcoming.push(item);
    else past.push(item);
  }
  return [...groupByDayBand(upcoming, now), ...groupByDayBand(past, now).reverse()];
}

export function filterNotTrackedFixtures(
  known: KnownFixtureOption[],
  trackedExternalIds: ReadonlySet<string>,
  now = Date.now()
): KnownFixtureOption[] {
  return sortFixturesByKickoff(
    known.filter(
      (f) =>
        isCurrentOrFutureFixture(f.status) &&
        isAddBetEventSelectable(f, now) &&
        Boolean(f.externalId) &&
        !trackedExternalIds.has(f.externalId)
    )
  );
}

/** Drop finished / stale rows from the Tracked section (keep `keepIds` for edit links). */
export function filterTrackedForAddBet<T extends TrackedEventLike>(
  events: T[],
  now = Date.now(),
  keepIds?: ReadonlySet<number>
): T[] {
  return events.filter((e) => {
    if (keepIds?.has(e.id)) return true;
    if (e.status === "finished") return false;
    return isAddBetEventSelectable(e, now);
  });
}

/**
 * When a campaign is scoped to one or more courses (not UK & IRE), only show
 * those meetings' races in the Add bet Events dropdown.
 */
export function filterByOfferCourseScope<
  T extends { course?: string | null; competition?: string | null },
>(items: T[], scopeCourse: string | null | undefined): T[] {
  const scope = scopeCourse?.trim();
  if (!scope || isRegionalScope(scope)) return items;
  return items.filter((item) => {
    const name = (item.course ?? item.competition ?? "").trim();
    return Boolean(name) && courseMatchesScope(name, scope);
  });
}

function racingOptionClock(ev: {
  startTime?: number | null;
  awayTeam?: string | null;
  offTime?: string | null;
}): string {
  if (ev.startTime != null && Number.isFinite(ev.startTime)) {
    return formatClockString(formatEventTime(ev.startTime));
  }
  const raw = (ev.offTime ?? ev.awayTeam ?? "").trim();
  if (!raw) return "";
  const normalised = normalizeEventTimeInput(raw);
  return normalised ? formatClockString(normalised) : "";
}

function joinEventOptionParts(parts: EventOptionParts): string {
  const when = parts.time ? ` · ${parts.time}` : "";
  const status = parts.status ? ` · ${parts.status}` : "";
  return `${parts.title}${when}${status}`;
}

/** Structured row for the Add bet Events dropdown (title | time). */
export function partsKnownFixtureOption(
  f: KnownFixtureOption,
  now = Date.now()
): EventOptionParts {
  const live = isLiveInAddBetEvents(f.startTime, f.status, now, ADD_BET_EVENT_PAST_GRACE_MS, f.sport);
  if (f.sport === "horse_racing") {
    return {
      title: racingVenueLabel(f.course ?? f.competition),
      time: racingOptionClock({
        startTime: f.startTime,
        awayTeam: f.awayTeam,
        offTime: f.offTime,
      }),
      status: live ? "Live" : "",
    };
  }
  return {
    title: `${f.homeTeam} v ${f.awayTeam}`,
    time: formatClockString(formatEventTime(f.startTime)),
    status: live ? "Live" : "",
  };
}

export function formatKnownFixtureOption(
  f: KnownFixtureOption,
  now = Date.now()
): string {
  return joinEventOptionParts(partsKnownFixtureOption(f, now));
}

/** Structured row for Tracked events in Add bet Events. */
export function partsTrackedEventOption(
  ev: TrackedEventLike,
  now = Date.now()
): EventOptionParts {
  const live = isLiveInAddBetEvents(
    ev.startTime,
    ev.status,
    now,
    ADD_BET_EVENT_PAST_GRACE_MS,
    ev.sport
  );
  if (ev.sport === "horse_racing") {
    return {
      title: racingVenueLabel(ev.competition),
      time: racingOptionClock(ev),
      status: live ? "Live" : ev.status === "finished" ? "Result" : "",
    };
  }
  return {
    title: `${ev.homeTeam} v ${ev.awayTeam}`,
    time:
      ev.startTime != null
        ? formatClockString(formatEventTime(ev.startTime))
        : "",
    status: live ? "Live" : ev.status === "finished" ? "FT" : "",
  };
}

/** Flat label for Tracked rows (search / legacy string consumers). */
export function formatTrackedEventOption(
  ev: TrackedEventLike,
  now = Date.now()
): string {
  return joinEventOptionParts(partsTrackedEventOption(ev, now));
}

/** Tracked section: same sort as today (live first, then ascending kick-off). */
export function bandTrackedEvents<T extends TrackedEventLike>(
  events: T[],
  now = Date.now(),
  keepIds?: ReadonlySet<number>
): EventDayBand<T>[] {
  return groupByDayBand(
    sortTrackedEvents(filterTrackedForAddBet(events, now, keepIds), now),
    now
  );
}

/** Not tracked section: ascending time within Today then Tomorrow. */
export function bandNotTrackedFixtures(
  known: KnownFixtureOption[],
  trackedExternalIds: ReadonlySet<string>,
  now = Date.now()
): EventDayBand<KnownFixtureOption>[] {
  return groupByDayBand(
    filterNotTrackedFixtures(known, trackedExternalIds, now),
    now
  );
}

/** Map API football fixtures into the shared option shape. */
export function knownFromFootballFixtures(
  fixtures: Array<{
    externalId: string;
    competition: string;
    homeTeam: string;
    awayTeam: string;
    startTime: number;
    status: "upcoming" | "live" | "finished";
  }>
): KnownFixtureOption[] {
  return fixtures.map((f) => ({
    externalId: f.externalId,
    sport: "football" as const,
    competition: f.competition,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    startTime: f.startTime,
    status: f.status,
  }));
}

/** Reorder runner names to match an odds-order hint (case-insensitive). */
export function orderRunnersByOddsHint(runners: string[], oddsOrder: string[]): string[] {
  if (runners.length === 0 || oddsOrder.length === 0) return runners;
  const rank = new Map(oddsOrder.map((n, i) => [n.trim().toLowerCase(), i]));
  return [...runners].sort((a, b) => {
    const ra = rank.get(a.toLowerCase());
    const rb = rank.get(b.toLowerCase());
    if (ra == null && rb == null) return 0;
    if (ra == null) return 1;
    if (rb == null) return -1;
    return ra - rb;
  });
}

function formatRunnerOptionName(name: string): string {
  return titleCaseHorse(name.trim());
}

/** Map Racing API / demo racecards into the shared option shape. */
export function knownFromRacingFixtures(
  races: Array<{
    externalId: string;
    competition: string;
    raceName: string;
    course: string;
    startTime: number;
    status: "upcoming" | "live" | "finished";
    offTime: string;
    runners?: string[];
    /** When present, runners are ordered favourite-first like Racing Desk. */
    runnerDetails?: OddsSortableRunner[];
  }>
): KnownFixtureOption[] {
  return races.map((r) => {
    const fromDetails =
      r.runnerDetails && r.runnerDetails.length > 0
        ? sortRunnerNamesByOdds(r.runnerDetails)
        : null;
    const runners = (fromDetails ?? r.runners ?? []).map(formatRunnerOptionName).filter(Boolean);
    return {
      externalId: r.externalId,
      sport: "horse_racing" as const,
      competition: r.course || r.competition,
      homeTeam: r.raceName,
      awayTeam: r.offTime,
      startTime: r.startTime,
      status: r.status,
      raceName: r.raceName,
      course: r.course || r.competition,
      offTime: r.offTime,
      runners,
    };
  });
}

/**
 * Runner names for Add bet Selection when a known race is linked.
 * Prefers pending-fixture runners, then tracked racecard / result, then a fetched list.
 * Ordered favourite-first when odds data (or an oddsOrder hint) is available.
 * Returns [] when Selection should stay free text (no event / no racecard details).
 */
export function resolveRaceRunnerOptions(input: {
  eventLinked: boolean;
  pendingRunners?: string[] | null;
  trackedGoals?: string | null;
  fetchedRunners?: string[] | null;
  /** Keep an existing pick visible when editing if it is missing from the card. */
  currentSelection?: string;
  /**
   * Preferred display order (Racing Desk odds order). Applied when the chosen
   * source is not already odds-sorted (e.g. tracked card stored in cloth order).
   */
  oddsOrder?: string[] | null;
}): string[] {
  if (!input.eventLinked) return [];

  const fromPending = (input.pendingRunners ?? []).map(formatRunnerOptionName).filter(Boolean);
  const fromTrackedCard = parseRacecardRunners(input.trackedGoals).map(formatRunnerOptionName);
  const fromResult = (() => {
    const result = parseRaceResults(input.trackedGoals);
    if (!result?.runners?.length) return [];
    return sortRunnerNamesByOdds(
      result.runners.map((r) => ({
        name: r.horse,
        spDecimal: r.spDecimal,
      }))
    ).map(formatRunnerOptionName);
  })();
  const fromFetched = (input.fetchedRunners ?? []).map(formatRunnerOptionName).filter(Boolean);

  // Fetched runners come from /api/racing/runners via Racing Desk enrichment
  // (favourite-first). Pending / tracked cards are cloth order until that lands.
  let runners: string[];
  let needsOddsHint = false;
  if (fromFetched.length > 0) {
    runners = fromFetched;
  } else if (fromPending.length > 0) {
    runners = fromPending;
    needsOddsHint = true;
  } else if (fromResult.length > 0) {
    runners = fromResult;
  } else {
    runners = fromTrackedCard;
    needsOddsHint = true;
  }

  const current = formatRunnerOptionName(input.currentSelection ?? "");

  // Keep the desk/edit pick visible while the card is still loading (empty list).
  if (runners.length === 0) return current ? [current] : [];

  if (needsOddsHint && input.oddsOrder?.length) {
    runners = orderRunnersByOddsHint(
      runners,
      input.oddsOrder.map(formatRunnerOptionName)
    );
  }

  if (current && !runners.some((r) => r.toLowerCase() === current.toLowerCase())) {
    return [current, ...runners];
  }
  return runners;
}
