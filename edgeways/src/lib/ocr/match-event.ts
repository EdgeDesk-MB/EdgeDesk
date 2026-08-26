/**
 * Match OCR-parsed event hints to tracked / known fixtures.
 */
import type { BetOcrFields } from "@/lib/ocr/types";
import {
  formatRacingEventTitle,
  normaliseRacingApiOffTime,
  racingVenueLabel,
  type TrackedEventLike,
} from "@/lib/events";

export type MatchableEvent = TrackedEventLike;

export interface EventMatchResult {
  eventId: number;
  confidence: "high" | "medium";
  label: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function teamMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function parseTimeMs(time?: string): number | null {
  if (!time?.match(/^\d{1,2}:\d{2}$/)) return null;
  const [h, m] = time.split(":").map(Number);
  return (h * 60 + m) * 60_000;
}

function clockFromRacingItem(item: {
  startTime?: number | null;
  awayTeam?: string | null;
  offTime?: string | null;
}): string | null {
  if (item.offTime?.trim()) return normaliseRacingApiOffTime(item.offTime);
  if (item.startTime != null && Number.isFinite(item.startTime)) {
    const d = new Date(item.startTime);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const away = item.awayTeam?.trim();
  if (away && /^\d{1,2}:\d{2}$/.test(away)) return normaliseRacingApiOffTime(away);
  return null;
}

export type RacingSlipMatchable = {
  sport?: string | null;
  status?: string | null;
  competition?: string | null;
  course?: string | null;
  startTime?: number | null;
  awayTeam?: string | null;
  offTime?: string | null;
};

/** Course + off-time only — never first-meeting fallback (acca legs must not collide). */
export function matchOcrRacingSlip<T extends RacingSlipMatchable>(
  hint: { course?: string; eventTime?: string },
  items: readonly T[]
): T | undefined {
  const course = hint.course?.trim();
  const time = hint.eventTime?.trim();
  if (!course || !time) return undefined;
  const wantMs = parseTimeMs(time);
  if (wantMs == null) return undefined;
  return items.find((item) => {
    if (item.status === "finished") return false;
    if (item.sport && item.sport !== "horse_racing") return false;
    const venue =
      item.course?.trim() || racingVenueLabel(item.competition) || item.competition || "";
    if (!teamMatch(venue, course)) return false;
    const clock = clockFromRacingItem(item);
    const haveMs = parseTimeMs(clock ?? undefined);
    return haveMs != null && haveMs === wantMs;
  });
}

function eventStartWindow(event: MatchableEvent): { start: number; end: number } {
  const day = new Date(event.startTime ?? 0);
  day.setHours(0, 0, 0, 0);
  return { start: day.getTime(), end: day.getTime() + 86_400_000 };
}

export function matchOcrToEvent(
  fields: BetOcrFields,
  events: MatchableEvent[]
): EventMatchResult | null {
  const candidates = events.filter((e) => e.status !== "finished");
  if (candidates.length === 0) return null;

  const ocrTimeMs = parseTimeMs(fields.eventTime);
  const ocrDate = fields.eventDate;

  // Football: Home v Away
  if (fields.homeTeam && fields.awayTeam) {
    for (const event of candidates) {
      if (event.sport !== "football") continue;
      if (!teamMatch(event.homeTeam, fields.homeTeam) || !teamMatch(event.awayTeam, fields.awayTeam)) {
        continue;
      }
      return {
        eventId: event.id,
        confidence: "high",
        label: `${event.homeTeam} v ${event.awayTeam}`,
      };
    }
  }

  // Racing: venue + time
  const venue =
    fields.eventName?.split("·")[0]?.trim() ||
    (fields.homeTeam && !fields.awayTeam ? fields.homeTeam : undefined);

  if (venue || fields.marketHint === "win" || fields.marketHint === "place") {
    for (const event of candidates) {
      if (event.sport !== "horse_racing") continue;
      const eventVenue = racingVenueLabel(event.competition) || event.competition || "";
      const venueOk = venue ? teamMatch(eventVenue, venue) : false;

      let timeOk = false;
      if (ocrTimeMs != null && event.startTime) {
        const d = new Date(event.startTime);
        const eventMs = (d.getHours() * 60 + d.getMinutes()) * 60_000;
        timeOk = Math.abs(eventMs - ocrTimeMs) <= 3 * 60_000;
      } else if (event.awayTeam && fields.eventTime) {
        timeOk = norm(event.awayTeam) === norm(fields.eventTime);
      }

      if (fields.selection && event.sport === "horse_racing") {
        // weak signal only
      }

      if (venueOk && timeOk) {
        return {
          eventId: event.id,
          confidence: "high",
          label: formatRacingEventTitle(event),
        };
      }
      if (venueOk) {
        return {
          eventId: event.id,
          confidence: "medium",
          label: formatRacingEventTitle(event),
        };
      }
    }
  }

  // Event name contains both teams
  if (fields.eventName?.includes(" v ")) {
    const [home, away] = fields.eventName.split(/\s+v\s+/i).map((s) => s.trim());
    if (home && away) {
      return matchOcrToEvent({ ...fields, homeTeam: home, awayTeam: away }, events);
    }
  }

  // Date + time window for racing
  if (ocrDate && ocrTimeMs != null) {
    const target = new Date(`${ocrDate}T${fields.eventTime}:00`).getTime();
    if (Number.isFinite(target)) {
      let best: MatchableEvent | null = null;
      let bestDelta = Infinity;
      for (const event of candidates) {
        if (event.startTime == null) continue;
        const delta = Math.abs(event.startTime - target);
        if (delta < bestDelta && delta < 30 * 60_000) {
          bestDelta = delta;
          best = event;
        }
      }
      if (best) {
        return {
          eventId: best.id,
          confidence: "medium",
          label:
            best.sport === "horse_racing"
              ? formatRacingEventTitle(best)
              : `${best.homeTeam} v ${best.awayTeam}`,
        };
      }
    }
  }

  return null;
}
