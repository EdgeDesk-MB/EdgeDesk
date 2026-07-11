/**
 * Assemble Racing Desk payload - racecards, movements, linked bets.
 */
import { db, bets, events, offers, type BetRow, type EventRow, type OfferRow } from "@/lib/db";
import {
  resolveRunnerOdds,
  type OddsSource,
} from "@/lib/racing/odds";
import type { RacingRunnerDetail } from "@/lib/racing-desk/types";
import { placePositions } from "@/lib/racing";
import type {
  RacingDeskActiveOffer,
  RacingDeskPayload,
  RacingDeskRace,
  RacingDeskSummary,
  RaceOfferTag,
  SuggestedRace,
} from "@/lib/racing-desk/types";
import {
  formatBetGetFreePlaceSummary,
  parseOfferRules,
  placeRefundTriggerText,
  raceQualifiesForOffer,
  scorePlaceRefundRunners,
  scorePlaceRefundStrategy,
} from "@/lib/offers/racing-offer-rules";
import { resolveOfferConfidence } from "@/lib/offers/place-refund-ev";
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

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function racingPnlToday(allBets: BetRow[]): number {
  const start = startOfTodayMs();
  return allBets
    .filter(
      (b) =>
        b.settledAt != null &&
        b.settledAt >= start &&
        b.actualProfit != null &&
        b.status !== "open" &&
        b.status !== "void"
    )
    .reduce((a, b) => a + (b.actualProfit ?? 0), 0);
}

async function loadRacecards(
  date: string,
  source: "demo" | "api"
): Promise<{ cards: RacingRacecard[]; oddsTier: "free" | "standard" | "demo" | "proxy" }> {
  if (source === "demo") {
    return { cards: demoRacecards(), oddsTier: "demo" };
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
    cards: cards.map((card) => {
      const result = results.get(card.externalId);
      if (!result) return card;
      return { ...card, status: "finished" as const };
    }),
  };
}

function enrichRunners(
  card: RacingRacecard,
  isDemo: boolean,
  idxSeed: number,
  preferredBookmaker?: string | null,
  forceProxy?: boolean,
  exchangeLayByHorse?: Map<string, { layDecimal: number; laySize?: number }>,
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

function loadActiveRacingOffers(date: string): OfferRow[] {
  return db
    .select()
    .from(offers)
    .all()
    .filter(
      (o) =>
        o.status === "active" &&
        o.sport === "horse_racing" &&
        (o.eventDate == null || o.eventDate === date)
    );
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

function evaluateOfferTags(
  race: Omit<RacingDeskRace, "offerTags">,
  activeOffers: OfferRow[],
  date: string
): RaceOfferTag[] {
  return activeOffers.map((offer) => {
    const rules = parseOfferRules(offer);
    const { qualifies, reasons } = raceQualifiesForOffer(offer, race, date);
    if (!qualifies) {
      return { offerId: offer.id, offerTitle: offer.title, qualifies: false, reasons };
    }
    const { score, summary } = scorePlaceRefundStrategy(race);
    const suggestedRunners = scorePlaceRefundRunners(race, {
      betStake: rules?.betStake ?? 0,
      freeBetAmount: rules?.freeBetAmount ?? 0,
      offerId: offer.id,
    });
    return {
      offerId: offer.id,
      offerTitle: offer.title,
      qualifies: true,
      score,
      summary,
      betStake: rules?.betStake,
      freeBetAmount: rules?.freeBetAmount,
      bookmaker: offer.bookmaker,
      triggerText: rules ? placeRefundTriggerText(rules) : undefined,
      suggestedRunners,
    };
  });
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

function buildSuggestedRaces(races: RacingDeskRace[]): SuggestedRace[] {
  const suggestions: SuggestedRace[] = [];
  for (const race of races) {
    for (const tag of race.offerTags) {
      if (!tag.qualifies || tag.score == null || tag.score <= 0) continue;
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
        score: tag.score,
        summary: tag.summary ?? "",
        oddsSource: race.oddsSource,
        suggestedRunners: tag.suggestedRunners,
        topTarget,
        confidence: topTarget?.confidence ?? resolveOfferConfidence(race.oddsSource),
        topEv: topTarget?.totalEv,
      });
    }
  }
  return suggestions.sort((a, b) => b.score - a.score).slice(0, 8);
}

export async function getRacingDesk(
  date: string,
  options?: { exchangeProvider?: ExchangeProvider | null }
): Promise<RacingDeskPayload> {
  const source = hasRacingApiKey() ? "api" : "demo";
  let error: string | undefined;

  let cards: RacingRacecard[];
  let apiOddsTier: "free" | "standard" | "demo" | "proxy" = "demo";
  try {
    const loaded = await loadRacecards(date, source);
    cards = loaded.cards;
    apiOddsTier = loaded.oddsTier;
  } catch (e) {
    error = String(e);
    cards = demoRacecards();
    apiOddsTier = "demo";
  }

  cards.sort((a, b) => a.startTime - b.startTime);

  const allEvents = db.select().from(events).all();
  const eventByExternal = new Map(
    allEvents.filter((e) => e.externalId).map((e) => [e.externalId!, e])
  );
  const allBets = db.select().from(bets).all();
  const betsByEvent = new Map<number, BetRow[]>();
  for (const bet of allBets) {
    if (bet.eventId == null) continue;
    const list = betsByEvent.get(bet.eventId) ?? [];
    list.push(bet);
    betsByEvent.set(bet.eventId, list);
  }

  const isDemo = source === "demo" && !hasRacingApiKey();
  const useProxyOdds = !isDemo && apiOddsTier === "free";
  const activeOffers = loadActiveRacingOffers(date);
  const primaryBookmaker = activeOffers[0]?.bookmaker ?? null;

  const settingsProvider = getDefaultExchangeProvider();
  const settingsName = getDefaultExchangeName();
  const deskOverride = options?.exchangeProvider ?? null;
  const liveFeed = resolveLiveExchangeProvider(deskOverride);
  const exchangeColors = getExchangeColors(liveFeed.provider);
  const settingsStatus = getExchangeProviderStatus(settingsProvider);

  const upcomingCards = cards.filter((c) => c.status !== "finished");
  const exchangeLayByRace = new Map<
    string,
    Map<string, { layDecimal: number; laySize?: number }>
  >();
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
      const byHorse = new Map<string, { layDecimal: number; laySize?: number }>();
      for (const q of raceOdds.quotes) {
        byHorse.set(q.horseId, { layDecimal: q.layDecimal, laySize: q.laySize });
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

  let races: RacingDeskRace[] = cards.map((card) => {
    const tracked = eventByExternal.get(card.externalId);
    const linkedBets = tracked ? (betsByEvent.get(tracked.id) ?? []) : [];
    const openBetCount = linkedBets.filter((b) => b.status === "open").length;
    const standardPlaces = placePositions(card.fieldSize);

    const runners = enrichRunners(
      card,
      isDemo,
      card.externalId.length,
      primaryBookmaker,
      useProxyOdds,
      exchangeLayByRace.get(card.externalId),
      overridesByRace.get(card.externalId)
    );
    const pricedRunnerCount = runners.filter((r) => (r.bookieDecimal ?? 0) > 1).length;
    const oddsSource = raceOddsSource(runners);
    const liveLayCount = runners.filter((r) => r.exchangeSource === "live").length;
    const meta = exchangeMetaByRace.get(card.externalId);

    const baseRace = {
      externalId: card.externalId,
      course: card.course,
      raceName: card.raceName,
      startTime: card.startTime,
      offTime: card.offTime,
      status: card.status,
      fieldSize: card.fieldSize,
      distance: card.distance,
      going: card.going,
      raceClass: card.raceClass,
      type: card.type,
      prize: card.prize,
      region: card.region,
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

    return {
      ...baseRace,
      offerTags: evaluateOfferTags(baseRace, activeOffers, date),
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
  const suggestedRaces = buildSuggestedRaces(races);

  const trackedCount = races.filter((r) => r.trackedEventId).length;
  const effectiveOddsTier: RacingDeskSummary["oddsTier"] =
    isDemo ? "demo" : useProxyOdds ? "proxy" : apiOddsTier;

  const hasLiveExchange = races.some((r) =>
    r.runners.some((runner) => runner.exchangeSource === "live")
  );

  let exchangeNote: string | undefined;
  if (liveFeed.status.status === "not_configured") {
    exchangeNote = deskOverride
      ? `${liveFeed.name} is selected on Racing Desk but not connected. Configure keys in Settings → Data & API, or pick another exchange.`
      : `Connect Betfair delayed key in Settings → Data & API for live lay odds (free). App default exchange is ${settingsName}.`;
  } else if (liveFeed.status.status === "unsupported") {
    exchangeNote = liveFeed.status.message;
  } else if (!hasLiveExchange) {
    exchangeNote = `${liveFeed.name} connected but no markets matched this card - using +3% estimates. Check race times / course names.`;
  } else if (
    !deskOverride &&
    liveFeed.provider !== settingsProvider &&
    settingsStatus.status !== "connected"
  ) {
    exchangeNote = `Using ${liveFeed.name} for live lays (Settings default ${settingsName} has no API). Override on Racing Desk or set default to Betfair in Settings.`;
  }

  const summary: RacingDeskSummary = {
    raceCount: races.length,
    upcomingCount: races.filter((r) => r.status === "upcoming").length,
    liveCount: races.filter((r) => r.status === "live").length,
    trackedCount,
    openPositions: allBets.filter((b) => {
      if (b.status !== "open" || b.eventId == null) return false;
      const ev = allEvents.find((e) => e.id === b.eventId);
      return ev?.sport === "horse_racing";
    }).length,
    racingPnlToday: racingPnlToday(allBets),
    source: error ? "error" : source === "demo" ? "demo" : "racing-api",
    oddsSnapshotsEnabled: true,
    premiumOddsApi: hasRacingApiKey(),
    oddsTier: effectiveOddsTier,
    resultsTier: hasRacingApiKey() ? getCachedRacingResultsTier() : "none",
    oddsNote:
      effectiveOddsTier === "free" || effectiveOddsTier === "proxy"
        ? "Free Racing API - no live bookie feed. Bookie column stays blank until you paste odds (click a cell). Betfair lays are live when connected."
        : effectiveOddsTier === "standard"
          ? "Live bookmaker odds from Racing API Standard."
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

  return { date, summary, races, activeOffers: activeOfferSummaries, suggestedRaces, error };
}

export function findTrackedEventForRace(
  externalId: string,
  allEvents: EventRow[]
): EventRow | undefined {
  return allEvents.find((e) => e.externalId === externalId);
}
