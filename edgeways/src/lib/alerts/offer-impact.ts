/**
 * When an offer alert should interrupt: closer to impact, not on create.
 *
 * Racing course/race scope → ~15 min before the first relevant off.
 * Hard promo expiry (no race times) → ~2 h before deadline.
 */

import {
  effectiveOfferExpiryMs,
  parseScopeRaceOffTime,
  ukDateTimeToUtcMs,
} from "@/lib/offers/offer-expiry";
import { offerRequiredStake } from "@/lib/offers/offer-required-stake";
import {
  countOfferQualifyingRaces,
  courseMatchesScope,
  isRegionalScope,
  parseScopeCourses,
} from "@/lib/offers/racing-offer-rules";
import {
  formatAlertHours,
  formatAlertMinutes,
} from "@/lib/alerts/toast-age";
import { formatClockString, formatClockTime } from "@/lib/time-format";

/** Lead before a race / first course off. Matches race_off_soon. */
export const OFFER_RACE_LEAD_MS = 15 * 60_000;
/** Lead before a calendar / promo hard deadline with no race impact. */
export const OFFER_EXPIRY_LEAD_MS = 2 * 60 * 60_000;

export type OfferImpactSource = "edge" | "race" | "course" | "expiry";

export interface OfferImpactOffer {
  id: number;
  title: string;
  sport: string | null;
  eventDate: string | null;
  scopeCourse: string | null;
  scopeRaceId: string | null;
  scopeRaceLabel: string | null;
  expiresAt: number | null;
  /** Needed by effectiveOfferExpiryMs; alerts only see live campaigns. */
  status?: "planned" | "active" | "completed" | "expired" | null;
  /** Drives raceQualifiesForOffer (Racing desk parity). */
  offerType?: string | null;
  /** JSON rules text - stake, free-bet amount, min runners, regions. */
  rules?: string | null;
  /** Linked qualifying activity - meeting-start nudges stay quiet once placed. */
  qualifyingOpenCount?: number;
  qualifyingSettledCount?: number;
}

function asExpiryFields(offer: OfferImpactOffer) {
  return {
    expiresAt: offer.expiresAt,
    eventDate: offer.eventDate,
    scopeRaceLabel: offer.scopeRaceLabel,
    scopeRaceId: offer.scopeRaceId,
    sport: offer.sport,
    status: offer.status ?? ("active" as const),
  };
}

export interface OfferImpactRace {
  course: string;
  offTime: number;
  /** Racing API id when known (race-locked offers). */
  externalId?: string | null;
  /** Declared / card runners; required to evaluate min-runners qualify. */
  fieldSize?: number | null;
  /** GB / IRE when known; defaults to GB in qualify checks. */
  region?: string | null;
}

export interface OfferImpact {
  at: number;
  source: OfferImpactSource;
  /** Named course(s) for copy, or null when regional / no scope ("Meeting"). */
  label: string | null;
  /** 24h HH:mm for a race-locked off. */
  raceClockHhmm: string | null;
  /** 24h HH:mm of the first relevant off (course / edge meeting). */
  firstOffHhmm: string | null;
  /** Matching races on the scoped card(s); null when unknown / not course-based. */
  scopedRaceCount: number | null;
  /**
   * Races that pass Racing-desk qualify checks (min runners, region, scope).
   * Null when rules are unstructured or no field sizes are available yet.
   */
  qualifyingRaceCount: number | null;
}

function isHorseRacing(sport: string | null | undefined): boolean {
  return sport === "horse_racing";
}

function courseLabel(scopeCourse: string | null | undefined): string | null {
  const courses = parseScopeCourses(scopeCourse);
  if (courses.length === 0) return null;
  return courses.join(" & ");
}

function hhmmFromParts(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Epoch ms → UK wall-clock HH:mm for race/meeting copy. */
export function utcMsToUkHhmm(ms: number): string | null {
  if (!Number.isFinite(ms)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  if (hour == null || minute == null) return null;
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function emptyImpact(
  at: number,
  source: OfferImpactSource,
  over: Partial<OfferImpact> = {}
): OfferImpact {
  return {
    at,
    source,
    label: null,
    raceClockHhmm: null,
    firstOffHhmm: null,
    scopedRaceCount: null,
    qualifyingRaceCount: null,
    ...over,
  };
}

/** UK calendar YYYY-MM-DD for an epoch (offer event day / alert day). */
export function ukDateYmd(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function qualifyDateForOffer(offer: OfferImpactOffer, fallbackMs: number): string {
  return offer.eventDate?.trim() || ukDateYmd(fallbackMs);
}

function qualifyingCountFor(
  offer: OfferImpactOffer,
  races: OfferImpactRace[],
  atMs: number
): number | null {
  return countOfferQualifyingRaces(
    {
      eventDate: offer.eventDate,
      scopeCourse: offer.scopeCourse,
      scopeRaceId: offer.scopeRaceId,
      scopeRaceLabel: offer.scopeRaceLabel,
      offerType: offer.offerType ?? null,
      rules: offer.rules ?? null,
    },
    races,
    qualifyDateForOffer(offer, atMs)
  );
}

export type OfferImpactActionKind =
  | "place_qualifying"
  | "convert_free_bet"
  | "start_planned"
  | "review_expiry"
  | string;

/**
 * Resolve the moment the user should act for this offer.
 * Qualifying / start → race or first course off.
 * Convert / review expiry → hard promo deadline (the free bet clock).
 */
export function resolveOfferImpact(
  offer: OfferImpactOffer,
  races: OfferImpactRace[],
  edgeStartTime?: number | null,
  actionKind?: OfferImpactActionKind | null
): OfferImpact | null {
  const expiryOnly =
    actionKind === "convert_free_bet" || actionKind === "review_expiry";
  if (expiryOnly) {
    const expiry = effectiveOfferExpiryMs(asExpiryFields(offer));
    if (expiry == null) return null;
    return emptyImpact(expiry, "expiry");
  }

  // Meeting / course / race copy and "N races qualify" are horse-racing only.
  if (isHorseRacing(offer.sport)) {
    if (edgeStartTime != null && edgeStartTime > 0) {
      const label = courseLabel(offer.scopeCourse);
      let scopedRaceCount: number | null = null;
      if (label) {
        const matching = races.filter((r) =>
          courseMatchesScope(r.course, offer.scopeCourse)
        );
        if (matching.length > 0) scopedRaceCount = matching.length;
      }
      return emptyImpact(edgeStartTime, "edge", {
        label,
        firstOffHhmm: utcMsToUkHhmm(edgeStartTime),
        scopedRaceCount,
        qualifyingRaceCount: qualifyingCountFor(offer, races, edgeStartTime),
      });
    }

    const ymd = offer.eventDate?.trim();
    const off = parseScopeRaceOffTime(offer.scopeRaceLabel);
    if (ymd && off && (offer.scopeRaceId?.trim() || offer.scopeRaceLabel?.trim())) {
      const at = ukDateTimeToUtcMs(ymd, off.hours, off.minutes);
      if (at != null) {
        const hhmm = hhmmFromParts(off.hours, off.minutes);
        return emptyImpact(at, "race", {
          label: courseLabel(offer.scopeCourse),
          raceClockHhmm: hhmm,
          firstOffHhmm: hhmm,
          scopedRaceCount: 1,
          qualifyingRaceCount: qualifyingCountFor(offer, races, at),
        });
      }
    }

    if (!isRegionalScope(offer.scopeCourse)) {
      const matching = races
        .filter((r) => courseMatchesScope(r.course, offer.scopeCourse))
        .map((r) => r.offTime)
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b);
      if (matching.length > 0) {
        // First race at the course marks meeting impact. If already past, the
        // in-play path still nudges once while the promo window is open.
        return emptyImpact(matching[0]!, "course", {
          label: courseLabel(offer.scopeCourse),
          firstOffHhmm: utcMsToUkHhmm(matching[0]!),
          scopedRaceCount: matching.length,
          qualifyingRaceCount: qualifyingCountFor(offer, races, matching[0]!),
        });
      }
    }

    // Regional UK/IRE with a race card but no Edge startTime: still surface
    // qualify counts when falling through is not taken (expiry below).
  }

  const expiry = effectiveOfferExpiryMs(asExpiryFields(offer));
  if (expiry == null) return null;
  return emptyImpact(expiry, "expiry");
}

/** True when now sits in the useful reminder window for this impact. */
export function isOfferImpactAlertDue(
  impact: OfferImpact,
  now: number,
  hardExpiryMs: number | null
): boolean {
  const until = impact.at - now;
  const lead =
    impact.source === "expiry" ? OFFER_EXPIRY_LEAD_MS : OFFER_RACE_LEAD_MS;

  if (until > lead) return false; // too early
  if (until > 0) return true; // inside lead-up window

  // Impact already passed: still remind while the promo/window is open so a
  // mid-meeting create (or late open) gets one useful nudge, not silence.
  if (hardExpiryMs != null && now >= hardExpiryMs) return false;
  return true;
}

/** Offer title only - bookie is EdgeAlert.bookmaker (toast badge / plain prefix). */
function bodyLead(offerTitle: string): string {
  return offerTitle.trim() || "Offer";
}

/** Compact £ amount for notification CTA copy. */
export function formatAlertStake(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(2).replace(/\.?0+$/, "");
}

/** Place phrase for the title: Meeting / Galway / Galway 14:00 */
export function formatImpactPlace(impact: OfferImpact): string {
  const place = impact.label?.trim() || null;
  const clock = impact.raceClockHhmm
    ? formatClockString(impact.raceClockHhmm)
    : null;
  if (impact.source === "race" && clock) {
    return place ? `${place} ${clock}` : clock;
  }
  return place ?? "Meeting";
}

function isMultiCourse(label: string | null | undefined): boolean {
  return Boolean(label && label.includes(" & "));
}

function startVerb(impact: OfferImpact): "start" | "starts" {
  return isMultiCourse(impact.label) ? "start" : "starts";
}

function isQualifyingAction(kind: OfferImpactActionKind | null | undefined): boolean {
  return kind == null || kind === "place_qualifying" || kind === "start_planned";
}

function qualifyingNoun(stake: number | null | undefined): string {
  const s = stake != null ? formatAlertStake(stake) : "";
  return s ? `£${s} qualifying bet` : "qualifying bet";
}

function qualifyingCta(stake: number | null | undefined): string {
  return `place the ${qualifyingNoun(stake)}`;
}

function finishQualifyingCta(stake: number | null | undefined): string {
  return `finish the ${qualifyingNoun(stake)}`;
}

function convertCta(freeBetAmount: number | null | undefined): string {
  const s = freeBetAmount != null ? formatAlertStake(freeBetAmount) : "";
  return s ? `convert the £${s} free bet` : "convert the free bet";
}

function raceCardSuffix(impact: OfferImpact): string | null {
  // Race-locked copy already names the single race clock.
  if (impact.source === "race") return null;

  const qualify = impact.qualifyingRaceCount;
  if (qualify != null && qualify > 0) {
    const noun = qualify === 1 ? "1 race qualifies" : `${qualify} races qualify`;
    if (isMultiCourse(impact.label)) {
      return `${noun} across ${impact.label}`;
    }
    return noun;
  }

  const count = impact.scopedRaceCount;
  if (count == null || count <= 1) return null;
  if (isMultiCourse(impact.label)) {
    return `${count} races across ${impact.label}`;
  }
  return `${count} races`;
}

function firstOffSuffix(impact: OfferImpact): string | null {
  // Race-locked titles already carry the clock; body uses "on the HH:mm".
  if (impact.source === "race") return null;
  const hhmm = impact.firstOffHhmm ?? impact.raceClockHhmm;
  if (!hhmm) return null;
  return `first race ${formatClockString(hhmm)}`;
}

function joinBody(lead: string, ...parts: Array<string | null | undefined>): string {
  return [lead, ...parts.filter((p): p is string => Boolean(p?.trim()))].join(" · ");
}

export function offerExpiringAlertCopy(args: {
  remainingEv: number;
  offerTitle: string;
  impact: OfferImpact;
  now: number;
  /** Kept for call-site symmetry; bookie is EdgeAlert.bookmaker, not body text. */
  bookmaker?: string | null;
  actionKind?: OfferImpactActionKind | null;
  /** Qualifying stake when known (rules / title). */
  stake?: number | null;
  /** Free-bet amount for convert actions. */
  freeBetAmount?: number | null;
}): { title: string; body: string } {
  void args.bookmaker;
  const pounds = Math.max(0, Math.round(args.remainingEv));
  const until = args.impact.at - args.now;
  const lead = bodyLead(args.offerTitle);
  const place = formatImpactPlace(args.impact);
  const qualifying = isQualifyingAction(args.actionKind);
  const card = raceCardSuffix(args.impact);
  const firstOff = firstOffSuffix(args.impact);

  if (args.impact.source !== "expiry" && until > 0) {
    const mins = Math.max(1, Math.round(until / 60_000));
    const title = `⚡ £${pounds} edge · ${place} ${startVerb(args.impact)} in ${formatAlertMinutes(mins)}`;

    if (args.impact.source === "race" && args.impact.raceClockHhmm) {
      const clock = formatClockString(args.impact.raceClockHhmm);
      return {
        title,
        body: qualifying
          ? joinBody(lead, qualifyingCta(args.stake), `on the ${clock}`)
          : joinBody(lead, `act on the ${clock}`),
      };
    }

    if (!args.impact.label) {
      const openWhen = firstOff
        ? `opens ${firstOff.replace(/^first race /, "")}`
        : "opens with the first race";
      return {
        title,
        body: qualifying
          ? joinBody(lead, qualifyingCta(args.stake), openWhen, card)
          : joinBody(lead, "window opens with the first race", firstOff, card),
      };
    }

    return {
      title,
      body: qualifying
        ? joinBody(lead, qualifyingCta(args.stake), firstOff, card)
        : joinBody(lead, "act before the meeting runs", firstOff, card),
    };
  }

  if (args.impact.source !== "expiry" && until <= 0) {
    const title = `⚡ £${pounds} edge · ${place} under way`;
    if (args.impact.source === "race") {
      return {
        title,
        body: qualifying
          ? joinBody(lead, finishQualifyingCta(args.stake), "last chance on this race")
          : joinBody(lead, "finish while this race scope applies"),
      };
    }
    const where = args.impact.label?.trim() || "the meeting";
    const live = isMultiCourse(where) ? `${where} are live` : `${where} is live`;
    return {
      title,
      body: qualifying
        ? joinBody(lead, `${finishQualifyingCta(args.stake)} while ${live}`, card)
        : joinBody(lead, `finish while ${live}`, card),
    };
  }

  // Hard promo / free-bet clock: the opportunity ends.
  const expiryClock = formatClockTime(args.impact.at);
  if (until > 0 && until <= OFFER_EXPIRY_LEAD_MS) {
    const mins = Math.round(until / 60_000);
    const when =
      mins >= 60
        ? formatAlertHours(Math.round(mins / 60))
        : formatAlertMinutes(Math.max(1, mins));
    const title = `⚡ £${pounds} edge ends in ${when}`;
    if (args.actionKind === "convert_free_bet") {
      return {
        title,
        body: joinBody(lead, `${convertCta(args.freeBetAmount)} before ${expiryClock}`),
      };
    }
    if (qualifying) {
      return {
        title,
        body: joinBody(lead, `${qualifyingCta(args.stake)} before ${expiryClock}`),
      };
    }
    return {
      title,
      body: joinBody(lead, `expires ${expiryClock}`),
    };
  }

  if (args.actionKind === "convert_free_bet") {
    return {
      title: `⚡ £${pounds} edge ends today`,
      body: joinBody(lead, `${convertCta(args.freeBetAmount)} before it expires`),
    };
  }
  if (qualifying) {
    return {
      title: `⚡ £${pounds} edge ends today`,
      body: joinBody(lead, `${qualifyingCta(args.stake)} before it expires`),
    };
  }
  return {
    title: `⚡ £${pounds} edge ends today`,
    body: joinBody(lead, "claim before it expires"),
  };
}

/** Stake / free-bet figures for alert copy from offer + do-next context. */
export function alertCopyAmounts(input: {
  offer?: Pick<OfferImpactOffer, "rules" | "title"> | null;
  offerTitle?: string | null;
  convertLotRemaining?: number | null;
}): { stake: number | null; freeBetAmount: number | null } {
  const stake = input.offer
    ? offerRequiredStake({
        rules: input.offer.rules ?? null,
        title: input.offer.title ?? input.offerTitle,
      })
    : offerRequiredStake({ rules: null, title: input.offerTitle });

  let freeBetAmount =
    input.convertLotRemaining != null && input.convertLotRemaining > 0
      ? input.convertLotRemaining
      : null;
  if (freeBetAmount == null && input.offer?.rules) {
    try {
      const parsed = JSON.parse(input.offer.rules) as { freeBetAmount?: unknown };
      if (typeof parsed.freeBetAmount === "number" && parsed.freeBetAmount > 0) {
        freeBetAmount = parsed.freeBetAmount;
      }
    } catch {
      // ignore
    }
  }
  return { stake, freeBetAmount };
}
