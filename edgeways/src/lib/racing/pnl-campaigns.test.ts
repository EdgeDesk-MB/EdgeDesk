import { describe, expect, it } from "vitest";
import type { AccaLegRow, AccaRunRow } from "@/lib/db/schema";
import { racingDeskPnlCampaigns } from "./pnl-campaigns";

function accaRun(partial: Partial<AccaRunRow> & Pick<AccaRunRow, "id">): AccaRunRow {
  return {
    offerId: null,
    label: "Haydock 2-fold",
    method: "sequential",
    stake: 10,
    bookmaker: null,
    commission: 0,
    refundAmount: null,
    backBetId: 101,
    wholeLayBetId: null,
    wholeLayStake: null,
    wholeLayOdds: null,
    boostPct: null,
    noLay: 0,
    muteAlerts: 0,
    status: "completed",
    createdAt: 1,
    settledAt: 2,
    ...partial,
  };
}

function accaLeg(
  partial: Partial<AccaLegRow> & Pick<AccaLegRow, "id" | "seq" | "result">
): AccaLegRow {
  return {
    runId: 4,
    label: `L${partial.seq}`,
    eventId: null,
    sport: "horse_racing",
    market: null,
    selection: null,
    backOdds: 2,
    layOdds: null,
    layStake: null,
    layBetId: null,
    scheduledAt: null,
    ...partial,
  };
}

describe("racingDeskPnlCampaigns", () => {
  it("nets a settled acca as back + lays (worked: −10 −8 +15 = −3)", () => {
    const betsById = new Map([
      [101, { status: "lost" as const, actualProfit: -10, expectedProfit: -10 }],
      [102, { status: "lost" as const, actualProfit: -8, expectedProfit: -8 }],
      [103, { status: "won" as const, actualProfit: 15, expectedProfit: 15 }],
    ]);

    const [campaign] = racingDeskPnlCampaigns({
      betsById,
      acca: [
        {
          run: accaRun({ id: 4 }),
          backBetType: "qualifying",
          legs: [
            accaLeg({
              id: 1,
              seq: 1,
              result: "won",
              eventId: 83,
              layStake: 10,
              layOdds: 2,
              layBetId: 102,
            }),
            accaLeg({
              id: 2,
              seq: 2,
              result: "lost",
              eventId: 82,
              layStake: 16,
              layOdds: 2,
              layBetId: 103,
            }),
          ],
        },
      ],
    });

    expect(campaign).toMatchObject({
      id: 4,
      kind: "acca",
      status: "completed",
      settledProfit: -3,
      linkedBetIds: [101, 102, 103],
      eventIds: [83, 82],
      decidedEventIds: [83, 82],
    });
  });

  it("uses square provisional for an active covered acca", () => {
    const [campaign] = racingDeskPnlCampaigns({
      betsById: new Map(),
      acca: [
        {
          run: accaRun({ id: 4, status: "active", settledAt: null }),
          backBetType: "qualifying",
          legs: [
            accaLeg({
              id: 1,
              seq: 1,
              result: "won",
              eventId: 83,
              layStake: 10,
              layOdds: 2,
              layBetId: 102,
            }),
            accaLeg({
              id: 2,
              seq: 2,
              result: "pending",
              eventId: 82,
              layStake: 20,
              layOdds: 3,
              layBetId: 103,
            }),
            accaLeg({ id: 3, seq: 3, result: "pending", eventId: 84 }),
          ],
        },
      ],
    });

    expect(campaign?.status).toBe("active");
    expect(campaign?.openProfit).toBe(0);
    expect(campaign?.decidedEventIds).toEqual([83]);
  });

  it("nets a settled bet builder as back + whole lay", () => {
    const [campaign] = racingDeskPnlCampaigns({
      betsById: new Map([
        [201, { status: "lost" as const, actualProfit: -10, expectedProfit: -10 }],
        [202, { status: "won" as const, actualProfit: 9.31, expectedProfit: 9.31 }],
      ]),
      betBuilder: [
        {
          run: {
            id: 7,
            label: "Extra place",
            status: "completed",
            backBetId: 201,
            wholeLayBetId: 202,
            eventId: 82,
          },
        },
      ],
    });

    expect(campaign).toMatchObject({
      kind: "bet_builder",
      settledProfit: -0.69,
      eventIds: [82],
      linkedBetIds: [201, 202],
    });
  });
});
