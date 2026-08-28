/**
 * Assemble Racing Desk payload - racecards, movements, linked bets.
 */
import { db, bets, events, offers, type BetRow, type EventRow, type OfferRow } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { getDeskActor } from "@/lib/db/desk-scope";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { listNeonDeskOffers } from "@/lib/db/neon-desk-offers";
import { listNeonEvents } from "@/lib/db/neon-events";
import {
  getNeonDeskSettings,
  getNeonDeskSettingsForUser,
} from "@/lib/db/neon-desk-settings";
import {
  resolveRunnerOdds,
  sortRunnerNamesByOdds,
  type OddsSource,
} from "@/lib/racing/odds";
import type { RacingRunnerDetail } from "@/lib/racing-desk/types";
import {
  horseNamesMatch,
  isRaceResultIncomplete,
  parseRaceResults,
  placePositions,
  type RaceResult,
} from "@/lib/racing";
import { isDeskRacePast } from "@/lib/racing-desk/past";
import type {
  RacingDeskActiveBet,
  RacingDeskActiveOffer,
  RacingDeskPayload,
  RacingDeskRace,
  RacingDeskSummary,
  RaceOfferTag,
  SuggestedRace,
} from "@/lib/racing-desk/types";
import { parseEwMeta } from "@/lib/bets/ew-meta";
import { extraPlace } from "@/lib/calc/extra-place";
import { openBetOutcomeKind } from "@/lib/pnl/open-bet-valuation";
import {
  buildRacingDeskCampaignBets,
  deskRunnerMarksForEvent,
  isRacingDeskHiddenBet,
} from "@/lib/racing-desk/desk-active-bets";
import { listAccaRuns } from "@/lib/services/acca-desk";
import { listBetBuilderRuns } from "@/lib/services/bet-builder-desk";
import { listSystemRuns } from "@/lib/services/systems-desk";

export { isDeskRacePast } from "@/lib/racing-desk/past";
import {
  formatBetGetFreePlaceSummary,
  isRegionalScope,
  offerHasResultTrigger,
  parseOfferRules,
  placeRefundTriggerText,
  raceQualifiesForOffer,
  scorePlaceRefundRunners,
  scorePlaceRefundStrategy,
} from "@/lib/offers/racing-offer-rules";
import { syncOfferSeriesInstances } from "@/lib/offers/offer-recurrence";
import { localYmd } from "@/lib/offers/offer-recurrence-shared";
import { repairMismatchedTitlePlaceRules } from "@/lib/offers/repair-title-place-rules";
import { resolveOfferConfidence } from "@/lib/offers/place-refund-ev";
import { buildOfferEdgePlays } from "@/lib/offers/offer-edge";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import { getRealizedRetention } from "@/lib/services/retention";
import { getAppSettings } from "@/lib/services/settings";
import {
  demoMovement,
  priceMovementFor,
  recordOddsSnapshots,
} from "@/lib/services/racing-odds-snapshots";
import { listOverridesForRaces } from "@/lib/services/racing-odds-overrides";
import {
  demoRacecards,
  getCachedRacingResultsTier,
  hasRacingApiKey,
  racecardsByDate,
  racecardsFree,
  resultsToday,
  type RacingRacecard,
} from "@/lib/services/theracingapi";
import {
  getDefaultExchangeName,
  getDefaultExchangeProvider,
  getExchangeOdds,
  getExchangeProviderStatus,
  getExchangeColors,
  resolveLiveExchangeProvider,
  type ExchangeProvider,
} from "@/lib/services/exchange";
import { syncCourseOfferExpiryFromRaces } from "@/lib/offers/course-offer-sync";
import { racingPnlByRace, racingPnlToday } from "@/lib/racing/pnl-today";

/** Merge API / tracked race result onto desk runners (position, SP, distances). */
export function applyRaceResultToDeskRunners(
  runners: RacingRunnerDetail[],
  result: RaceResult
): RacingRunnerDetail[] {
  return runners.map((runner) => {
    const hit = result.runners.find((r) => horseNamesMatch(r.horse, runner.name));
    if (!hit) return runner;
    return {
      ...runner,
      finishingPosition: hit.position > 0 ? hit.position : undefined,
      spDecimal: hit.spDecimal ?? runner.spDecimal,
      spFraction: hit.spLabel ?? runner.spFraction,
      ...(hit.isSpFavourite ? { isSpFavourite: true as const } : {}),
      ...(hit.btn != null ? { btn: hit.btn } : {}),
      ...(hit.ovrBtn != null ? { ovrBtn: hit.ovrBtn } : {}),
    };
  });
}

/** Tag desk runners that appear as selections on linked tracked-event bets. */
export function applyRunnerBetMarks(
  runners: RacingRunnerDetail[],
  linkedBets: Array<Pick<BetRow, "selection" | "status">>
): RacingRunnerDetail[] {
  if (linkedBets.length === 0) return runners;

  const openSelections = linkedBets.filter((b) => b.status === "open");
  const settledSelections = linkedBets.filter((b) => b.status !== "open");

  return runners.map((runner) => {
    const openCount = openSelections.filter((b) =>
      horseNamesMatch(b.selection, runner.name)
    ).length;
    if (openCount > 0) {
      return { ...runner, betMark: { kind: "open" as const, betCount: openCount } };
    }
    const settledCount = settledSelections.filter((b) =>
      horseNamesMatch(b.selection, runner.name)
    ).length;
    if (settledCount > 0) {
      return {
        ...runner,
        betMark: { kind: "settled" as const, betCount: settledCount },
      };
    }
    return runner;
  });
}

async function loadRacecards(
  date: string,
  source: "demo" | "api"
): Promise<{
  cards: RacingRacecard[];
  oddsTier: "free" | "standard" | "demo" | "proxy";
  results: Map<string, RaceResult>;
}> {
  if (source === "demo") {
    return { cards: demoRacecards(date), oddsTier: "demo", results: new Map() };
  }

  let cards: RacingRacecard[];
  let oddsTier: "free" | "standard" = "free";
  try {
    const loaded = await racecardsByDate(date);
    cards = loaded.cards;
    oddsTier = loaded.oddsTier;
  } catch {
    cards = [];
  }

  if (cards.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (date === today) cards = await racecardsFree("today");
    else if (date === tomorrow) cards = await racecardsFree("tomorrow");
    oddsTier = "free";
  }

  const { results } = await resultsToday();
  return {
    oddsTier,
    results,
    cards: cards.map((card) => {
      const result = results.get(card.externalId);
      if (!result) return card;
      return { ...card, status: "finished" as const };
    }),
  };
}

/** Both sides of the exchange book for one runner, when the feed returns them. */
interface ExchangeBookQuote {
  layDecimal: number;
  laySize?: number;
  backDecimal?: number;
  backSize?: number;
}

function enrichRunners(
  card: RacingRacecard,
  isDemo: boolean,
  idxSeed: number,
  preferredBookmaker?: string | null,
  forceProxy?: boolean,
  exchangeLayByHorse?: Map<string, ExchangeBookQuote>,
  overrides?: Map<string, { bookieDecimal: number | null; exchangeDecimal: number | null }>
): RacingRunnerDetail[] {
  const active = card.runnerDetails.filter((r) => !r.nonRunner);

  return active.map((r, idx) => {
    let movement = priceMovementFor(card.externalId, r.horseId, "bookie");
    if (movement.snapshotCount === 0 && isDemo && r.spDecimal) {
      movement = demoMovement(r.spDecimal, idx + r.name.length);
    }
    const exchangeMovement = priceMovementFor(card.externalId, r.horseId, "exchange");

    const layQuote = exchangeLayByHorse?.get(r.horseId);
    const override = overrides?.get(r.horseId);
    const bookieOverride =
      override?.bookieDecimal != null && override.bookieDecimal > 1
        ? override.bookieDecimal
        : null;
    const exchangeOverride =
      override?.exchangeDecimal != null && override.exchangeDecimal > 1
        ? override.exchangeDecimal
        : null;

    // Free tier: never invent bookie prices. Show real API / snapshot / manual only.
    // Proxy OFR ladder is unused for display - paste override is the free workflow.
    const resolved = resolveRunnerOdds({
      spDecimal: forceProxy ? undefined : r.spDecimal,
      spFraction: forceProxy ? undefined : r.spFraction,
      oddsList: forceProxy ? undefined : r.oddsList,
      snapshotDecimal: forceProxy ? undefined : movement.current,
      proxyDecimal: undefined,
      preferredBookmaker: preferredBookmaker ?? undefined,
      exchangeLayDecimal: layQuote?.layDecimal,
    });

    const bookieDecimal = bookieOverride ?? (forceProxy ? undefined : resolved.bookieDecimal);
    const exchangeDecimal =
      exchangeOverride ??
      layQuote?.layDecimal ??
      resolved.exchangeDecimal;
    const oddsOverridden = bookieOverride != null || exchangeOverride != null;
    const oddsSource: OddsSource = bookieOverride
      ? "manual"
      : forceProxy
        ? "unavailable"
        : resolved.source;
    const spreadPct =
      bookieDecimal != null &&
      exchangeDecimal != null &&
      bookieDecimal > 1 &&
      exchangeDecimal > 1
        ? ((exchangeDecimal - bookieDecimal) / bookieDecimal) * 100
        : undefined;

    const { oddsList: _drop, ...rest } = r;
    return {
      ...rest,
      movement: oddsSource === "manual" || oddsSource === "live" || oddsSource === "snapshot"
        ? movement
        : undefined,
      exchangeMovement,
      bookieDecimal,
      exchangeDecimal,
      exchangeLaySize: exchangeOverride ? undefined : layQuote?.laySize,
      exchangeBackDecimal: exchangeOverride ? undefined : layQuote?.backDecimal,
      exchangeBackSize: exchangeOverride ? undefined : layQuote?.backSize,
      exchangeSource: exchangeOverride
        ? ("api" as const)
        : layQuote?.layDecimal
          ? ("live" as const)
          : resolved.exchangeSource,
      spreadPct,
      oddsSource,
      oddsOverridden,
    };
  });
}

function raceOddsSource(runners: RacingRunnerDetail[]): OddsSource {
  const sources = runners.map((r) => r.oddsSource).filter(Boolean);
  if (sources.includes("manual")) return "manual";
  if (sources.includes("live")) return "live";
  if (sources.includes("snapshot")) return "snapshot";
  if (sources.includes("proxy")) return "proxy";
  return "unavailable";
}

/**
 * Whether a racing offer should appear on the desk for a race day.
 *
 * - With `eventDate` (place-refund meeting day, race-scoped): pinned to that day.
 * - Without (straight bet&get / multi-day promo): every desk day from Starts on
 *   through the Expires calendar day.
 * Recurring instances stay `planned` until their calendar day rolls to `active`.
 */
export function isRacingOfferActiveForDate(
  offer: Pick<OfferRow, "status" | "sport" | "eventDate"> &
    Partial<Pick<OfferRow, "startsOn" | "expiresAt">>,
  date: string
): boolean {
  if (offer.sport !== "horse_racing") return false;
  if (offer.status !== "active" && offer.status !== "planned") return false;

  const eventDate = offer.eventDate?.trim() || null;
  if (eventDate) {
    if (eventDate !== date) return false;
    return offer.status === "active" || offer.status === "planned";
  }

  const startsOn = offer.startsOn?.trim() || null;
  if (startsOn && date < startsOn) return false;
  if (offer.expiresAt != null) {
    const expiresYmd = localYmd(new Date(offer.expiresAt));
    if (date > expiresYmd) return false;
  }

  if (offer.status === "active") return true;
  // Planned + no pin: only once Starts on is set, so drafts without a schedule
  // do not flood every desk day.
  return startsOn != null && startsOn <= date;
}

/**
 * Desk Qualifying: horse-racing offers live for the viewed desk day.
 * Edge / place suggestions still require a result trigger (see evaluateOfferTags).
 * Same-day sibling spawn is only for result-conditional multi-race scopes.
 */
export function isRacingDeskOffer(
  offer: Pick<OfferRow, "status" | "sport" | "eventDate" | "offerType" | "rules"> &
    Partial<Pick<OfferRow, "startsOn" | "expiresAt">>,
  date: string
): boolean {
  return isRacingOfferActiveForDate(offer, date);
}

/**
 * Qualifying / Race picks universe for a desk day. Hosted Neon and local
 * SQLite both pass their offer list in. Never query SQLite here: a hosted
 * Neon desk opens a throwaway in-memory file.
 */
export function selectActiveRacingOffers(
  allOffers: OfferRow[],
  date: string,
  linkedOfferIds: ReadonlySet<number> = new Set()
): OfferRow[] {
  return allOffers.filter(
    (o) => isRacingDeskOffer(o, date) && !linkedOfferIds.has(o.id)
  );
}

async function loadRacingDeskStore(clerkUserId?: string | null): Promise<{
  allEvents: EventRow[];
  allBets: BetRow[];
  allOffers: OfferRow[];
  hosted: boolean;
}> {
  if (isNeonDesk()) {
    const [allEvents, allBets, allOffers] = await Promise.all([
      listNeonEvents().catch(() => []),
      listNeonDeskBets(clerkUserId),
      listNeonDeskOffers(clerkUserId),
    ]);
    return { allEvents, allBets, allOffers, hosted: true };
  }
  return {
    allEvents: db.select().from(events).all(),
    allBets: db.select().from(bets).all(),
    allOffers: db.select().from(offers).all(),
    hosted: false,
  };
}

function buildActiveOfferSummaries(activeOffers: OfferRow[]): RacingDeskActiveOffer[] {
  return activeOffers.map((offer) => {
    const rules = parseOfferRules(offer);
    const rulesSummary = rules ? formatBetGetFreePlaceSummary(rules) : offer.description ?? "";
    return {
      id: offer.id,
      title: offer.title,
      bookmaker: offer.bookmaker,
      scopeCourse: offer.scopeCourse,
      scopeRaceLabel: offer.scopeRaceLabel,
      eventDate: offer.eventDate,
      rulesSummary,
    };
  });
}

/**
 * Desk scoring uses persisted rules. Title/rules healing runs in
 * repairMismatchedTitlePlaceRules() before the desk builds; do not overlay a
 * stale OCR title onto a deliberate user edit of qualifyingPlaces.
 */
function rulesForDeskOffer(offer: OfferRow) {
  return parseOfferRules(offer);
}

function evaluateOfferTags(
  race: Omit<RacingDeskRace, "offerTags">,
  activeOffers: OfferRow[],
  date: string
): RaceOfferTag[] {
  return activeOffers.map((offer) => {
    const rules = rulesForDeskOffer(offer);
    const { qualifies, reasons } = raceQualifiesForOffer(offer, race, date);
    if (!qualifies) {
      return { offerId: offer.id, offerTitle: offer.title, qualifies: false, reasons };
    }
    const base = {
      offerId: offer.id,
      offerTitle: offer.title,
      qualifies: true as const,
      betStake: rules?.betStake,
      freeBetAmount: rules?.freeBetAmount,
      bookmaker: offer.bookmaker,
      triggerText: rules ? placeRefundTriggerText(rules) : undefined,
      qualifyingPlaces: rules?.qualifyingPlaces,
      ...(rules?.winnerMustBeSpFavourite
        ? { winnerMustBeSpFavourite: true as const }
        : {}),
      ...(rules?.minFavouriteSpOdds != null && rules.minFavouriteSpOdds > 1
        ? { minFavouriteSpOdds: rules.minFavouriteSpOdds }
        : {}),
      minRunners:
        offer.scopeCourse?.trim() && !isRegionalScope(offer.scopeCourse)
          ? (rules?.minRunners ?? null)
          : null,
    };
    // Unconditional bet&get: race can still "qualify" on scope/min runners, but
    // place-target heuristics and Best plays must not invent a pick.
    if (!offerHasResultTrigger(rules)) return base;

    const { score, summary } = scorePlaceRefundStrategy(race);
    return {
      ...base,
      score,
      summary,
      suggestedRunners: scorePlaceRefundRunners(race, {
        betStake: rules?.betStake ?? 0,
        freeBetAmount: rules?.freeBetAmount ?? 0,
        offerId: offer.id,
      }),
    };
  });
}

/**
 * Past / finished races clear live Edge tags, but still need free-bet place
 * decoration when the user logged a bet linked to a place-refund offer.
 * Hatch-only tags: qualifies + qualifyingPlaces, no runner scoring.
 */
export function freeBetPlaceTagsFromLinkedBets(
  race: Omit<RacingDeskRace, "offerTags">,
  linkedBets: Array<Pick<BetRow, "offerId">>,
  offersById: Map<number, OfferRow>,
  date: string
): RaceOfferTag[] {
  const seen = new Set<number>();
  const tags: RaceOfferTag[] = [];
  for (const bet of linkedBets) {
    if (bet.offerId == null || seen.has(bet.offerId)) continue;
    seen.add(bet.offerId);
    const offer = offersById.get(bet.offerId);
    if (!offer || offer.sport !== "horse_racing") continue;
    const rules = rulesForDeskOffer(offer);
    if (!rules?.qualifyingPlaces?.length) continue;
    const { qualifies, reasons } = raceQualifiesForOffer(offer, race, date);
    tags.push({
      offerId: offer.id,
      offerTitle: offer.title,
      qualifies,
      reasons,
      betStake: rules.betStake,
      freeBetAmount: rules.freeBetAmount,
      bookmaker: offer.bookmaker,
      triggerText: placeRefundTriggerText(rules),
      qualifyingPlaces: rules.qualifyingPlaces,
      ...(rules.winnerMustBeSpFavourite
        ? { winnerMustBeSpFavourite: true as const }
        : {}),
      ...(rules.minFavouriteSpOdds != null && rules.minFavouriteSpOdds > 1
        ? { minFavouriteSpOdds: rules.minFavouriteSpOdds }
        : {}),
      minRunners: rules.minRunners,
    });
  }
  return tags;
}

function applyRunnerOfferTargets(race: RacingDeskRace): RacingDeskRace {
  const topRunners = race.offerTags
    .filter((t) => t.qualifies && t.suggestedRunners?.length)
    .flatMap((t) => t.suggestedRunners ?? [])
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const targetByHorse = new Map(topRunners.map((r) => [r.horseId, r]));
  if (targetByHorse.size === 0) return race;

  return {
    ...race,
    runners: race.runners.map((r) => {
      const target = targetByHorse.get(r.horseId);
      if (!target) return r;
      return {
        ...r,
        offerTargetScore: target.score,
        offerTargetSummary: target.summary,
      };
    }),
  };
}

/**
 * Offer Edge plays for every active place-refund offer.
 *
 * The modelled path is the primary one. Races the model cannot price (too little
 * of the field quoted, which is the norm on the free Racing API tier) simply do
 * not produce a play, and the legacy rank-scored suggestion still covers them.
 */
function buildEdgePlays(
  races: RacingDeskRace[],
  activeOffers: OfferRow[],
  date: string,
  retention: number,
  retentionSampleSize: number
): OfferEdgePlay[] {
  const plays: OfferEdgePlay[] = [];

  const eligibleRaces = races.filter((r) => !isDeskRacePast(r));
  for (const offer of activeOffers) {
    const rules = parseOfferRules(offer);
    if (!rules || !offerHasResultTrigger(rules)) continue;
    plays.push(
      ...buildOfferEdgePlays(
        { id: offer.id, title: offer.title, bookmaker: offer.bookmaker, rules, row: offer },
        eligibleRaces,
        { date, retention, retentionSampleSize }
      )
    );
  }

  return plays.sort((a, b) => b.totalEv - a.totalEv || a.startTime - b.startTime);
}

function buildSuggestedRaces(
  races: RacingDeskRace[],
  edgePlays: OfferEdgePlay[]
): SuggestedRace[] {
  const edgeByRaceOffer = new Map(
    edgePlays.map((play) => [`${play.raceExternalId}:${play.offerId}`, play])
  );

  const suggestions: SuggestedRace[] = [];
  for (const race of races) {
    for (const tag of race.offerTags) {
      if (!tag.qualifies) continue;
      const edge = edgeByRaceOffer.get(`${race.externalId}:${tag.offerId}`);
      // Heuristic score can be 0 on a weak market shape while still naming
      // runners. Drop only when there is nothing to rank.
      if (!edge && !(tag.suggestedRunners?.length) && (tag.score == null || tag.score <= 0)) {
        continue;
      }

      const topTarget = tag.suggestedRunners?.[0];
      suggestions.push({
        externalId: race.externalId,
        course: race.course,
        raceName: race.raceName,
        startTime: race.startTime,
        offTime: race.offTime,
        region: race.region,
        offerId: tag.offerId,
        offerTitle: tag.offerTitle,
        bookmaker: tag.bookmaker ?? edge?.bookmaker ?? null,
        score: tag.score ?? 0,
        summary: edge?.reasons.join(" · ") || tag.summary || "",
        oddsSource: edge?.oddsSource ?? topTarget?.oddsSource ?? race.oddsSource,
        exchangeSource:
          edge?.exchangeSource ?? topTarget?.exchangeSource ?? race.exchangeSource,
        suggestedRunners: tag.suggestedRunners,
        topTarget,
        confidence:
          edge?.confidence ??
          topTarget?.confidence ??
          resolveOfferConfidence(race.oddsSource, race.exchangeSource),
        topEv: edge?.totalEv ?? topTarget?.totalEv,
        edge,
      });
    }
  }

  // Modelled plays first, then by expected value, so the honest numbers lead.
  return suggestions
    .sort((a, b) => {
      if (!!a.edge !== !!b.edge) return a.edge ? -1 : 1;
      const evA = a.topEv ?? Number.NEGATIVE_INFINITY;
      const evB = b.topEv ?? Number.NEGATIVE_INFINITY;
      if (evA !== evB) return evB - evA;
      return b.score - a.score;
    })
    .slice(0, 8);
}

export async function getRacingDesk(
  date: string,
  options?: {
    exchangeProvider?: ExchangeProvider | null;
    /** Captured before `cookies()` / racecard awaits, which can drop ALS. */
    clerkUserId?: string | null;
  }
): Promise<RacingDeskPayload> {
  const clerkUserId =
    options?.clerkUserId?.trim() || getDeskActor().clerkUserId?.trim() || null;
  // SQLite-only: series spawn and title repair write the Mac file. Hosted
  // Neon already stores instances; those helpers would mutate empty memory.
  const hosted = isNeonDesk();
  if (!hosted) {
    syncOfferSeriesInstances();
    repairMismatchedTitlePlaceRules();
  }
  // Start Neon reads immediately so the Clerk id is bound before racecards await.
  const storePromise = loadRacingDeskStore(clerkUserId);

  const source = hasRacingApiKey() ? "api" : "demo";
  let error: string | undefined;

  let cards: RacingRacecard[];
  let apiOddsTier: "free" | "standard" | "demo" | "proxy" = "demo";
  let resultsByRace = new Map<string, RaceResult>();
  try {
    const loaded = await loadRacecards(date, source);
    cards = loaded.cards;
    apiOddsTier = loaded.oddsTier;
    resultsByRace = loaded.results;
  } catch (e) {
    error = String(e);
    cards = demoRacecards(date);
    apiOddsTier = "demo";
  }

  cards.sort((a, b) => a.startTime - b.startTime);

  if (!hosted) syncCourseOfferExpiryFromRaces(cards, date);

  const { allEvents, allBets, allOffers } = await storePromise;
  const eventByExternal = new Map(
    allEvents.filter((e) => e.externalId).map((e) => [e.externalId!, e])
  );
  const betsById = new Map(allBets.map((b) => [b.id, b]));
  const betsByEvent = new Map<number, BetRow[]>();
  for (const bet of allBets) {
    if (bet.eventId == null) continue;
    const list = betsByEvent.get(bet.eventId) ?? [];
    list.push(bet);
    betsByEvent.set(bet.eventId, list);
  }
  const accaBundles = listAccaRuns();
  const betBuilderBundles = listBetBuilderRuns();
  const systemBundles = listSystemRuns();
  const deskMarkInput = {
    acca: accaBundles.map(({ run, legs, backBetType }) => {
      const back = run.backBetId != null ? betsById.get(run.backBetId) : undefined;
      return {
        id: run.id,
        label: run.label,
        status: run.status,
        method: run.method,
        offerId: run.offerId,
        noLay: run.noLay,
        stake: run.stake,
        commission: run.commission,
        boostPct: run.boostPct,
        wholeLayStake: run.wholeLayStake,
        wholeLayOdds: run.wholeLayOdds,
        backBetId: run.backBetId,
        backBetType,
        bookmaker: run.bookmaker,
        backStake: back?.backStake ?? run.stake,
        backOdds: back?.backOdds ?? 0,
        legs: legs.map((leg) => ({
          seq: leg.seq,
          label: leg.label,
          selection: leg.selection,
          result: leg.result,
          layStake: leg.layStake,
          layOdds: leg.layOdds,
          backOdds: leg.backOdds,
          eventId: leg.eventId,
        })),
      };
    }),
    betBuilder: betBuilderBundles.map(({ run, selections }) => {
      const back = run.backBetId != null ? betsById.get(run.backBetId) : undefined;
      return {
        id: run.id,
        label: run.label,
        status: run.status,
        method: run.method,
        offerId: run.offerId,
        wholeLayStake: run.wholeLayStake,
        backBetId: run.backBetId,
        bookmaker: run.bookmaker,
        backStake: back?.backStake ?? run.stake,
        backOdds: back?.backOdds ?? run.backOdds,
        eventId: run.eventId,
        selectionCount: selections.length,
        selections: selections.map((sel) => ({
          label: sel.label,
          selection: sel.selection,
        })),
      };
    }),
    systems: systemBundles.map(({ run, legs }) => {
      const back = run.backBetId != null ? betsById.get(run.backBetId) : undefined;
      return {
        id: run.id,
        label: run.label,
        status: run.status,
        offerId: run.offerId,
        backBetId: run.backBetId,
        bookmaker: run.bookmaker,
        backStake: back?.backStake ?? run.totalStake,
        backOdds: back?.backOdds ?? 0,
        legs: legs.map((leg) => ({
          seq: leg.seq,
          label: leg.label,
          selection: leg.selection,
          result: leg.result,
          eventId: leg.eventId,
        })),
      };
    }),
  };

  const isDemo = source === "demo" && !hasRacingApiKey();
  const useProxyOdds = !isDemo && apiOddsTier === "free";

  // Desk Qualifying / Edge only show unused campaigns. Same-day sibling spawn
  // creates a fresh row when a bet is linked, so the title stays on the desk
  // without the used card (open or settled) reappearing alongside it.
  const offerIdsWithLinkedBets = new Set(
    allBets
      .filter((b) => b.offerId != null)
      .map((b) => b.offerId as number)
  );
  const activeOffers = selectActiveRacingOffers(
    allOffers,
    date,
    offerIdsWithLinkedBets
  );
  const primaryBookmaker = activeOffers[0]?.bookmaker ?? null;

  const settingsProvider = getDefaultExchangeProvider();
  const settingsName = getDefaultExchangeName();
  const deskOverride = options?.exchangeProvider ?? null;
  const liveFeed = resolveLiveExchangeProvider(deskOverride);
  const exchangeColors = getExchangeColors(liveFeed.provider);
  const settingsStatus = getExchangeProviderStatus(settingsProvider);

  const upcomingCards = cards.filter((c) => c.status !== "finished");
  const exchangeLayByRace = new Map<string, Map<string, ExchangeBookQuote>>();
  const exchangeMetaByRace = new Map<
    string,
    { source: "live" | "estimated" | "api"; error?: string; quoteCount: number }
  >();

  if (liveFeed.status.status === "connected" && upcomingCards.length > 0) {
    const exchangeResult = await getExchangeOdds(
      liveFeed.provider,
      upcomingCards.map((card) => ({
        externalId: card.externalId,
        course: card.course,
        raceName: card.raceName,
        startTime: card.startTime,
        offTime: card.offTime,
        region: card.region,
        runners: card.runnerDetails
          .filter((r) => !r.nonRunner)
          .map((r) => ({ horseId: r.horseId, name: r.name })),
      })),
      date
    );

    for (const raceOdds of exchangeResult.races) {
      const byHorse = new Map<string, ExchangeBookQuote>();
      for (const q of raceOdds.quotes) {
        byHorse.set(q.horseId, {
          layDecimal: q.layDecimal,
          laySize: q.laySize,
          backDecimal: q.backDecimal,
          backSize: q.backSize,
        });
      }
      if (byHorse.size > 0) exchangeLayByRace.set(raceOdds.externalId, byHorse);
      exchangeMetaByRace.set(raceOdds.externalId, {
        source: raceOdds.source,
        error: raceOdds.error,
        quoteCount: raceOdds.quotes.length,
      });
    }
  }

  const overridesByRace = listOverridesForRaces(cards.map((c) => c.externalId));
  const offersById = new Map(allOffers.map((o) => [o.id, o] as const));

  const now = Date.now();
  let races: RacingDeskRace[] = cards.map((card) => {
    const tracked = eventByExternal.get(card.externalId);
    const linkedBets = tracked ? (betsByEvent.get(tracked.id) ?? []) : [];
    const deskMarks = tracked ? deskRunnerMarksForEvent(tracked.id, deskMarkInput) : [];
    const markSources = [
      ...linkedBets.filter((b) => !isRacingDeskHiddenBet(b)),
      ...deskMarks,
    ];
    const openBetCount = markSources.filter((b) => b.status === "open").length;
    const standardPlaces = placePositions(card.fieldSize, {
      type: card.type,
      raceName: card.raceName,
    });

    let runners = enrichRunners(
      card,
      isDemo,
      card.externalId.length,
      primaryBookmaker,
      useProxyOdds,
      exchangeLayByRace.get(card.externalId),
      overridesByRace.get(card.externalId)
    );

    const apiResult = resultsByRace.get(card.externalId);
    const trackedResult =
      !apiResult && tracked ? parseRaceResults(tracked.goals) : null;
    const result = apiResult ?? trackedResult;
    if (result) {
      runners = applyRaceResultToDeskRunners(runners, result);
    }
    if (markSources.length > 0) {
      runners = applyRunnerBetMarks(runners, markSources);
    }

    const pricedRunnerCount = runners.filter((r) => (r.bookieDecimal ?? 0) > 1).length;
    const oddsSource = raceOddsSource(runners);
    const liveLayCount = runners.filter((r) => r.exchangeSource === "live").length;
    const meta = exchangeMetaByRace.get(card.externalId);
    const status = result ? ("finished" as const) : card.status;

    const baseRace = {
      externalId: card.externalId,
      course: card.course,
      raceName: card.raceName,
      startTime: card.startTime,
      offTime: card.offTime,
      status,
      raceStatus: card.raceStatus,
      abandoned: card.abandoned,
      fieldSize: card.fieldSize,
      distance: card.distance,
      going: card.going,
      raceClass: card.raceClass,
      pattern: card.pattern,
      ratingBand: card.ratingBand,
      ageBand: card.ageBand,
      surface: card.surface,
      sexRestriction: card.sexRestriction,
      type: card.type,
      prize: card.prize,
      region: card.region,
      winner: result?.winner,
      resultIncomplete: result ? isRaceResultIncomplete(result) : undefined,
      runners,
      trackedEventId: tracked?.id,
      openBetCount,
      standardPlaces,
      oddsSource,
      pricedRunnerCount,
      exchangeSource: liveLayCount > 0 ? ("live" as const) : meta?.source,
      exchangeMatchError: liveLayCount > 0 ? undefined : meta?.error,
      liveLayCount,
    };

    const past = isDeskRacePast(baseRace, now);
    return {
      ...baseRace,
      // Past: no live Edge workflow, but keep hatch tags from offer-linked bets.
      offerTags: past
        ? freeBetPlaceTagsFromLinkedBets(baseRace, linkedBets, offersById, date)
        : evaluateOfferTags(baseRace, activeOffers, date),
    };
  });

  races = races.map(applyRunnerOfferTargets);

  // Snapshot real bookie prices only (manual / live / API) - never Free-tier OFR proxies.
  const bookieSnapshots = races.flatMap((race) =>
    race.runners
      .filter(
        (r) =>
          !r.nonRunner &&
          (r.bookieDecimal ?? 0) > 1 &&
          r.oddsSource !== "proxy" &&
          r.oddsSource !== "unavailable"
      )
      .map((r) => ({
        raceId: race.externalId,
        horseId: r.horseId,
        horse: r.name,
        spDecimal: r.bookieDecimal,
        kind: "bookie" as const,
      }))
  );
  const exchangeSnapshots = races.flatMap((race) =>
    race.runners
      .filter(
        (r) =>
          !r.nonRunner &&
          r.exchangeSource === "live" &&
          (r.exchangeDecimal ?? 0) > 1
      )
      .map((r) => ({
        raceId: race.externalId,
        horseId: r.horseId,
        horse: r.name,
        spDecimal: r.exchangeDecimal,
        kind: "exchange" as const,
      }))
  );
  const snapshotInputs = [...bookieSnapshots, ...exchangeSnapshots];
  if (snapshotInputs.length > 0) {
    recordOddsSnapshots(snapshotInputs);
    races = races.map((race) => ({
      ...race,
      runners: race.runners.map((r) => ({
        ...r,
        movement: priceMovementFor(race.externalId, r.horseId, "bookie"),
        exchangeMovement: priceMovementFor(race.externalId, r.horseId, "exchange"),
      })),
    }));
  }

  const activeOfferSummaries = buildActiveOfferSummaries(activeOffers);
  // Same prior the rest of the app measures against, so an EV shown on the Racing
  // Desk cannot disagree with the same offer's EV on the dashboard.
  const { tuning } = hosted
    ? clerkUserId
      ? await getNeonDeskSettingsForUser(clerkUserId)
      : await getNeonDeskSettings()
    : getAppSettings();
  const realizedRetention = getRealizedRetention(undefined, {
    rate: tuning.retentionPrior,
    weight: tuning.retentionPriorWeight,
  });
  const edgePlays = buildEdgePlays(
    races,
    activeOffers,
    date,
    realizedRetention.rate,
    realizedRetention.sampleSize
  );
  const suggestedRaces = buildSuggestedRaces(races, edgePlays);

  const trackedCount = races.filter((r) => r.trackedEventId).length;
  const effectiveOddsTier: RacingDeskSummary["oddsTier"] =
    isDemo ? "demo" : useProxyOdds ? "proxy" : apiOddsTier;

  const hasLiveExchange = races.some((r) =>
    r.runners.some((runner) => runner.exchangeSource === "live")
  );

  let exchangeNote: string | undefined;
  if (liveFeed.status.status === "not_configured") {
    exchangeNote = deskOverride
      ? `${liveFeed.name} is selected, but live prices are not available. Showing estimates, or pick another exchange.`
      : `Live exchange prices are not connected. Showing estimates.`;
  } else if (liveFeed.status.status === "unsupported") {
    exchangeNote = liveFeed.status.message;
  } else if (!hasLiveExchange) {
    exchangeNote = `${liveFeed.name} connected but no markets matched this card - using +3% estimates. Check race times / course names.`;
  } else if (
    !deskOverride &&
    liveFeed.provider !== settingsProvider &&
    settingsStatus.status !== "connected"
  ) {
    exchangeNote = `Using ${liveFeed.name} for live lays.`;
  }

  const summary: RacingDeskSummary = {
    raceCount: races.length,
    upcomingCount: races.filter((r) => r.status === "upcoming").length,
    trackedCount,
    openPositions: 0,
    racingPnlToday: racingPnlToday(allBets, allEvents, date),
    source: error ? "error" : source === "demo" ? "demo" : "racing-api",
    oddsSnapshotsEnabled: true,
    premiumOddsApi: hasRacingApiKey(),
    oddsTier: effectiveOddsTier,
    resultsTier: hasRacingApiKey() ? getCachedRacingResultsTier() : "none",
    oddsNote:
      effectiveOddsTier === "free" || effectiveOddsTier === "proxy"
        ? "Racing feed: racecards only - no live bookie odds. Bookie column stays blank until you paste odds (click a cell). Exchange lays are live when connected."
        : effectiveOddsTier === "standard"
          ? "Live bookmaker odds from the racing feed."
          : undefined,
    exchangeProvider: liveFeed.provider,
    exchangeName: liveFeed.name,
    settingsExchangeProvider: settingsProvider,
    settingsExchangeName: settingsName,
    deskExchangeOverride: deskOverride,
    exchangeStatus: hasLiveExchange
      ? "connected"
      : liveFeed.status.status === "connected"
        ? "disconnected"
        : liveFeed.status.status,
    exchangeFeedType: liveFeed.status.feedType,
    exchangeNote,
    backColor: exchangeColors.backColor,
    layColor: exchangeColors.layColor,
  };

  const raceByExternal = new Map(races.map((r) => [r.externalId, r]));
  const eventsById = new Map(allEvents.map((e) => [e.id, e]));
  const trackerBets = allBets
    .filter((b) => b.status === "open" && b.eventId != null && !isRacingDeskHiddenBet(b))
    .flatMap((b): RacingDeskActiveBet[] => {
      const ev = allEvents.find((e) => e.id === b.eventId);
      if (!ev || ev.sport !== "horse_racing") return [];
      const race = ev.externalId ? raceByExternal.get(ev.externalId) : undefined;
      const meta = parseEwMeta(b.notes);
      let qualifyingLoss: number | null = null;
      let impliedExtraPlaceOdds: number | null = null;
      let profitIfExtraPlace: number | null = null;
      if (
        meta?.mode === "extra_place" &&
        meta.bookiePlaces > meta.exchangePlaces &&
        b.backOdds > 1
      ) {
        const ep = extraPlace({
          stakePerPart: meta.stakePerPart,
          winOdds: b.backOdds,
          placeFraction: meta.placeFraction,
          layWinOdds: meta.layWin.odds,
          layPlaceOdds: meta.layPlace.odds,
          commission: b.commission,
          bookiePlaces: meta.bookiePlaces,
          exchangePlaces: meta.exchangePlaces,
        });
        qualifyingLoss = ep.qualifyingLoss;
        impliedExtraPlaceOdds = ep.impliedExtraPlaceOdds;
        profitIfExtraPlace = ep.profitIfExtraPlace;
      }
      const outcomeKind =
        meta?.mode === "each_way" || meta?.mode === "extra_place"
          ? ("worst" as const)
          : openBetOutcomeKind(b);

      return [
        {
          betId: b.id,
          eventId: b.eventId!,
          raceExternalId: ev.externalId,
          label: b.label,
          selection: b.selection,
          market: b.market,
          bookmaker: b.bookmaker,
          backStake: b.backStake,
          backOdds: b.backOdds,
          expectedProfit: b.expectedProfit,
          outcomeKind,
          course: race?.course ?? ev.competition ?? null,
          offTime: race?.offTime ?? null,
          startTime: race?.startTime ?? ev.startTime ?? null,
          bookiePlaces: meta?.bookiePlaces,
          exchangePlaces: meta?.exchangePlaces,
          mode: meta?.mode,
          qualifyingLoss,
          impliedExtraPlaceOdds,
          profitIfExtraPlace,
        },
      ];
    });

  const campaignBets = buildRacingDeskCampaignBets({
    eventsById,
    ...deskMarkInput,
  }).map((row) => {
    const ev = eventsById.get(row.eventId);
    const race = ev?.externalId ? raceByExternal.get(ev.externalId) : undefined;
    return {
      ...row,
      course: race?.course ?? row.course,
      offTime: race?.offTime ?? row.offTime,
      startTime: race?.startTime ?? row.startTime,
      raceExternalId: race?.externalId ?? row.raceExternalId,
    };
  });

  const activeBets = [...trackerBets, ...campaignBets].sort(
    (a, b) => (a.startTime ?? 0) - (b.startTime ?? 0)
  );
  summary.openPositions = activeBets.length;

  const racingPnlDay = racingPnlByRace(allBets, allEvents, date);
  for (const row of racingPnlDay.rows) {
    const race = row.raceExternalId
      ? raceByExternal.get(row.raceExternalId)
      : races.find((r) => r.trackedEventId === row.eventId);
    if (!race) continue;
    if (race.course) row.course = race.course;
    if (race.raceName) row.raceName = race.raceName;
    if (race.offTime) row.offTime = race.offTime;
    if (race.region) row.region = race.region;
    if (!row.raceExternalId) row.raceExternalId = race.externalId;
  }

  return {
    date,
    summary,
    races,
    activeOffers: activeOfferSummaries,
    activeBets,
    racingPnlDay,
    suggestedRaces,
    edgePlays,
    error,
  };
}

export function findTrackedEventForRace(
  externalId: string,
  allEvents: EventRow[]
): EventRow | undefined {
  return allEvents.find((e) => e.externalId === externalId);
}

/**
 * Runner names in Racing Desk grid order (favourite-first by exchange / bookie / SP).
 * Uses the same enrichment as the desk so Add bet Selection matches what the user sees.
 */
export async function getDeskOrderedRunnerNames(input: {
  date: string;
  externalId?: string | null;
  trackedEventId?: number | null;
}): Promise<string[] | null> {
  if (!input.externalId && input.trackedEventId == null) return null;
  const desk = await getRacingDesk(input.date);
  const race = desk.races.find(
    (r) =>
      (input.externalId != null &&
        input.externalId !== "" &&
        r.externalId === input.externalId) ||
      (input.trackedEventId != null && r.trackedEventId === input.trackedEventId)
  );
  if (!race?.runners.length) return null;
  return sortRunnerNamesByOdds(race.runners);
}
