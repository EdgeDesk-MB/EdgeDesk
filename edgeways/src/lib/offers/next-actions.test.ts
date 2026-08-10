import { describe, expect, it } from "vitest";
import {
  deriveOfferNextAction,
  listOfferNextActions,
} from "@/lib/offers/next-actions";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import { formatClockTime } from "@/lib/time-format";

function edgePlay(over: Partial<OfferEdgePlay> = {}): OfferEdgePlay {
  return {
    offerId: 2,
    offerTitle: "Reload",
    bookmaker: "Bet365",
    raceExternalId: "race-1",
    course: "Chepstow",
    raceName: "Handicap Chase",
    offTime: "15:20",
    startTime: Date.parse("2026-07-31T14:20:00Z"),
    region: "GB",
    fieldSize: 9,
    runner: {
      horseId: "storm-rider",
      name: "Storm Rider",
      backDecimal: 6.5,
      layDecimal: 6.8,
      marketRank: 3,
    },
    triggerProb: 0.42,
    triggerBasis: "model",
    qualLoss: -1.2,
    layStake: 47.9,
    freeBetEv: 13.6,
    totalEv: 12.4,
    retention: 0.8,
    retentionSampleSize: 8,
    confidence: "live",
    reasons: ["Only 9 runners, the minimum this offer allows"],
    warnings: [],
    ...over,
  };
}

function offer(partial: Partial<OfferSummary> & Pick<OfferSummary, "id" | "title">): OfferSummary {
  const { profit: profitPartial, ...rest } = partial;
  return {
    id: rest.id,
    bookmaker: rest.bookmaker ?? "Bet365",
    title: rest.title,
    description: null,
    expectedProfit: null,
    status: rest.status ?? "active",
    sport: rest.sport ?? null,
    offerType: rest.offerType ?? null,
    rules: rest.rules ?? null,
    scopeCourse: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: null,
    expiresAt: rest.expiresAt ?? null,
    completedAt: null,
    seriesId: null,
    instanceDate: null,
    startsOn: null,
    source: null,
    offerUrl: null,
    createdAt: Date.now(),
    betCount: rest.betCount ?? 0,
    openBets: rest.openBets ?? 0,
    actualProfit: 0,
    expectedFromBets: 0,
    profit: {
      qualifyingProfit: 0,
      qualifyingSettledCount: 0,
      qualifyingOpenCount: 0,
      freeBetAwarded: false,
      freeBetAwardAmount: null,
      freeBetAwardReason: null,
      freeBetStage: "none",
      freeBetProfit: 0,
      freeBetOpenCount: 0,
      freeBetSettledCount: 0,
      openExpectedProfit: 0,
      totalProfit: 0,
      ...profitPartial,
    },
  };
}

describe("deriveOfferNextAction", () => {
  const now = new Date("2026-07-08T12:00:00Z").getTime();

  it("surfaces deposit playbook step before place qualifying", () => {
    const rules = JSON.stringify({
      type: "promo_terms",
      promoCode: "UEFA",
      minDeposit: 30,
      depositRequired: true,
      minOdds: 1.5,
      minStake: 20,
      playbook: {
        version: 1,
        steps: [
          {
            id: "deposit",
            kind: "deposit",
            title: "Deposit £30+ with code UEFA",
            detail: "Enter promo code UEFA on deposit.",
            sortOrder: 0,
            status: "pending",
            completion: null,
            completedAt: null,
          },
          {
            id: "qualify",
            kind: "qualify",
            title: "Place £20 qualifying bet",
            detail: "Cash bet",
            sortOrder: 1,
            status: "pending",
            completion: null,
            completedAt: null,
          },
          {
            id: "done",
            kind: "done",
            title: "Offer complete",
            detail: "",
            sortOrder: 2,
            status: "pending",
            completion: null,
            completedAt: null,
          },
        ],
      },
    });
    const action = deriveOfferNextAction(
      offer({
        id: 90,
        title: "UEFA Super Cup",
        bookmaker: "Dynobet",
        status: "active",
        rules,
        betCount: 0,
      })
    );
    expect(action?.kind).toBe("playbook_deposit");
    expect(action?.title).toMatch(/UEFA/);

    const planned = deriveOfferNextAction(
      offer({
        id: 91,
        title: "UEFA Super Cup",
        bookmaker: "Dynobet",
        status: "planned",
        rules,
        betCount: 0,
      })
    );
    expect(planned?.kind).toBe("playbook_deposit");
  });

  it("asks to convert when free bet is awarded", () => {
    const action = deriveOfferNextAction(
      offer({
        id: 1,
        title: "Bet £50 get £50",
        profit: {
          qualifyingProfit: -2,
          qualifyingSettledCount: 1,
          qualifyingOpenCount: 0,
          freeBetAwarded: true,
          freeBetAwardAmount: 50,
          freeBetAwardReason: "Finished 2nd",
          freeBetStage: "awarded",
          freeBetProfit: 0,
          freeBetOpenCount: 0,
          freeBetSettledCount: 0,
          openExpectedProfit: 0,
          totalProfit: -2,
        },
      }),
      now
    );
    expect(action?.kind).toBe("convert_free_bet");
    expect(action?.priority).toBeLessThan(20);
  });

  it("treats open conversion as waiting, not an actionable finish step", () => {
    const action = deriveOfferNextAction(
      offer({
        id: 4,
        title: "Bet £50 get £50 free bet (3rd, 4th)",
        betCount: 2,
        openBets: 1,
        expectedFromBets: 39.47,
        profit: {
          qualifyingProfit: -3.39,
          qualifyingSettledCount: 1,
          qualifyingOpenCount: 0,
          freeBetAwarded: true,
          freeBetAwardAmount: 50,
          freeBetAwardReason: "Finished 2nd",
          freeBetStage: "in_use",
          freeBetProfit: 0,
          freeBetOpenCount: 1,
          freeBetSettledCount: 0,
          openExpectedProfit: 39.47,
          totalProfit: 36.08,
        },
      }),
      now
    );
    expect(action?.kind).toBe("await_result");
    expect(action?.title).toMatch(/Conversion in play/i);
  });

  it("asks to place qualifying when active with no bets", () => {
    const action = deriveOfferNextAction(
      offer({ id: 2, title: "Reload", betCount: 0, status: "active" }),
      now
    );
    expect(action?.kind).toBe("place_qualifying");
  });

  it("names the race and horse when Offer Edge has a play", () => {
    const play = edgePlay();
    const action = deriveOfferNextAction(
      offer({ id: 2, title: "Reload", betCount: 0, status: "active" }),
      now,
      { edgePlays: new Map([[2, play]]) }
    );

    expect(action?.kind).toBe("place_qualifying");
    expect(action?.detail).toBe(
      `Chepstow ${formatClockTime(play.startTime)}, back Storm Rider at 6.50, EV +£12.40.`
    );
    expect(action?.edge?.raceExternalId).toBe("race-1");
    expect(action?.edge?.runnerName).toBe("Storm Rider");
  });

  it("names the race on a planned offer too", () => {
    const action = deriveOfferNextAction(
      offer({ id: 7, title: "Reload", betCount: 0, status: "planned" }),
      now,
      { edgePlays: new Map([[7, edgePlay()]]) }
    );

    expect(action?.kind).toBe("start_planned");
    expect(action?.detail).toContain("back Storm Rider at 6.50");
  });

  it("keeps the generic copy when no play matches the offer", () => {
    const action = deriveOfferNextAction(
      offer({ id: 2, title: "Reload", betCount: 0, status: "active" }),
      now,
      { edgePlays: new Map([[99, edgePlay()]]) }
    );

    expect(action?.edge).toBeUndefined();
    expect(action?.detail).toBe("No bets linked yet - start the qualifying leg at Bet365.");
  });

  it("shows a negative EV play honestly rather than hiding the sign", () => {
    const action = deriveOfferNextAction(
      offer({ id: 2, title: "Reload", betCount: 0, status: "active" }),
      now,
      { edgePlays: new Map([[2, edgePlay({ totalEv: -1.5 })]]) }
    );

    expect(action?.detail).toContain("EV -£1.50");
  });

  it("ignores completed offers", () => {
    expect(
      deriveOfferNextAction(offer({ id: 3, title: "Done", status: "completed" }), now)
    ).toBeNull();
  });

  it("ignores past-deadline offers even when status is still active", () => {
    expect(
      deriveOfferNextAction(
        offer({
          id: 5,
          title: "Late convert",
          status: "active",
          expiresAt: now - 60_000,
          profit: {
            qualifyingProfit: -1,
            qualifyingSettledCount: 1,
            qualifyingOpenCount: 0,
            freeBetAwarded: true,
            freeBetAwardAmount: 5,
            freeBetAwardReason: null,
            freeBetStage: "awarded",
            freeBetProfit: 0,
            freeBetOpenCount: 0,
            freeBetSettledCount: 0,
            openExpectedProfit: 0,
            totalProfit: -1,
          },
        }),
        now
      )
    ).toBeNull();
  });

  it("keeps free-bet ready copy short", () => {
    const action = deriveOfferNextAction(
      offer({
        id: 6,
        title: "Bet £5 get £5",
        profit: {
          qualifyingProfit: -0.5,
          qualifyingSettledCount: 1,
          qualifyingOpenCount: 0,
          freeBetAwarded: true,
          freeBetAwardAmount: 5,
          freeBetAwardReason: null,
          freeBetStage: "awarded",
          freeBetProfit: 0,
          freeBetOpenCount: 0,
          freeBetSettledCount: 0,
          openExpectedProfit: 0,
          totalProfit: -0.5,
        },
      }),
      now
    );
    expect(action?.detail).toBe("£5.00 free bet ready.");
  });

  it("ranks convert ahead of place qualifying and hides waiting conversions", () => {
    const actions = listOfferNextActions(
      [
        offer({ id: 1, title: "Qualify me", betCount: 0, status: "active" }),
        offer({
          id: 2,
          title: "Convert me",
          betCount: 1,
          profit: {
            qualifyingProfit: -1,
            qualifyingSettledCount: 1,
            qualifyingOpenCount: 0,
            freeBetAwarded: true,
            freeBetAwardAmount: 25,
            freeBetAwardReason: null,
            freeBetStage: "awarded",
            freeBetProfit: 0,
            freeBetOpenCount: 0,
            freeBetSettledCount: 0,
            openExpectedProfit: 0,
            totalProfit: -1,
          },
        }),
        offer({
          id: 3,
          title: "Already converting",
          betCount: 2,
          profit: {
            qualifyingProfit: -3,
            qualifyingSettledCount: 1,
            qualifyingOpenCount: 0,
            freeBetAwarded: true,
            freeBetAwardAmount: 50,
            freeBetAwardReason: null,
            freeBetStage: "in_use",
            freeBetProfit: 0,
            freeBetOpenCount: 1,
            freeBetSettledCount: 0,
            openExpectedProfit: 39,
            totalProfit: 36,
          },
        }),
      ],
      now
    );
    expect(actions.map((a) => a.offerId)).toEqual([2, 1]);
    expect(actions[0]?.kind).toBe("convert_free_bet");
    expect(actions.every((a) => a.kind !== "await_result")).toBe(true);
  });
});
