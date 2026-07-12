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
}

export function normalizeCourseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** All UK/IRE courses vs a single named track. */
export function isRegionalScope(scopeCourse: string | null | undefined): boolean {
  const scope = scopeCourse?.trim().toLowerCase();
  return !scope || scope === "all" || scope === "uk_ire" || scope === "any";
}

export function formatOfferScopeLabel(
  scopeCourse: string | null | undefined,
  scopeRaceLabel?: string | null
): string {
  if (scopeRaceLabel?.trim()) {
    const course = !isRegionalScope(scopeCourse) ? scopeCourse!.trim() : null;
    return course ? `${course} · ${scopeRaceLabel.trim()}` : scopeRaceLabel.trim();
  }
  if (isRegionalScope(scopeCourse)) return "UK & Ireland";
  return scopeCourse!.trim();
}

export function parseOfferRules(offer: OfferRow): BetGetFreePlaceRules | null {
  if (offer.offerType !== "bet_get_free_place" || !offer.rules) return null;
  try {
    const parsed = JSON.parse(offer.rules) as BetGetFreePlaceRules;
    if (parsed.type !== "bet_get_free_place") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatBetGetFreePlaceSummary(
  rules: BetGetFreePlaceRules,
  opts?: { includeRegions?: boolean }
): string {
  const places = rules.qualifyingPlaces.join(", ");
  const parts = [
    `Bet £${rules.betStake} get £${rules.freeBetAmount} free if places ${places}`,
    `min ${rules.minRunners} runners`,
  ];
  if (opts?.includeRegions !== false) {
    parts.push(rules.regions.join(" & "));
  }
  return parts.join(" · ");
}

export function placeRefundTriggerText(rules: BetGetFreePlaceRules): string {
  const places = rules.qualifyingPlaces.join(", ");
  return `Bet £${rules.betStake} get £${rules.freeBetAmount} FB if ${places}`;
}

export function raceQualifiesForOffer(
  offer: OfferRow,
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
  } else {
    const scope = offer.scopeCourse?.trim();
    if (scope && !isRegionalScope(scope)) {
      if (normalizeCourseName(race.course) !== normalizeCourseName(scope)) {
        reasons.push(`Course ${race.course} not in scope (${scope})`);
      }
    }
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
  }
): boolean {
  if (offer.sport !== "horse_racing") return false;
  if (offer.status !== "active" && offer.status !== "planned") return false;
  if (!parseOfferRules(offer as OfferRow)) return false;

  if (offer.eventDate && offer.eventDate !== ctx.date) return false;

  if (ctx.bookmaker?.trim() && offer.bookmaker?.trim()) {
    if (offer.bookmaker.trim().toLowerCase() !== ctx.bookmaker.trim().toLowerCase()) {
      return false;
    }
  }

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

  const scope = offer.scopeCourse?.trim();
  if (scope && !isRegionalScope(scope)) {
    if (!ctx.course?.trim()) return false;
    return normalizeCourseName(ctx.course) === normalizeCourseName(scope);
  }

  // Regional UK/IRE - any racing event that day qualifies for picker
  return true;
}

/** Heuristic: predictable 2nd/3rd/4th when favourite is clear and place contenders cluster. */
export function scorePlaceRefundStrategy(
  race: Pick<RacingDeskRace, "runners" | "fieldSize">
): { score: number; summary: string } {
  const active = race.runners.filter((r) => !r.nonRunner);
  const priced = active
    .map((r) => ({
      price: r.bookieDecimal ?? r.spDecimal,
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
      price: r.bookieDecimal ?? r.spDecimal ?? 0,
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
