import { describe, expect, it } from "vitest";
import { wholeAccaLay } from "@/lib/calc/acca-workflow";
import {
  accaCampaignCompleteAlert,
  accaCompleteAlertCopy,
  accaCompleteAlertKey,
  accaRunIdsToAnnounce,
  classifyAccaComplete,
  mergeAccaStatusMap,
  type AccaCompleteAlertRun,
} from "./acca-complete";

function run(over: Partial<AccaCompleteAlertRun> = {}): AccaCompleteAlertRun {
  return {
    id: 7,
    label: "Bet £10 get £10 free bet",
    method: "sequential",
    bookmaker: "Betfair Sportsbook",
    offerTitle: "Bet £10 get £10 free bet",
    stake: 10,
    commission: 0,
    boostPct: null,
    backBetType: "qualifying",
    refundAmount: null,
    noLay: 0,
    wholeLayStake: null,
    wholeLayOdds: null,
    legs: [
      {
        seq: 1,
        label: "Star Start",
        result: "won",
        backOdds: 5,
        layStake: 10,
        layOdds: 6.4,
      },
      {
        seq: 2,
        label: "Burning Up",
        result: "won",
        backOdds: 1.4,
        layStake: null,
        layOdds: null,
      },
    ],
    ...over,
  };
}

describe("accaCompleteAlertKey", () => {
  it("is stable per run", () => {
    expect(accaCompleteAlertKey(7)).toBe("acca_complete:7");
  });
});

describe("classifyAccaComplete + copy", () => {
  it("Sam's double: all win, first laid only → Acca won at campaign +£6", () => {
    const r = run();
    expect(classifyAccaComplete(r)).toBe("won");
    const copy = accaCompleteAlertCopy(r);
    expect(copy.profit).toBe(6);
    expect(copy.title).toBe("You just made £6.00 · Acca won");
    expect(copy.body).toBe(
      "Qualifying · Bet £10 get £10 free bet · Double · 1 laid"
    );
  });

  it("covered first-leg bust → Acca busted at £0", () => {
    const r = run({
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "lost",
          backOdds: 5,
          layStake: 10,
          layOdds: 6.4,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "pending",
          backOdds: 1.4,
          layStake: null,
          layOdds: null,
        },
      ],
    });
    expect(classifyAccaComplete(r)).toBe("busted");
    const copy = accaCompleteAlertCopy(r);
    expect(copy.profit).toBe(0);
    expect(copy.title).toBe("£0.00 settled · Acca busted");
    expect(copy.body).toContain("Busted at Star Start");
  });

  it("naked first-leg bust → Acca lost −£10", () => {
    const r = run({
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "lost",
          backOdds: 5,
          layStake: null,
          layOdds: null,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "pending",
          backOdds: 1.4,
          layStake: null,
          layOdds: null,
        },
      ],
    });
    expect(classifyAccaComplete(r)).toBe("lost");
    const copy = accaCompleteAlertCopy(r);
    expect(copy.profit).toBe(-10);
    expect(copy.title).toBe("-£10.00 settled · Acca lost");
  });

  it("sequential final lock (all win) → Acca locked at the equalised £", () => {
    const r = run({
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "won",
          backOdds: 5,
          layStake: 10,
          layOdds: 6.4,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "won",
          backOdds: 1.4,
          layStake: 50,
          layOdds: 1.4,
        },
      ],
    });
    expect(classifyAccaComplete(r)).toBe("locked");
    const copy = accaCompleteAlertCopy(r);
    expect(copy.profit).toBeCloseTo(-14, 2);
    expect(copy.title).toBe("-£14.00 settled · Acca locked");
    expect(copy.body).toContain("2 laid");
  });

  it("sequential final lock that loses the last leg is still locked, not busted", () => {
    const r = run({
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "won",
          backOdds: 5,
          layStake: 10,
          layOdds: 6.4,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "lost",
          backOdds: 1.4,
          layStake: 50,
          layOdds: 1.4,
        },
      ],
    });
    expect(classifyAccaComplete(r)).toBe("locked");
    expect(accaCompleteAlertCopy(r).profit).toBeCloseTo(-14, 2);
  });

  it("all void → Acca void, no signed P&L", () => {
    const r = run({
      legs: [
        {
          seq: 1,
          label: "A",
          result: "void",
          backOdds: 5,
          layStake: 10,
          layOdds: 6.4,
        },
        {
          seq: 2,
          label: "B",
          result: "void",
          backOdds: 1.4,
          layStake: null,
          layOdds: null,
        },
      ],
    });
    expect(classifyAccaComplete(r)).toBe("void");
    expect(accaCompleteAlertCopy(r).title).toBe("Acca void · stakes returned");
  });

  it("insurance one-loss cover mentions the refund", () => {
    const r = run({
      method: "insurance_legs",
      refundAmount: 10,
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "lost",
          backOdds: 5,
          layStake: 10,
          layOdds: 6.4,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "won",
          backOdds: 1.4,
          layStake: null,
          layOdds: null,
        },
      ],
    });
    expect(classifyAccaComplete(r)).toBe("busted");
    const copy = accaCompleteAlertCopy(r);
    expect(copy.body).toContain("Claim the £10.00 refund");
    expect(copy.profit).toBe(0);
  });

  it("insurance two losses does not mention a refund", () => {
    const r = run({
      method: "insurance_legs",
      refundAmount: 10,
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "lost",
          backOdds: 5,
          layStake: 10,
          layOdds: 6.4,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "lost",
          backOdds: 1.4,
          layStake: null,
          layOdds: null,
        },
      ],
    });
    expect(classifyAccaComplete(r)).toBe("busted");
    expect(accaCompleteAlertCopy(r).body).not.toContain("Claim");
  });

  it("combined no-lay all-win is the bookie ticket", () => {
    const r = run({
      method: "combined",
      noLay: 1,
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "won",
          backOdds: 5,
          layStake: null,
          layOdds: null,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "won",
          backOdds: 1.4,
          layStake: null,
          layOdds: null,
        },
      ],
    });
    expect(classifyAccaComplete(r)).toBe("won");
    const copy = accaCompleteAlertCopy(r);
    expect(copy.profit).toBe(60);
    expect(copy.title).toBe("You just made £60.00 · Acca won");
    expect(copy.body).toContain("No lay");
  });

  it("combined equalising whole lay → Acca locked", () => {
    const whole = wholeAccaLay({
      stake: 10,
      combinedOdds: 7,
      layOdds: 7,
      commission: 0,
    })!;
    const r = run({
      method: "combined",
      wholeLayStake: whole.layStake,
      wholeLayOdds: 7,
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "won",
          backOdds: 5,
          layStake: null,
          layOdds: null,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "won",
          backOdds: 1.4,
          layStake: null,
          layOdds: null,
        },
      ],
    });
    expect(classifyAccaComplete(r)).toBe("locked");
    const copy = accaCompleteAlertCopy(r);
    expect(copy.profit).toBeCloseTo(whole.profitIfAllWin, 2);
    expect(copy.title).toContain("Acca locked");
  });

  it("free-bet covered bust extracts the lay, not the stake", () => {
    const r = run({
      backBetType: "free_snr",
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "lost",
          backOdds: 5,
          layStake: 10,
          layOdds: 6.4,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "pending",
          backOdds: 1.4,
          layStake: null,
          layOdds: null,
        },
      ],
    });
    const copy = accaCompleteAlertCopy(r);
    expect(copy.kind).toBe("busted");
    expect(copy.profit).toBe(10);
    expect(copy.title).toBe("You just made £10.00 · Acca busted");
    expect(copy.body).toMatch(/^Free bet ·/);
  });

  it("commission on a covered bust is the true campaign floor", () => {
    const r = run({
      commission: 0.05,
      legs: [
        {
          seq: 1,
          label: "Star Start",
          result: "lost",
          backOdds: 5,
          layStake: 10,
          layOdds: 6.4,
        },
        {
          seq: 2,
          label: "Burning Up",
          result: "pending",
          backOdds: 1.4,
          layStake: null,
          layOdds: null,
        },
      ],
    });
    const copy = accaCompleteAlertCopy(r);
    expect(copy.profit).toBeCloseTo(-0.5, 10);
    expect(copy.title).toBe("-£0.50 settled · Acca busted");
  });
});

describe("accaCampaignCompleteAlert", () => {
  it("is a campaign alert that lands on Acca Desk", () => {
    const alert = accaCampaignCompleteAlert(run());
    expect(alert).toMatchObject({
      key: "acca_complete:7",
      kind: "acca_complete",
      href: "/acca",
      bookmaker: "Betfair Sportsbook",
      tone: "positive",
    });
  });
});

describe("accaRunIdsToAnnounce", () => {
  const NOW = 1_800_000_000_000;

  it("seeds silently on the first poll", () => {
    expect(
      accaRunIdsToAnnounce(
        null,
        [{ id: 7, status: "completed", settledAt: NOW - 1_000 }],
        NOW
      )
    ).toEqual([]);
  });

  it("announces active → completed", () => {
    expect(
      accaRunIdsToAnnounce(
        new Map([[7, "active"]]),
        [{ id: 7, status: "completed", settledAt: NOW - 1_000 }],
        NOW
      )
    ).toEqual([7]);
  });

  it("does not re-announce an already completed run", () => {
    expect(
      accaRunIdsToAnnounce(
        new Map([[7, "completed"]]),
        [{ id: 7, status: "completed", settledAt: NOW - 1_000 }],
        NOW
      )
    ).toEqual([]);
  });

  it("announces a first-seen recent completion after seed", () => {
    expect(
      accaRunIdsToAnnounce(
        new Map(),
        [{ id: 7, status: "completed", settledAt: NOW - 1_000 }],
        NOW
      )
    ).toEqual([7]);
  });
});

describe("mergeAccaStatusMap", () => {
  it("keeps prior ids and updates status", () => {
    const next = mergeAccaStatusMap(new Map([[1, "active"]]), [
      { id: 1, status: "completed" },
      { id: 2, status: "active" },
    ]);
    expect(next.get(1)).toBe("completed");
    expect(next.get(2)).toBe("active");
  });
});
