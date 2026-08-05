import { describe, expect, it } from "vitest";
import { buildOfferEdgePlays, formatEdgePlaySummary, type OfferEdgeOffer } from "./offer-edge";
import type { BetGetFreePlaceRules } from "./racing-offer-rules";
import {
  finishPositionProbs,
  sumPositions,
  winProbsFromRunners,
} from "@/lib/calc/racing/finish-positions";
import type { RacingDeskRace, RacingRunnerDetail } from "@/lib/racing-desk/types";
import { formatClockTime } from "@/lib/time-format";

const rules: BetGetFreePlaceRules = {
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [2, 3, 4],
  betStake: 50,
  freeBetAmount: 50,
};

const offer: OfferEdgeOffer = {
  id: 1,
  title: "Bet £50 get £50 free bet if 2nd, 3rd or 4th",
  bookmaker: "Bet365",
  rules,
};

/** A runner priced on both sides of the exchange, with a matching bookie price. */
function runner(
  name: string,
  price: number,
  extra?: Partial<RacingRunnerDetail>
): RacingRunnerDetail {
  return {
    horseId: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    number: "1",
    jockey: "J Jockey",
    trainer: "T Trainer",
    nonRunner: false,
    bookieDecimal: price,
    exchangeDecimal: Math.round(price * 1.02 * 100) / 100,
    exchangeBackDecimal: price,
    exchangeSource: "live",
    oddsSource: "live",
    exchangeLaySize: 5000,
    ...extra,
  };
}

function race(prices: number[], extra?: Partial<RacingDeskRace>): RacingDeskRace {
  const runners = prices.map((p, i) => runner(`Horse ${i + 1}`, p));
  return {
    externalId: `race-${prices.length}-${prices[0]}`,
    course: "Chepstow",
    raceName: "Handicap Chase",
    startTime: Date.parse("2026-07-31T14:20:00Z"),
    offTime: "15:20",
    status: "upcoming",
    fieldSize: runners.length,
    region: "GB",
    runners,
    openBetCount: 0,
    standardPlaces: 3,
    offerTags: [],
    exchangeSource: "live",
    oddsSource: "live",
    ...extra,
  };
}

const opts = { date: "2026-07-31", retention: 0.8 };

/**
 * A book that normalises close to fair on both sides, so `bookIsSharp` passes on
 * overround and coverage. Tests that mean to exercise one reliability term have to
 * start here, otherwise another term fails first and the assertion proves nothing.
 */
const TIGHT_BOOK = [3.5, 5.5, 7, 9, 11, 14, 18, 22];

/** The same, ten-handed, so one unpriced runner still clears the 0.9 coverage floor. */
const TIGHT_BOOK_10 = [...TIGHT_BOOK, 28, 35];

describe("buildOfferEdgePlays", () => {
  it("returns the best runner per race, ranked by EV", () => {
    const plays = buildOfferEdgePlays(
      offer,
      [
        race([1.6, 5, 7, 9, 14, 20, 25, 33]),
        race([3.2, 4.5, 6, 7.5, 9, 11, 16, 22], { externalId: "second", offTime: "16:00" }),
      ],
      opts
    );

    expect(plays).toHaveLength(2);
    expect(plays[0].totalEv).toBeGreaterThanOrEqual(plays[1].totalEv);
    for (const play of plays) {
      expect(play.triggerBasis).toBe("model");
      expect(play.triggerProb).toBeGreaterThan(0);
      expect(play.triggerProb).toBeLessThan(1);
      expect(play.runner.name).toMatch(/^Horse /);
    }
  });

  it("lets the favourite win the ranking when the book justifies it", () => {
    // Weak favourite in a competitive handicap: frames often, wins rarely.
    const plays = buildOfferEdgePlays(offer, [race([6, 8, 9, 10, 11, 12, 14, 16])], opts);

    expect(plays).toHaveLength(1);
    expect(plays[0].runner.marketRank).toBe(1);
  });

  it("does not pick the favourite when it is dominant enough to win too often", () => {
    const plays = buildOfferEdgePlays(offer, [race([1.3, 6, 8, 11, 16, 22, 28, 40])], opts);

    expect(plays).toHaveLength(1);
    expect(plays[0].runner.marketRank).toBeGreaterThan(1);
  });

  it("skips races below the offer's minimum field size", () => {
    expect(buildOfferEdgePlays(offer, [race([2.5, 4, 6, 9, 14, 20])], opts)).toEqual([]);
  });

  it("returns no plays for unconditional bet&get (empty qualifying places)", () => {
    const unconditional: OfferEdgeOffer = {
      ...offer,
      title: "Bet £5 get £5 free bet",
      rules: { ...rules, betStake: 5, freeBetAmount: 5, qualifyingPlaces: [] },
    };
    expect(
      buildOfferEdgePlays(unconditional, [race(TIGHT_BOOK)], opts)
    ).toEqual([]);
  });

  it("skips finished races", () => {
    const finished = race([1.6, 5, 7, 9, 14, 20, 25, 33], { status: "finished" });
    expect(buildOfferEdgePlays(offer, [finished], opts)).toEqual([]);
  });

  it("warns about the non-runner trap at exactly the minimum field size", () => {
    const [play] = buildOfferEdgePlays(offer, [race([1.6, 5, 7, 9, 14, 20, 25, 33])], opts);
    expect(play.warnings).toContain(
      "Exactly 8 runners, one non-runner and this offer no longer qualifies"
    );
  });

  it("does not warn about non-runners when the field has room to spare", () => {
    const [play] = buildOfferEdgePlays(
      offer,
      [race([1.6, 5, 7, 9, 14, 20, 25, 33, 40, 50])],
      opts
    );
    expect(play.warnings.join(" ")).not.toContain("no longer qualifies");
  });

  it("warns when there is not enough money at the lay price", () => {
    const thin = race([1.6, 5, 7, 9, 14, 20, 25, 33]);
    for (const r of thin.runners) r.exchangeLaySize = 10;

    const [play] = buildOfferEdgePlays(offer, [thin], opts);
    expect(play.warnings.some((w) => w.includes("available at the lay price"))).toBe(true);
  });

  it("warns when prices are not live", () => {
    const estimated = race([1.6, 5, 7, 9, 14, 20, 25, 33], { exchangeSource: "estimated" });
    for (const r of estimated.runners) r.exchangeSource = "estimated";

    const [play] = buildOfferEdgePlays(offer, [estimated], opts);
    expect(play.warnings).toContain("Prices are estimates, no live exchange match for this race");
    expect(play.confidence).not.toBe("live");
  });

  it("credits a minimum-sized field and a dominant favourite in its reasons", () => {
    const [play] = buildOfferEdgePlays(offer, [race([1.4, 6, 8, 11, 16, 22, 28, 40])], opts);

    expect(play.reasons.join(" | ")).toContain("Only 8 runners, the minimum this offer allows");
    expect(play.reasons.some((r) => r.includes("favourite should take the win"))).toBe(true);
    expect(play.reasons.length).toBeLessThanOrEqual(3);
  });

  it("falls back to no play when too little of the field is priced", () => {
    const sparse = race([1.6, 5, 7, 9, 14, 20, 25, 33]);
    for (const r of sparse.runners.slice(4)) {
      r.exchangeDecimal = undefined;
      r.exchangeBackDecimal = undefined;
    }
    expect(buildOfferEdgePlays(offer, [sparse], opts)).toEqual([]);
  });

  it("honours the race limit", () => {
    const races = [1, 2, 3, 4, 5, 6, 7].map((i) =>
      race([2.5, 4.5, 6, 8, 11, 15, 20, 30], {
        externalId: `r${i}`,
        startTime: Date.parse("2026-07-31T14:20:00Z") + i * 60000,
      })
    );
    expect(buildOfferEdgePlays(offer, races, { ...opts, limit: 3 })).toHaveLength(3);
  });

  it("returns nothing for a malformed offer", () => {
    const broken = { ...offer, rules: { ...rules, betStake: 0 } };
    expect(buildOfferEdgePlays(broken, [race([2.5, 4.5, 6, 8, 11, 15, 20, 30])], opts)).toEqual([]);
  });

  it("triggers on the target places only, never on the win", () => {
    // The whole point of a consolation offer: winning is a miss. Recompute the
    // book independently and check the engine's trigger against it.
    const field = race([1.6, 5, 7, 9, 14, 20, 25, 33]);
    const [play] = buildOfferEdgePlays(offer, [field], opts);

    const book = winProbsFromRunners(field.runners)!;
    const { byRunner } = finishPositionProbs(book.probs, { maxPosition: 4 })!;
    const picked = field.runners.findIndex((r) => r.horseId === play.runner.horseId);
    const row = byRunner[book.indexes.indexOf(picked)];

    expect(play.triggerProb).toBeCloseTo(sumPositions(row, [2, 3, 4]), 12);
    // Including the win would add a real amount of probability, so the exclusion
    // is a meaningful constraint rather than a rounding coincidence.
    expect(sumPositions(row, [1, 2, 3, 4]) - play.triggerProb).toBeGreaterThan(0.05);
  });

  it("includes the win when the offer says a win qualifies", () => {
    const winToo: OfferEdgeOffer = {
      ...offer,
      rules: { ...rules, qualifyingPlaces: [1, 2, 3, 4] },
    };
    const field = [race([1.6, 5, 7, 9, 14, 20, 25, 33])];

    const [consolation] = buildOfferEdgePlays(offer, field, opts);
    const [anyPlace] = buildOfferEdgePlays(winToo, field, opts);

    expect(anyPlace.triggerProb).toBeGreaterThan(consolation.triggerProb);
    expect(anyPlace.runner.marketRank).toBe(1);
  });

  it("models every place an offer pays on, including past 4th", () => {
    const deep: OfferEdgeOffer = {
      ...offer,
      rules: { ...rules, qualifyingPlaces: [2, 3, 4, 5, 6] },
    };
    const field = [race([1.6, 5, 7, 9, 14, 20, 25, 33])];

    const [shallow] = buildOfferEdgePlays(offer, field, opts);
    const [play] = buildOfferEdgePlays(deep, field, opts);

    expect(play.triggerBasis).toBe("model");
    // Truncating to 4th would silently return the same trigger for both.
    expect(play.triggerProb).toBeGreaterThan(shallow.triggerProb + 0.05);
  });

  it("keeps the money on screen adding up", () => {
    // Horse 2 in this book: back 5.00, lay 5.10, £50 stake, 2% commission, 0.8
    // retention. The card shows all three figures, so the rounded parts have to
    // reconcile rather than each being rounded from its own raw value.
    const [play] = buildOfferEdgePlays(offer, [race([1.6, 5, 7, 9, 14, 20, 25, 33])], opts);

    expect(play.runner.name).toBe("Horse 2");
    expect(play.runner.backDecimal).toBe(5);
    expect(play.runner.layDecimal).toBe(5.1);
    expect(play.qualLoss).toBe(-1.77);
    expect(play.freeBetEv).toBe(24.09);
    expect(play.totalEv).toBe(22.32);
    expect(play.qualLoss + play.freeBetEv).toBeCloseTo(play.totalEv, 10);
  });

  it("keeps the live chip when the book is complete and tight", () => {
    const [play] = buildOfferEdgePlays(offer, [race(TIGHT_BOOK)], opts);

    expect(play.confidence).toBe("live");
    expect(play.oddsSource).toBe("live");
    expect(play.exchangeSource).toBe("live");
    expect(play.warnings.join(" ")).not.toContain("patchy");
  });

  it("drops the live chip when too little of the book is two-sided", () => {
    // Same tight book, so overround and coverage both still pass and only the
    // one-sided share can be what moves the tier.
    const oneSided = race(TIGHT_BOOK);
    for (const r of oneSided.runners) r.exchangeBackDecimal = undefined;

    const [play] = buildOfferEdgePlays(offer, [oneSided], opts);
    expect(play.confidence).toBe("mixed");
    expect(play.warnings).toContain("Exchange book is patchy here, treat the figure as indicative");
  });

  it("holds the live chip at exactly half the book two-sided", () => {
    const half = race(TIGHT_BOOK);
    for (const r of half.runners.slice(4)) r.exchangeBackDecimal = undefined;
    expect(buildOfferEdgePlays(offer, [half], opts)[0].confidence).toBe("live");

    const belowHalf = race(TIGHT_BOOK);
    for (const r of belowHalf.runners.slice(3)) r.exchangeBackDecimal = undefined;
    expect(buildOfferEdgePlays(offer, [belowHalf], opts)[0].confidence).toBe("mixed");
  });

  it("drops the live chip when the book normalises miles out", () => {
    // A 26% overround book has no business wearing the same chip as a tight one,
    // however live its prices are.
    const wide = race([1.6, 5, 7, 9, 14, 20, 25, 33]);
    expect(buildOfferEdgePlays(offer, [wide], opts)[0].confidence).toBe("mixed");
  });

  it("drops the live chip when a runner carries no price at all", () => {
    expect(buildOfferEdgePlays(offer, [race(TIGHT_BOOK_10)], opts)[0].confidence).toBe("live");

    // Coverage 0.9 still clears the modelling floor, so the race is priced; it just
    // is not a complete book any more.
    const gappy = race(TIGHT_BOOK_10);
    gappy.runners[9].exchangeDecimal = undefined;
    gappy.runners[9].exchangeBackDecimal = undefined;

    expect(buildOfferEdgePlays(offer, [gappy], opts)[0].confidence).toBe("mixed");
  });

  it("carries the retention rate it used and how many bets back it", () => {
    // The panel names the rate in its footnote, so the play has to report the rate
    // actually applied rather than let the UI hardcode the default.
    const field = [race([1.6, 5, 7, 9, 14, 20, 25, 33])];
    const [prior] = buildOfferEdgePlays(offer, field, { date: opts.date });
    const [measured] = buildOfferEdgePlays(offer, field, {
      ...opts,
      retention: 0.72,
      retentionSampleSize: 12,
    });

    expect(prior.retention).toBe(0.8);
    expect(prior.retentionSampleSize).toBe(0);
    expect(measured.retention).toBe(0.72);
    expect(measured.retentionSampleSize).toBe(12);
  });

  it("scales the free-bet leg with measured retention", () => {
    const field = [race([1.6, 5, 7, 9, 14, 20, 25, 33])];
    const [high] = buildOfferEdgePlays(offer, field, { ...opts, retention: 0.9 });
    const [low] = buildOfferEdgePlays(offer, field, { ...opts, retention: 0.6 });

    expect(high.freeBetEv).toBeGreaterThan(low.freeBetEv);
    expect(high.totalEv).toBeGreaterThan(low.totalEv);
  });
});

describe("formatEdgePlaySummary", () => {
  it("reads as a single instruction", () => {
    const [play] = buildOfferEdgePlays(offer, [race([1.6, 5, 7, 9, 14, 20, 25, 33])], opts);
    expect(formatEdgePlaySummary(play)).toMatch(
      /^Chepstow \d{1,2}:\d{2}, back Horse \d+ at \d+\.\d{2}, EV [+-]£\d+\.\d{2}\.$/
    );
  });

  it("renders the off time from the epoch, not the racecard's am/pm-less string", () => {
    // The Racing API gives "2:00" for a 2pm race. Formatting that string directly
    // would read as two in the morning.
    const afternoon = race([1.6, 5, 7, 9, 14, 20, 25, 33], {
      offTime: "2:00",
      startTime: Date.parse("2026-07-31T13:00:00Z"),
    });
    const [play] = buildOfferEdgePlays(offer, [afternoon], opts);

    expect(formatEdgePlaySummary(play)).toContain(formatClockTime(play.startTime));
    expect(formatEdgePlaySummary(play)).not.toContain("Chepstow 2:00");
  });
});
