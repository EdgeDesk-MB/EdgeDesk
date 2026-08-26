/** Shared helpers for tracked events in bet entry and the Events page. */

import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/display-timezone";
import { isRacingSport } from "@/lib/sports";
import { formatClockString, formatClockTime } from "@/lib/time-format";

/** Default fixture/event timezone (London). Prefer settings.displayTimezone in UI code. */
export const FIXTURE_TIMEZONE = DEFAULT_DISPLAY_TIMEZONE;

export function localCalendarDate(d = new Date(), timeZone = DEFAULT_DISPLAY_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** UK calendar date + HH:MM → UTC epoch ms. */
export function londonWallToUtcMs(date: string, time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const hm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const base = Date.parse(`${date}T${hm}:00Z`);
  if (Number.isNaN(base)) return null;
  for (const offsetHours of [0, 1, -1, 2, -2]) {
    const candidate = base - offsetHours * 3600_000;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: FIXTURE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(candidate));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const ymd = `${get("year")}-${get("month")}-${get("day")}`;
    if (ymd === date && `${get("hour")}:${get("minute")}` === hm) {
      return candidate;
    }
  }
  return base;
}

/** Next occurrence of a UK wall-clock kickoff (today, else tomorrow). */
export function wallClockKickoffMs(hour: number, minute = 0, now = Date.now()): number {
  const hm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const today = localCalendarDate(new Date(now));
  const todayMs = londonWallToUtcMs(today, hm);
  if (todayMs != null && todayMs > now) return todayMs;
  const noon = londonWallToUtcMs(today, "12:00") ?? now;
  const tomorrow = localCalendarDate(new Date(noon + 86400000));
  return londonWallToUtcMs(tomorrow, hm) ?? todayMs ?? now + 3600000;
}

/** HH:MM in the chosen timezone for fixture rows; prefixes weekday when not today. */
export function formatFixtureKickoff(
  startTime: number,
  now = Date.now(),
  timeZone = DEFAULT_DISPLAY_TIMEZONE
): string {
  const d = new Date(startTime);
  const time = formatClockTime(d, { timeZone });

  const dayKey = (ms: number, tz: string) => localCalendarDate(new Date(ms), tz);
  if (dayKey(startTime, timeZone) !== dayKey(now, timeZone)) {
    const dayLabel = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
    }).format(d);
    return `${dayLabel} ${time}`;
  }
  return time;
}

/**
 * Racing API prints UK off times with no am/pm: "3:10" is 15:10.
 * Same 1–10 → afternoon rule as parseScopeRaceOffTime (offer-expiry).
 */
export function normaliseRacingApiOffTime(offTime: string): string {
  const trimmed = offTime.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return normalizeEventTimeInput(trimmed) || trimmed;
  const rawHours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(rawHours) || !Number.isFinite(minutes)) return trimmed;
  if (rawHours < 0 || rawHours > 23 || minutes < 0 || minutes > 59) return trimmed;
  const hours = rawHours >= 1 && rawHours <= 10 ? rawHours + 12 : rawHours;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Normalise Racing API off_time ("2:35") to canonical 24h HH:mm. */
export function formatRacingOffTime(offTime: string): string {
  return normaliseRacingApiOffTime(offTime);
}

export interface TrackedEventLike {
  id: number;
  sport?: string;
  competition?: string | null;
  homeTeam: string;
  awayTeam: string;
  startTime?: number;
  status?: string;
  source?: string | null;
  externalId?: string | null;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function teamsMatch(a: string, b: string): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Find a tracked event matching home/away (fuzzy) for the given sport. */
export function findTrackedEvent(
  events: TrackedEventLike[],
  homeTeam: string,
  awayTeam: string,
  sport: string
): TrackedEventLike | undefined {
  const home = homeTeam.trim();
  const away = awayTeam.trim();
  if (!home || !away) return undefined;
  return events.find(
    (e) =>
      (e.sport ?? "football") === sport &&
      e.status !== "finished" &&
      teamsMatch(e.homeTeam, home) &&
      teamsMatch(e.awayTeam, away)
  );
}

export function eventDisplayName(ev: {
  homeTeam: string;
  awayTeam: string;
  competition?: string | null;
  sport?: string;
  startTime?: number;
}): string {
  if (ev.sport === "horse_racing") return formatRacingEventTitle(ev);
  const base = `${ev.homeTeam} v ${ev.awayTeam}`;
  return ev.competition?.trim() ? `${ev.competition.trim()} · ${base}` : base;
}

export function formatEventDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatEventTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Today at the current hour with minutes/seconds zeroed (e.g. 19:26 → 19:00). */
export function defaultEventDateTime(now = new Date()): { date: string; time: string } {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  return { date: formatEventDate(d.getTime()), time: formatEventTime(d.getTime()) };
}

export function parseEventStartTime(date: string, time: string): number | undefined {
  if (!date.trim()) return undefined;
  const d = new Date(`${date.trim()}T${(time.trim() || "15:00")}:00`);
  const ms = d.getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Normalise a typed HH:MM (or partial) value for event time fields. */
export function normalizeEventTimeInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{0,2}))?$/);
  if (!match) return trimmed;

  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutePart = match[2] ?? "";
  const minutes =
    minutePart === "" ? 0 : Math.min(59, Math.max(0, Number(minutePart)));

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isCompleteEventTime(time: string): boolean {
  return /^\d{2}:\d{2}$/.test(time);
}

/** Strip suffix like "(AW)" for compact venue labels in the tracker. */
export function racingVenueLabel(competition?: string | null): string {
  if (!competition?.trim()) return "Race";
  const trimmed = competition.trim();
  return trimmed.replace(/\s*\([^)]+\)\s*$/, "").trim() || trimmed;
}

/** Parse course from event name field - "Wolverhampton · 17:10" or "Wolverhampton". */
export function parseRacingCourseFromEventName(eventName: string): string {
  const trimmed = eventName.trim();
  if (!trimmed) return "";
  if (trimmed.includes("·")) return trimmed.split("·")[0]?.trim() ?? trimmed;
  return trimmed;
}

/** Short racing line for bet logs: "Wolverhampton · 17:10". */
export function formatRacingEventTitle(ev: {
  competition?: string | null;
  startTime?: number;
  awayTeam?: string;
}): string {
  const venue = racingVenueLabel(ev.competition);
  const time =
    ev.startTime != null
      ? formatEventTime(ev.startTime)
      : ev.awayTeam?.trim()
        ? normalizeEventTimeInput(ev.awayTeam)
        : "";
  return time ? `${venue} · ${formatClockString(time)}` : venue;
}

/** Status line for racing events - never football scores. */
export function formatRacingEventStatus(
  ev: {
    status: string;
    sport?: string;
    source?: string | null;
    startTime?: number;
  },
  raceResult?: { winner: string } | null,
  now = Date.now()
): string {
  // Same live window as Home: off-time passed (and not finished) counts as live
  // even if the DB row is still "upcoming" awaiting a results sync.
  const status = effectiveEventStatus(
    { ...ev, sport: ev.sport ?? "horse_racing" },
    now
  );
  if (status === "live") return "Live";
  if (status === "finished" && raceResult?.winner) return `Won by ${raceResult.winner}`;
  if (status === "finished") return "Result";
  return "Upcoming";
}

/** Tracker / dashboard event title. */
export function formatEventTitle(ev: {
  sport?: string;
  homeTeam: string;
  awayTeam: string;
  competition?: string | null;
  startTime?: number;
}): string {
  if (ev.sport === "horse_racing") return formatRacingEventTitle(ev);
  return `${ev.homeTeam} v ${ev.awayTeam}`;
}

/**
 * Live football clock: HT / Pens / ET from API-Football period, else the minute.
 * Half-time is `status.short === "HT"`; we used to store that as 45'.
 */
export function footballClockLabel(ev: {
  minute?: number | null;
  period?: string | null;
}): string | null {
  const period = ev.period?.trim().toUpperCase();
  if (period === "HT") return "HT";
  if (period === "BT") return "BT";
  if (period === "P") return "Pens";
  if (period === "ET") {
    const extra = ev.minute ?? 0;
    return extra > 0 ? `ET ${extra}'` : "ET";
  }
  const minute = ev.minute ?? 0;
  if (minute <= 0) return null;
  return `${minute}'`;
}

/** Tracker / dashboard event status subtitle. */
export function formatEventStatus(
  ev: {
    sport?: string;
    status: string;
    homeScore: number;
    awayScore: number;
    minute: number;
    period?: string | null;
    goals?: string | null;
    source?: string | null;
    startTime?: number;
  },
  raceResult?: { winner: string } | null,
  now = Date.now()
): string {
  if (ev.sport === "horse_racing") return formatRacingEventStatus(ev, raceResult, now);
  const status = effectiveEventStatus(ev, now);
  if (status === "live") {
    const clock = footballClockLabel(ev);
    const min = clock ? ` (${clock})` : "";
    return `LIVE ${ev.homeScore}-${ev.awayScore}${min}`;
  }
  if (status === "finished") return `FT ${ev.homeScore}-${ev.awayScore}`;
  return "upcoming";
}

/**
 * Football (and other score sports) only show a score once the match is live
 * or finished. Upcoming rows keep 0-0 or a stale API score off the desk
 * (EDGE-56). Racing never uses this path.
 */
export function eventShowsScore(
  ev: {
    sport?: string;
    status: string;
    source?: string | null;
    startTime?: number;
  },
  now = Date.now()
): boolean {
  if (ev.sport === "horse_racing" || ev.sport === "greyhounds") return false;
  const status = effectiveEventStatus(ev, now);
  return status === "live" || status === "finished";
}

/**
 * Display status for tracked events. API-fed football matches flip to live once
 * kickoff passes even if the score poll hasn't run yet.
 */
export function effectiveEventStatus(
  ev: {
    sport?: string;
    status: string;
    source?: string | null;
    startTime?: number;
  },
  now = Date.now()
): "upcoming" | "live" | "finished" {
  if (ev.status === "finished") return "finished";
  if (ev.status === "live") return "live";
  if (ev.startTime != null && ev.startTime <= now) {
    const sport = ev.sport ?? "football";
    if (
      sport === "football" &&
      ev.source === "api" &&
      ev.startTime > now - 4 * 60 * 60 * 1000
    ) {
      return "live";
    }
    if (sport === "horse_racing" && ev.startTime > now - 90 * 60 * 1000) {
      return "live";
    }
  }
  return "upcoming";
}

export type NavLivePulseScope = "all" | "racing";

type LiveNavEvent = {
  sport?: string;
  status: string;
  source?: string | null;
  startTime?: number;
};

/**
 * How many tracked events should drive a sidebar live-pulse.
 * Racing Desk only pulses for horse racing / greyhounds, not a live football match.
 */
export function countLiveNavEvents(
  events: LiveNavEvent[],
  scope: NavLivePulseScope = "all",
  now = Date.now()
): number {
  return events.filter((e) => {
    if (effectiveEventStatus(e, now) !== "live") return false;
    if (scope === "racing") return isRacingSport(e.sport);
    return true;
  }).length;
}

/** Label for the Events dropdown in Add bet. */
export function formatTrackedEventOption(ev: TrackedEventLike): string {
  if (ev.sport === "horse_racing") {
    const status =
      ev.status === "live" ? " · LIVE" : ev.status === "finished" ? " · Result" : "";
    return `${formatRacingEventTitle(ev)}${status}`;
  }
  const status =
    ev.status === "live" ? " · LIVE" : ev.status === "finished" ? " · FT" : "";
  const when =
    ev.startTime != null
      ? ` · ${formatEventDate(ev.startTime)} ${formatClockString(formatEventTime(ev.startTime))}`
      : "";
  return `${ev.homeTeam} v ${ev.awayTeam}${when}${status}`;
}

export function sortTrackedEvents<T extends TrackedEventLike>(events: T[], now = Date.now()): T[] {
  const rank = (ev: TrackedEventLike) => {
    const s = effectiveEventStatus(
      {
        sport: ev.sport,
        status: ev.status ?? "upcoming",
        source: ev.source,
        startTime: ev.startTime,
      },
      now
    );
    if (s === "live") return 0;
    if (s === "upcoming") return 1;
    return 2;
  };
  return [...events].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    // Finished: most recent kickoff first; live/upcoming: soonest first
    if (ra === 2) return (b.startTime ?? 0) - (a.startTime ?? 0);
    return (a.startTime ?? 0) - (b.startTime ?? 0);
  });
}

/** Live or not yet finished - for the Fixtures browser. */
export function isCurrentOrFutureFixture(status: string): boolean {
  return status === "live" || status === "upcoming";
}

/** Live first, then by kick-off time ascending. */
export function sortFixturesByKickoff<T extends { status: string; startTime: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    if (a.status === "live" && b.status !== "live") return -1;
    if (b.status === "live" && a.status !== "live") return 1;
    return a.startTime - b.startTime;
  });
}
