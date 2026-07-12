/**
 * External race-result deep link from tracked event fields.
 *
 * At The Races uses course + date + off-time (no opaque race ID):
 *   https://www.attheraces.com/racecard/Doncaster/03-July-2026/1655
 */

import { formatEventTime, racingVenueLabel } from "@/lib/events";

/** Display-name → ATR path segment (Title Case, spaces OK). */
const ATR_COURSE_OVERRIDES: Record<string, string> = {
  newmarketjuly: "Newmarket",
  "newmarket(july)": "Newmarket",
  "newmarketjulycourse": "Newmarket",
  newmarketrowley: "Newmarket",
  "newmarket(rowley)": "Newmarket",
  chelmsford: "Chelmsford City",
  chelmsfordcity: "Chelmsford City",
  "bath(aw)": "Bath",
  "wolverhampton(aw)": "Wolverhampton",
  "lingfield(aw)": "Lingfield",
  "kempton(aw)": "Kempton",
  "newcastle(aw)": "Newcastle",
  "southwell(aw)": "Southwell",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function normaliseKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** ATR course path segment from a competition / venue label. */
export function atrCoursePath(course: string): string | null {
  const venue = racingVenueLabel(course).trim();
  if (!venue) return null;

  const override = ATR_COURSE_OVERRIDES[normaliseKey(venue)];
  if (override) return override;

  // Title-case words; strip (AW) etc.
  const cleaned = venue.replace(/\(aw\)/gi, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** ATR date segment: 03-July-2026 */
export function atrDatePath(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()]!;
  return `${day}-${month}-${d.getFullYear()}`;
}

export type RacingResultsLink = {
  url: string;
  /** Short button label */
  label: string;
  /** Exact race page vs live board / day index */
  exact: boolean;
};

function offTimeHhmm(ev: {
  startTime?: number | null;
  awayTeam?: string | null;
}): string | null {
  if (ev.startTime != null && Number.isFinite(ev.startTime)) {
    return formatEventTime(ev.startTime).replace(":", "");
  }
  if (ev.awayTeam?.trim()) {
    const m = ev.awayTeam.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m) return `${m[1]!.padStart(2, "0")}${m[2]}`;
  }
  return null;
}

/** At The Races deep-link for this race (or meeting if time missing). */
export function buildAtrResultsLink(ev: {
  competition?: string | null;
  startTime?: number | null;
  awayTeam?: string | null;
}): RacingResultsLink | null {
  const startTime = ev.startTime != null && Number.isFinite(ev.startTime) ? ev.startTime : null;
  if (startTime == null) return null;

  const course = atrCoursePath(ev.competition?.trim() || "");
  if (!course) return null;

  const date = atrDatePath(startTime);
  const hhmm = offTimeHhmm(ev);
  if (hhmm) {
    return {
      url: `https://www.attheraces.com/racecard/${encodeURIComponent(course)}/${date}/${hhmm}`,
      label: "View race result",
      exact: true,
    };
  }

  return {
    url: `https://www.attheraces.com/results/${date}`,
    label: "View race result",
    exact: false,
  };
}

/** Links for the placings modal (ATR deep-link when course + time known). */
export function buildRacingResultsLinks(ev: {
  competition?: string | null;
  startTime?: number | null;
  awayTeam?: string | null;
}): RacingResultsLink[] {
  const atr = buildAtrResultsLink(ev);
  return atr ? [atr] : [];
}

export function buildRacingResultsLink(ev: {
  competition?: string | null;
  startTime?: number | null;
  awayTeam?: string | null;
}): RacingResultsLink | null {
  return buildAtrResultsLink(ev);
}

/** @deprecated Use atrCoursePath */
export function racingTvCourseSlug(course: string): string | null {
  const path = atrCoursePath(course);
  if (!path) return null;
  return path.toLowerCase().replace(/\s+/g, "-");
}
