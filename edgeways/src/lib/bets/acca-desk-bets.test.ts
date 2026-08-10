import { describe, expect, it } from "vitest";
import type { BetRow } from "@/lib/db/schema";
import {
  accaLaySeq,
  accaRunLabelFromBack,
  betsForAccaRun,
  formatAccaDeskBetDisplayTitle,
  isAccaDeskBack,
  isAccaDeskConvertBack,
  isAccaDeskLay,
  isAccaLayForRun,
  sortCampaignBetsWithAcca,
} from "./acca-desk-bets";

function bet(over: Partial<BetRow> & Pick<BetRow, "id" | "label">): BetRow {
  return {
    eventId: null,
    market: "other",
    selection: "",
    betType: "qualifying",
    bookmaker: null,
    exchangeId: null,
    backStake: 0,
    backOdds: 0,
    layStake: 0,
    layOdds: 0,
    commission: 0,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: null,
    actualProfit: null,
    notes: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: 1,
    settledAt: null,
    offerId: null,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: null,
    ...over,
  };
}

describe("acca-desk-bets helpers", () => {
  it("recognises Acca Desk backs and lays", () => {
    expect(
      isAccaDeskBack(
        bet({
          id: 1,
          label: "Acca · Offer",
          notes: "Acca desk run - hedged leg-by-leg on the exchange",
        })
      )
    ).toBe(true);
    expect(isAccaDeskLay(bet({ id: 2, label: "Acca lay · Team", betType: "lay_only" }))).toBe(
      true
    );
    expect(isAccaDeskBack(bet({ id: 3, label: "Ordinary qualify" }))).toBe(false);
  });

  it("parses run label and matches lays to the Acca run", () => {
    const back = bet({
      id: 1,
      label: "Acca FB · Weekend",
      notes: "Acca desk free-bet convert - hedged on the exchange",
      offerId: 7,
      betType: "free_snr",
    });
    expect(accaRunLabelFromBack(back)).toBe("Weekend");
    expect(isAccaDeskConvertBack(back)).toBe(true);
    expect(
      isAccaLayForRun(
        bet({
          id: 2,
          label: "Acca lay · Team",
          betType: "lay_only",
          notes: 'Acca desk: leg 1 of "Weekend"',
        }),
        "Weekend",
        null
      )
    ).toBe(true);
    expect(
      isAccaLayForRun(
        bet({
          id: 3,
          label: "Acca lay · Other",
          betType: "lay_only",
          offerId: 7,
        }),
        "Weekend",
        7
      )
    ).toBe(true);
    expect(
      isAccaLayForRun(
        bet({
          id: 4,
          label: "Acca lay · Other",
          betType: "lay_only",
          notes: 'Acca desk: leg 1 of "Elsewhere"',
        }),
        "Weekend",
        null
      )
    ).toBe(false);
  });

  it("sorts campaign bets qualify → convert → lays by seq → other", () => {
    const qualify = bet({
      id: 1,
      label: "Acca · Offer",
      notes: "Acca desk run - hedged on the exchange",
      betType: "qualifying",
      createdAt: 100,
    });
    const convert = bet({
      id: 4,
      label: "Acca FB · Convert",
      notes: "Acca desk free-bet convert - hedged on the exchange",
      betType: "free_snr",
      createdAt: 400,
    });
    const leg2 = bet({
      id: 3,
      label: "Acca lay · B",
      betType: "lay_only",
      notes: 'Acca desk: leg 2 of "Convert"',
      createdAt: 600,
    });
    const leg1 = bet({
      id: 2,
      label: "Acca lay · A",
      betType: "lay_only",
      notes: 'Acca desk: leg 1 of "Convert"',
      createdAt: 500,
    });
    const other = bet({ id: 9, label: "Mug", createdAt: 50 });
    expect(accaLaySeq(leg2)).toBe(2);
    expect(
      sortCampaignBetsWithAcca([other, leg2, convert, qualify, leg1]).map((b) => b.id)
    ).toEqual([1, 4, 2, 3, 9]);
  });

  it("partitions campaign bets per Acca run without offerId bleed", () => {
    const qualifyBack = bet({
      id: 151,
      label: "Acca · Offer",
      notes: "Acca desk run - hedged on the exchange",
      betType: "qualifying",
      offerId: 174,
      createdAt: 100,
    });
    const convertBack = bet({
      id: 152,
      label: "Acca FB · Convert FB",
      notes: "Acca desk free-bet convert - hedged on the exchange",
      betType: "free_snr",
      offerId: 174,
      createdAt: 200,
    });
    const convertLay = bet({
      id: 153,
      label: "Acca lay · Horse",
      betType: "lay_only",
      notes: 'Acca desk: leg 1 of "Convert FB · Betfair Sportsbook"',
      offerId: 174,
      selection: "Horse",
      createdAt: 300,
    });
    const all = [qualifyBack, convertBack, convertLay];

    expect(
      betsForAccaRun(
        { label: "Bet £10 get £10 free bet", backBetId: 151, wholeLayBetId: null },
        [],
        all
      ).map((b) => b.id)
    ).toEqual([151]);

    expect(
      betsForAccaRun(
        {
          label: "Convert FB · Betfair Sportsbook",
          backBetId: 152,
          wholeLayBetId: null,
        },
        [{ layBetId: 153 }],
        all
      ).map((b) => b.id)
    ).toEqual([152, 153]);
  });

  it("formats Tracker display titles in plain language", () => {
    expect(
      formatAccaDeskBetDisplayTitle(
        bet({
          id: 1,
          label: "Acca · Bet £10 get £10 free bet",
          notes: "Acca desk run - hedged on the exchange",
          betType: "qualifying",
        })
      )
    ).toBe("Qualify acca");
    expect(
      formatAccaDeskBetDisplayTitle(
        bet({
          id: 2,
          label: "Acca FB · Convert FB · Betfair Sportsbook",
          notes: "Acca desk free-bet convert - hedged on the exchange",
          betType: "free_snr",
        })
      )
    ).toBe("Convert free bet");
    expect(
      formatAccaDeskBetDisplayTitle(
        bet({
          id: 3,
          label: "Acca lay · Randox Rated Hurdle",
          betType: "lay_only",
          selection: "Trasna Na Pairce",
          market: "win",
        })
      )
    ).toBe("Lay · Trasna Na Pairce");
  });
});
