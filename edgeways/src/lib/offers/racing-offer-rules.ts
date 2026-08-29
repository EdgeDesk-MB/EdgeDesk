import type { OfferRow } from "@/lib/db/schema";
import type { OddsSource } from "@/lib/racing/odds";
import type { RacingDeskRace, SuggestedRunner } from "@/lib/racing-desk/types";
import type { ExchangeOddsSource } from "@/lib/services/exchange/types";
import {
  placeRefundRunnerEv,
  resolveOfferConfidence,
  type OfferConfidence,
} from "@/lib/offers/place-refund-ev";

export interface BetGetFreePlaceRules {
  type: "bet_get_free_place";
  minRunners: number;
  regions: ("GB" | "IRE")[];
  qualifyingPlaces: number[];
  betStake: number;
  freeBetAmount: number;
  /** Place pays only when the race winner was the Starting Price favourite. */
  winnerMustBeSpFavourite?: boolean;
  /**
   * Optional floor on the SP favourite's Starting Price (decimal), e.g. 2.5.
   * Only meaningful with `winnerMustBeSpFavourite`.
   */
  minFavouriteSpOdds?: number;
  /**
   * When true, Racing Desk spawns a fresh twin after each play today.
   * Default / absent = one-time (no twin).
   */
  repeatSameDay?: boolean;
  /** Money-back-if-loses (Refund-If): underlay, convert only if the back loses. */
  refundIf?: boolean;
}

export function normalizeCourseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** All UK/IRE courses vs one or more named tracks. */
export function isRegionalScope(scopeCourse: string | null | undefined): boolean {
  const scope = scopeCourse?.trim().toLowerCase();
  return !scope || scope === "all" || scope === "uk_ire" || scope === "any";
}

/**
 * Named courses from `scope_course` (comma / " & " / " and " / " or " separated).
 * Regional sentinels yield []. Display forms are preserved; duplicates dropped.
 */
export function parseScopeCourses(scopeCourse: string | null | undefined): string[] {
  if (!scopeCourse?.trim() || isRegionalScope(scopeCourse)) return [];
  const parts = scopeCourse
    .split(/\s*(?:,|&| and | or )\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = normalizeCourseName(part);
    if (!key || key === "all" || key === "uk_ire" || key === "any") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

/** Persist one or more courses in the existing `scope_course` text column. */
export function encodeScopeCourses(courses: string[]): string {
  return parseScopeCourses(courses.join(", ")).join(", ");
}

/**
 * Course, race and meeting-day locks apply to qualifying legs only.
 * Free-bet conversion stays usable on any event in the same sport.
 */
export function betTypeUsesOfferVenueScope(betType: string | null | undefined): boolean {
  return betType !== "free_snr" && betType !== "free_sr";
}

/** True when the race course is in the offer's named-course list (or scope is regional). */
export function courseMatchesScope(
  raceCourse: string | null | undefined,
  scopeCourse: string | null | undefined
): boolean {
  if (isRegionalScope(scopeCourse)) return true;
  const course = raceCourse?.trim();
  if (!course) return false;
  const key = normalizeCourseName(course);
  return parseScopeCourses(scopeCourse).some((c) => normalizeCourseName(c) === key);
}

export function formatOfferScopeLabel(
  scopeCourse: string | null | undefined,
  scopeRaceLabel?: string | null
): string {
  const courses = parseScopeCourses(scopeCourse);
  const courseLabel = courses.length > 0 ? courses.join(", ") : null;
  if (scopeRaceLabel?.trim()) {
    return courseLabel
      ? `${courseLabel} · ${scopeRaceLabel.trim()}`
      : scopeRaceLabel.trim();
  }
  if (isRegionalScope(scopeCourse)) return "UK & Ireland";
  return courseLabel ?? scopeCourse!.trim();
}

export function parseOfferRules(
  offer: Pick<OfferRow, "offerType" | "rules">
): BetGetFreePlaceRules | null {
  if (offer.offerType !== "bet_get_free_place" || !offer.rules) return null;
  try {
    const parsed = JSON.parse(offer.rules) as BetGetFreePlaceRules;
    if (parsed.type !== "bet_get_free_place") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * True when the free bet / refund depends on a finishing position (or SP-favourite
 * place clause). Straight "bet £X get £Y" offers store empty `qualifyingPlaces`
 * and must not drive Best plays / place-target intelligence.
 */
export function offerHasResultTrigger(
  rules: Pick<BetGetFreePlaceRules, "qualifyingPlaces" | "winnerMustBeSpFavourite"> | null | undefined
): boolean {
  if (!rules) return false;
  if (rules.winnerMustBeSpFavourite) return true;
  return rules.qualifyingPlaces.some((p) => Number.isInteger(p) && p >= 1);
}

/** True when the offer may be played again today (desk spawns a twin after each bet). */
export function offerRepeatsSameDay(
  rules: Pick<BetGetFreePlaceRules, "repeatSameDay"> | null | undefined
): boolean {
  return rules?.repeatSameDay === true;
}

function placeOrdinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

export function formatBetGetFreePlaceSummary(
  rules: BetGetFreePlaceRules,
  opts?: { includeRegions?: boolean }
): string {
  const stakeClause = `Bet £${rules.betStake} get £${rules.freeBetAmount} free`;
  let rewardClause = stakeClause;
  if (rules.refundIf) {
    rewardClause = `£${rules.freeBetAmount} back as free bet if the bet loses`;
  } else if (offerHasResultTrigger(rules)) {
    const places = rules.qualifyingPlaces.join(", ");
    let placeClause = rules.winnerMustBeSpFavourite
      ? `${rules.qualifyingPlaces.map(placeOrdinal).join(", ")} to SP favourite`
      : `places ${places}`;
    if (
      rules.winnerMustBeSpFavourite &&
      rules.minFavouriteSpOdds != null &&
      rules.minFavouriteSpOdds > 1
    ) {
      placeClause += ` (min fav SP ${rules.minFavouriteSpOdds})`;
    }
    rewardClause = `${stakeClause} if ${placeClause}`;
  }
  const parts = [rewardClause, `min ${rules.minRunners} runners`];
  if (opts?.includeRegions !== false) {
    parts.push(rules.regions.join(" & "));
  }
  return parts.join(" · ");
}

export function placeRefundTriggerText(rules: BetGetFreePlaceRules): string {
  if (rules.refundIf) {
    return `Bet £${rules.betStake} get £${rules.freeBetAmount} free bet if bet loses`;
  }
  if (!offerHasResultTrigger(rules)) {
    return `Bet £${rules.betStake} get £${rules.freeBetAmount} FB`;
  }
  const places = rules.qualifyingPlaces.join(", ");
  if (rules.winnerMustBeSpFavourite) {
    const ordinals = rules.qualifyingPlaces.map(placeOrdinal).join(", ");
    const minSp =
      rules.minFavouriteSpOdds != null && rules.minFavouriteSpOdds > 1
        ? ` (min fav SP ${rules.minFavouriteSpOdds})`
        : "";
    return `Bet £${rules.betStake} get £${rules.freeBetAmount} FB if ${ordinals} to SP favourite${minSp}`;
  }
  return `Bet £${rules.betStake} get £${rules.freeBetAmount} FB if ${places}`;
}

export type OfferQualifyFields = Pick<
  OfferRow,
  "eventDate" | "scopeCourse" | "scopeRaceId" | "scopeRaceLabel" | "offerType" | "rules"
>;

export function raceQualifiesForOffer(
  offer: OfferQualifyFields,
  race: Pick<RacingDeskRace, "course" | "fieldSize" | "region" | "externalId" | "offTime">,
  date: string
): { qualifies: boolean; reasons: string[] } {
  const rules = parseOfferRules(offer);
  if (!rules) return { qualifies: false, reasons: ["Unsupported offer type"] };

  const reasons: string[] = [];

  if (offer.eventDate && offer.eventDate !== date) {
    reasons.push(`Offer is for ${offer.eventDate}, not ${date}`);
  }

  // Specific race lock - must match Racing API id (or off-time fallback via label)
  const raceId = offer.scopeRaceId?.trim();
  if (raceId) {
    if (race.externalId !== raceId) {
      reasons.push(`Not the scoped race (${offer.scopeRaceLabel ?? raceId})`);
    }
  } else if (!courseMatchesScope(race.course, offer.scopeCourse)) {
    const scope = formatOfferScopeLabel(offer.scopeCourse);
    reasons.push(`Course ${race.course} not in scope (${scope})`);
  }

  if (race.fieldSize < rules.minRunners) {
    reasons.push(`Only ${race.fieldSize} runners (need ${rules.minRunners}+)`);
  }

  // Region filter only for UK/IRE regional scope - course/race locks already pin the meeting
  if (!raceId && isRegionalScope(offer.scopeCourse)) {
    const region = (race.region ?? "GB").toUpperCase();
    const allowed = rules.regions.map((r) => r.toUpperCase());
    if (!allowed.includes(region as "GB" | "IRE")) {
      reasons.push(`Region ${region} not covered (${allowed.join(", ")})`);
    }
  }

  return { qualifies: reasons.length === 0, reasons };
}

/**
 * How many races pass the same qualify checks as Racing desk.
 * Returns null when the offer has no structured place-refund rules, or when
 * no race has a known field size to evaluate (caller can fall back to scope counts).
 */
export function countOfferQualifyingRaces(
  offer: OfferQualifyFields,
  races: Array<{
    course: string;
    fieldSize?: number | null;
    region?: string | null;
    externalId?: string | null;
  }>,
  date: string
): number | null {
  if (!parseOfferRules(offer)) return null;
  let evaluated = 0;
  let qualifying = 0;
  for (const race of races) {
    const fieldSize = race.fieldSize ?? 0;
    if (!(fieldSize > 0)) continue;
    evaluated += 1;
    const { qualifies } = raceQualifiesForOffer(
      offer,
      {
        course: race.course,
        fieldSize,
        region: race.region ?? "GB",
        externalId: race.externalId ?? "",
        offTime: "",
      },
      date
    );
    if (qualifies) qualifying += 1;
  }
  return evaluated > 0 ? qualifying : null;
}

/**
 * Softer match for Add bet: course / race / date / bookie.
 * Skips field-size (often unknown in the dialog).
 */
export function offerMatchesBetContext(
  offer: Pick<
    OfferRow,
    | "sport"
    | "status"
    | "eventDate"
    | "scopeCourse"
    | "scopeRaceId"
    | "scopeRaceLabel"
    | "bookmaker"
    | "offerType"
    | "rules"
  >,
  ctx: {
    date: string;
    course?: string | null;
    raceExternalId?: string | null;
    offTime?: string | null;
    bookmaker?: string | null;
    /** Convert ignores course / race / meeting-day. Default qualify. */
    purpose?: "qualify" | "convert";
  }
): boolean {
  if (offer.sport !== "horse_racing") return false;
  if (offer.status !== "active" && offer.status !== "planned") return false;
  if (!parseOfferRules(offer as OfferRow)) return false;

  if (ctx.bookmaker?.trim() && offer.bookmaker?.trim()) {
    if (offer.bookmaker.trim().toLowerCase() !== ctx.bookmaker.trim().toLowerCase()) {
      return false;
    }
  }

  if (ctx.purpose === "convert") return true;

  if (offer.eventDate && offer.eventDate !== ctx.date) return false;

  const raceId = offer.scopeRaceId?.trim();
  if (raceId) {
    if (ctx.raceExternalId?.trim() && ctx.raceExternalId.trim() === raceId) return true;
    // Off-time + course fallback when external id missing
    const label = offer.scopeRaceLabel?.toLowerCase() ?? "";
    const off = ctx.offTime?.trim().toLowerCase() ?? "";
    const course = ctx.course?.trim() ? normalizeCourseName(ctx.course) : "";
    if (off && label.includes(off) && course && label.includes(course)) return true;
    return false;
  }

  if (!isRegionalScope(offer.scopeCourse)) {
    if (!ctx.course?.trim()) return false;
    return courseMatchesScope(ctx.course, offer.scopeCourse);
  }

  // Regional UK/IRE - any racing event that day qualifies for picker
  return true;
}

/**
 * Price used to rank place-refund shape. Hosted free racecards leave bookie/SP
 * blank, so fall through to the live exchange book the same way Offer Edge does.
 */
function runnerRankingPrice(
  runner: Pick<
    RacingDeskRace["runners"][number],
    "bookieDecimal" | "spDecimal" | "exchangeBackDecimal" | "exchangeDecimal"
  >
): number | null {
  const price =
    runner.bookieDecimal ??
    runner.spDecimal ??
    runner.exchangeBackDecimal ??
    runner.exchangeDecimal;
  return price != null && price > 1 ? price : null;
}

/** Heuristic: predictable 2nd/3rd/4th when favourite is clear and place contenders cluster. */
export function scorePlaceRefundStrategy(
  race: Pick<RacingDeskRace, "runners" | "fieldSize">
): { score: number; summary: string } {
  const active = race.runners.filter((r) => !r.nonRunner);
  const priced = active
    .map((r) => ({
      price: runnerRankingPrice(r),
      spreadPct: r.spreadPct,
      oddsSource: r.oddsSource,
    }))
    .filter((p): p is { price: number; spreadPct: number | undefined; oddsSource: OddsSource | undefined } =>
      p.price != null && p.price > 1
    )
    .sort((a, b) => a.price - b.price);

  if (priced.length < 4) {
    return { score: 0, summary: "Awaiting runner prices" };
  }

  const usingEstimates = priced.every((p) => p.oddsSource === "proxy");
  const prices = priced.map((p) => p.price);

  const fav = prices[0];
  const p2 = prices[1];
  const p4 = prices[3];
  const p5 = prices[4] ?? p4 * 1.5;

  let score = 0;
  const parts: string[] = [];

  const favGap = (p2 - fav) / fav;
  if (fav <= 2.5 || favGap >= 0.35) {
    score += 35;
    parts.push("Clear favourite");
  }

  const clusterSpread = (p4 - p2) / p2;
  if (clusterSpread <= 0.85) {
    score += 35;
    parts.push("Places 2–4 clustered");
  }

  const outsiderGap = (p5 - p4) / p4;
  if (outsiderGap >= 0.2) {
    score += 30;
    parts.push("Gap before rest of field");
  }

  const topSpreads = priced.slice(0, 4).map((p) => p.spreadPct).filter((s): s is number => s != null);
  if (!usingEstimates && topSpreads.length >= 3) {
    const avgSpread = topSpreads.reduce((a, b) => a + b, 0) / topSpreads.length;
    if (avgSpread <= 4) {
      score += 15;
      parts.push("Tight bookie/exchange");
    } else if (avgSpread <= 8) {
      score += 8;
      parts.push("Reasonable exchange match");
    }
  }

  score = Math.min(100, score);
  if (usingEstimates) {
    score = Math.min(score, 65);
  }

  const summary = parts.length
    ? `${usingEstimates ? "Estimate · " : ""}${parts.join(" · ")}`
    : usingEstimates
      ? "Estimate · weak place-refund shape"
      : "Weak place-refund shape";

  return { score, summary };
}

interface PricedRunner {
  horseId: string;
  name: string;
  price: number;
  rank: number;
  spreadPct?: number;
  oddsSource?: OddsSource;
  exchangeSource?: ExchangeOddsSource;
  exchangeDecimal?: number;
}

function pricedRunners(race: Pick<RacingDeskRace, "runners">): PricedRunner[] {
  return race.runners
    .filter((r) => !r.nonRunner)
    .map((r) => ({
      horseId: r.horseId,
      name: r.name,
      price: runnerRankingPrice(r) ?? 0,
      rank: 0,
      spreadPct: r.spreadPct,
      oddsSource: r.oddsSource,
      exchangeSource: r.exchangeSource,
      exchangeDecimal: r.exchangeDecimal,
    }))
    .filter((r) => r.price > 1)
    .sort((a, b) => a.price - b.price)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Runner-level place-refund targets: horses priced 2nd–5th, not favourite,
 * likely to finish behind a clear SP favourite in the place zone.
 */
export function scorePlaceRefundRunners(
  race: Pick<RacingDeskRace, "runners" | "fieldSize">,
  offer?: { betStake: number; freeBetAmount: number; offerId?: number }
): SuggestedRunner[] {
  const priced = pricedRunners(race);
  if (priced.length < 4) return [];

  const fav = priced[0];
  const usingEstimates = priced.every((p) => p.oddsSource === "proxy");
  const favGap = priced[1] ? (priced[1].price - fav.price) / fav.price : 0;
  const cluster = priced.slice(1, 4);
  const clusterSpread =
    cluster.length >= 3 ? (cluster[2].price - cluster[1].price) / cluster[1].price : 1;

  const contenders = priced.filter((p) => p.rank >= 2 && p.rank <= 5);
  const suggestions: SuggestedRunner[] = [];

  for (const runner of contenders) {
    let score = 0;
    const parts: string[] = [];

    if (runner.rank === 2) {
      score += 40;
      parts.push("Market 2nd favourite");
      if (favGap >= 0.3) {
        score += 25;
        parts.push("Likely runner-up behind fav");
      }
    } else if (runner.rank === 3) {
      score += 30;
      parts.push("Place cluster #3");
      if (clusterSpread <= 0.5) {
        score += 15;
        parts.push("Tight with 2nd/4th");
      }
    } else if (runner.rank === 4) {
      score += 25;
      parts.push("Place cluster #4");
    } else {
      score += 15;
      parts.push("Place zone outsider");
    }

    if (fav.price <= 2.5 || favGap >= 0.35) {
      score += 10;
      parts.push("Strong favourite ahead");
    }

    if (runner.exchangeSource === "live" && runner.spreadPct != null) {
      if (runner.spreadPct <= 4) {
        score += 15;
        parts.push("Tight live lay");
      } else if (runner.spreadPct <= 8) {
        score += 8;
        parts.push("OK exchange match");
      }
    } else if (!usingEstimates && runner.spreadPct != null && runner.spreadPct <= 6) {
      score += 5;
    }

    if (usingEstimates) score = Math.min(score, 60);

    const label =
      runner.exchangeSource === "live"
        ? "Live lay"
        : usingEstimates
          ? "Estimate"
          : runner.exchangeSource === "estimated"
            ? "Est. lay"
            : "";

    const confidence: OfferConfidence = resolveOfferConfidence(
      runner.oddsSource,
      runner.exchangeSource
    );

    let qualLoss: number | undefined;
    let freeBetEv: number | undefined;
    let totalEv: number | undefined;

    if (offer && offer.betStake > 0 && offer.freeBetAmount > 0) {
      const layOdds = runner.exchangeDecimal ?? runner.price * 1.03;
      const ev = placeRefundRunnerEv({
        betStake: offer.betStake,
        freeBetAmount: offer.freeBetAmount,
        backOdds: runner.price,
        layOdds,
        marketRank: runner.rank,
        fieldSize: race.fieldSize,
      });
      qualLoss = ev.qualLoss;
      freeBetEv = ev.freeBetEv;
      totalEv = ev.totalEv;
    }

    suggestions.push({
      horseId: runner.horseId,
      name: runner.name,
      marketRank: runner.rank,
      score: Math.min(100, score),
      summary: label ? `${label} · ${parts.join(" · ")}` : parts.join(" · "),
      bookieDecimal: runner.price,
      exchangeDecimal: runner.exchangeDecimal,
      oddsSource: runner.oddsSource,
      exchangeSource: runner.exchangeSource,
      qualLoss,
      freeBetEv,
      totalEv,
      confidence,
      offerId: offer?.offerId,
    });
  }

  return suggestions
    .filter((s) => s.score >= 35)
    .sort((a, b) => (b.totalEv ?? b.score) - (a.totalEv ?? a.score))
    .slice(0, 3);
}
