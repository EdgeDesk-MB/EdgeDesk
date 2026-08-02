import { describe, expect, it } from "vitest";
import {
  enumerationCost,
  finishPositionProbs,
  MAX_REQUESTED_POSITION,
  sumPositions,
  winProbsFromRunners,
  type FinishPositionOptions,
  type FinishPositionProbs,
} from "@/lib/calc/racing/finish-positions";

/** The model refuses depths it cannot afford; every book here is well inside budget. */
function model(winProbs: number[], opts?: FinishPositionOptions): FinishPositionProbs {
  const result = finishPositionProbs(winProbs, opts);
  if (!result) throw new Error("expected the model to price this book");
  return result;
}

/** Build a book: one named runner plus `n` others sharing the remaining probability. */
function bookWith(target: number, others: number[]): number[] {
  return [target, ...others];
}

function spread(total: number, count: number): number[] {
  return new Array<number>(count).fill(total / count);
}

function columnSum(byRunner: number[][], position: number): number {
  return byRunner.reduce((total, runner) => total + runner[position - 1], 0);
}

describe("finishPositionProbs", () => {
  it("reproduces the market exactly at position 1", () => {
    const { byRunner } = model([0.5, 0.3, 0.2]);
    expect(byRunner[0][0]).toBeCloseTo(0.5, 10);
    expect(byRunner[1][0]).toBeCloseTo(0.3, 10);
    expect(byRunner[2][0]).toBeCloseTo(0.2, 10);
  });

  it("matches the hand-worked Harville second-place vector", () => {
    // P(A 2nd) = 0.3 * (0.5/0.7) + 0.2 * (0.5/0.8)
    //          = 0.214285714... + 0.125 = 0.339285714...
    const { byRunner } = model([0.5, 0.3, 0.2]);
    expect(byRunner[0][1]).toBeCloseTo(0.3392857142857143, 12);
  });

  it("matches the hand-worked Harville third-place vector", () => {
    // Only two orderings can leave A third in a three-runner field:
    //   B, C, A -> 0.3 * (0.2/0.7) = 0.085714285...
    //   C, B, A -> 0.2 * (0.3/0.8) = 0.075
    const { byRunner } = model([0.5, 0.3, 0.2]);
    expect(byRunner[0][2]).toBeCloseTo(0.16071428571428573, 12);
    // Three runners, three positions, so A must finish somewhere.
    expect(byRunner[0].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("matches the hand-worked fourth place on an exact four-runner field", () => {
    // The 0.1 shot finishes last whenever the other three fill the frame. Summing
    // all six orderings of [0.4, 0.3, 0.2]:
    //   0.133333 + 0.1 + 0.114286 + 0.068571 + 0.075 + 0.06 = 0.551190476...
    // Four runners is also the boundary where the fourth denominator is a pure
    // cancellation residue, so this pins the guard as well as the arithmetic.
    const { byRunner } = model([0.4, 0.3, 0.2, 0.1]);
    expect(byRunner[3][3]).toBeCloseTo(0.5511904761904762, 12);
    expect(byRunner[0][3]).toBeCloseTo(0.07777777777777778, 12);
    expect(columnSum(byRunner, 4)).toBeCloseTo(1, 12);
  });

  it("keeps every position column summing to 1 while runners remain", () => {
    const probs = [0.28, 0.19, 0.14, 0.11, 0.09, 0.07, 0.06, 0.06];
    const { byRunner } = model(probs);

    for (let position = 1; position <= 4; position += 1) {
      expect(columnSum(byRunner, position)).toBeCloseTo(1, 10);
    }
  });

  it("keeps each runner's positions summing to at most 1, all within [0,1]", () => {
    const probs = [0.28, 0.19, 0.14, 0.11, 0.09, 0.07, 0.06, 0.06];
    const { byRunner } = model(probs);

    for (const runner of byRunner) {
      const total = runner.reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(1 + 1e-9);
      for (const value of runner) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("cannot place a runner beyond the size of the field", () => {
    const { byRunner } = model([0.5, 0.3, 0.2]);
    // Only three runners, so nobody finishes fourth.
    expect(columnSum(byRunner, 4)).toBeCloseTo(0, 12);
  });

  it("lifts second-place chances when the favourite is dominant", () => {
    // Same runner at a 12% win chance in both books; only the shape of the rest differs.
    const dominant = model(bookWith(0.12, [0.667, ...spread(0.213, 8)]));
    const weak = model(bookWith(0.12, [0.2, ...spread(0.68, 8)]));

    const behindDominant = dominant.byRunner[0][1];
    const behindWeak = weak.byRunner[0][1];

    expect(behindDominant).toBeGreaterThan(behindWeak);
    // Roughly 27% against roughly 13% - the effect is worth about double, not a rounding nudge.
    expect(behindDominant / behindWeak).toBeGreaterThan(1.8);
  });

  it("gives a smaller field a better chance of hitting places 2 to 4", () => {
    const small = model(bookWith(0.12, spread(0.88, 7)));
    const large = model(bookWith(0.12, spread(0.88, 15)));

    const smallPlaces = sumPositions(small.byRunner[0], [2, 3, 4]);
    const largePlaces = sumPositions(large.byRunner[0], [2, 3, 4]);

    expect(smallPlaces).toBeGreaterThan(largePlaces);
  });

  it("shifts place probability towards longshots when the Stern exponent drops below 1", () => {
    const probs = [0.45, 0.2, 0.15, 0.1, 0.06, 0.04];
    const harville = model(probs);
    const stern = model(probs, { exponent: 0.8 });

    const favouritePlaces = (model: number[][]) => sumPositions(model[0], [2, 3, 4]);
    const longshotPlaces = (model: number[][]) => sumPositions(model[5], [2, 3, 4]);

    expect(longshotPlaces(stern.byRunner)).toBeGreaterThan(longshotPlaces(harville.byRunner));
    expect(favouritePlaces(stern.byRunner)).toBeLessThan(favouritePlaces(harville.byRunner));
    // Position 1 must still be the raw market, whatever the exponent.
    expect(stern.byRunner[0][0]).toBeCloseTo(0.45, 12);
  });

  it("honours maxPosition and normalises an unnormalised book", () => {
    const { byRunner, maxPosition } = model([1, 1, 2], { maxPosition: 2 });
    expect(maxPosition).toBe(2);
    expect(byRunner[0]).toHaveLength(2);
    expect(byRunner[2][0]).toBeCloseTo(0.5, 12);
  });

  it("computes positions past 4th rather than quietly stopping there", () => {
    // An offer paying "2nd to 6th" has to actually get 5th and 6th, otherwise its
    // trigger probability is understated while still looking like a full result.
    const probs = [0.24, 0.18, 0.14, 0.12, 0.1, 0.09, 0.07, 0.06];
    const { byRunner } = model(probs, { maxPosition: 6 });

    expect(byRunner[0]).toHaveLength(6);
    for (let position = 1; position <= 6; position += 1) {
      expect(columnSum(byRunner, position)).toBeCloseTo(1, 10);
    }
    expect(sumPositions(byRunner[0], [2, 3, 4, 5, 6])).toBeGreaterThan(
      sumPositions(byRunner[0], [2, 3, 4])
    );
  });

  it("refuses a depth it cannot enumerate rather than truncating it", () => {
    const probs = [0.24, 0.18, 0.14, 0.12, 0.1, 0.09, 0.07, 0.06];
    expect(finishPositionProbs(probs, { maxPosition: 6, budget: 100 })).toBeNull();
    // A sixteen-runner field to 6th is past the shipped ceiling; to 5th it is not.
    const big = spread(1, 16);
    expect(finishPositionProbs(big, { maxPosition: 6 })).toBeNull();
    expect(finishPositionProbs(big, { maxPosition: 5 })).not.toBeNull();
  });

  it("refuses an absurd depth before allocating for it", () => {
    // Rows are sized to the request so callers always get the columns they asked
    // for, which means the request itself has to be bounded. Stored offer rules are
    // cast from JSON without validating qualifyingPlaces.
    const probs = [0.5, 0.3, 0.2];
    expect(finishPositionProbs(probs, { maxPosition: MAX_REQUESTED_POSITION })).not.toBeNull();
    expect(finishPositionProbs(probs, { maxPosition: MAX_REQUESTED_POSITION + 1 })).toBeNull();
    expect(finishPositionProbs(probs, { maxPosition: 200_000 })).toBeNull();
  });

  it("costs more the deeper the target and the bigger the field", () => {
    expect(enumerationCost(8, 4)).toBe(8 + 56 + 336 + 1680);
    expect(enumerationCost(16, 6)).toBeGreaterThan(enumerationCost(12, 6));
  });

  it("handles an empty or single-runner field without dividing by zero", () => {
    expect(model([]).byRunner).toEqual([]);
    const single = model([1]);
    expect(single.byRunner[0][0]).toBeCloseTo(1, 12);
    expect(single.byRunner[0][1]).toBe(0);
  });
});

describe("sumPositions", () => {
  it("sums the requested finishing positions only", () => {
    expect(sumPositions([0.1, 0.2, 0.15, 0.05], [2, 3, 4])).toBeCloseTo(0.4, 12);
    expect(sumPositions([0.1, 0.2, 0.15, 0.05], [1])).toBeCloseTo(0.1, 12);
  });

  it("ignores positions the model did not compute", () => {
    expect(sumPositions([0.1, 0.2], [2, 3, 4])).toBeCloseTo(0.2, 12);
  });
});

describe("winProbsFromRunners", () => {
  it("uses the back/lay midpoint when both sides of the book are present", () => {
    const result = winProbsFromRunners([
      { exchangeBackDecimal: 4, exchangeDecimal: 4.2 },
      { exchangeBackDecimal: 3, exchangeDecimal: 3.05 },
      { exchangeBackDecimal: 8, exchangeDecimal: 8.4 },
    ]);

    expect(result).not.toBeNull();
    // Midpoint implied probability for the first runner: (1/4 + 1/4.2) / 2
    const rawFirst = (1 / 4 + 1 / 4.2) / 2;
    const rawSecond = (1 / 3 + 1 / 3.05) / 2;
    const rawThird = (1 / 8 + 1 / 8.4) / 2;
    const total = rawFirst + rawSecond + rawThird;

    expect(result!.probs[0]).toBeCloseTo(rawFirst / total, 12);
    expect(result!.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("falls back to the lay price alone and tolerates an underround book", () => {
    const result = winProbsFromRunners([
      { exchangeDecimal: 2.2 },
      { exchangeDecimal: 3.6 },
      { exchangeDecimal: 5.5 },
    ]);

    expect(result).not.toBeNull();
    // 1/2.2 + 1/3.6 + 1/5.5 = 0.9141 - a lay-only book sums below 1.
    expect(result!.overroundPct).toBeLessThan(0);
    expect(result!.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("returns null when too little of the field is priced", () => {
    const runners = [
      { exchangeDecimal: 2.5 },
      { exchangeDecimal: 4 },
      { exchangeDecimal: 6 },
      { exchangeDecimal: 8 },
      { exchangeDecimal: 10 },
      { exchangeDecimal: 12 },
      { exchangeDecimal: 14 },
      { exchangeDecimal: 16 },
      {},
      {},
    ];
    expect(winProbsFromRunners(runners)).toBeNull();
    expect(winProbsFromRunners(runners, { minCoverage: 0.75 })).not.toBeNull();
  });

  it("reports how much of the book had both sides quoted", () => {
    const twoSided = winProbsFromRunners([
      { exchangeBackDecimal: 4, exchangeDecimal: 4.2 },
      { exchangeBackDecimal: 3, exchangeDecimal: 3.05 },
    ]);
    expect(twoSided!.twoSidedShare).toBe(1);

    // A one-sided price is skewed - 1/lay understates, 1/back overstates - and
    // normalising cannot undo that, so the caller has to be able to see it.
    const mixed = winProbsFromRunners([
      { exchangeBackDecimal: 4, exchangeDecimal: 4.2 },
      { exchangeDecimal: 3.05 },
      { exchangeBackDecimal: 8 },
      { exchangeDecimal: 12 },
    ]);
    expect(mixed!.twoSidedShare).toBeCloseTo(0.25, 12);
  });

  it("excludes non-runners from both the book and the coverage check", () => {
    const result = winProbsFromRunners([
      { exchangeDecimal: 2.5 },
      { exchangeDecimal: 4 },
      { exchangeDecimal: 6 },
      { nonRunner: true },
    ]);

    expect(result).not.toBeNull();
    expect(result!.indexes).toEqual([0, 1, 2]);
    expect(result!.coverage).toBe(1);
  });

  it("returns null when the field is empty or effectively unpriced", () => {
    expect(winProbsFromRunners([])).toBeNull();
    expect(winProbsFromRunners([{ exchangeDecimal: 2 }])).toBeNull();
  });
});
