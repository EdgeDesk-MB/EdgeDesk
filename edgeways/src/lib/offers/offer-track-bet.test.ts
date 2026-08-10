import { describe, expect, it } from "vitest";
import {
  deriveFreeBetLotConvertAction,
  deriveTrackBetAction,
  qualifyingOfferTriggerText,
} from "./offer-track-bet";
import type { OfferSummary } from "@/lib/services/offers.types";

function offer(
  partial: Omit<Partial<OfferSummary>, "profit"> &
    Pick<OfferSummary, "id" | "title"> & {
      profit?: Partial<OfferSummary["profit"]>;
    }
): OfferSummary {
  const { profit: profitPartial, ...rest } = partial;
  return {
    id: rest.id,
    bookmaker: rest.bookmaker ?? "Betfair Sportsbook",
    title: rest.title,
    description: null,
    expectedProfit: null,
    status: rest.status ?? "active",
    sport: rest.sport ?? "horse_racing",
    offerType: rest.offerType ?? "bet_get_free_place",
    rules: rest.rules ?? null,
    scopeCourse: rest.scopeCourse ?? "Newmarket",
    scopeRaceId: rest.scopeRaceId ?? null,
    scopeRaceLabel: rest.scopeRaceLabel ?? null,
    eventDate: rest.eventDate ?? null,
    expiresAt: null,
    completedAt: null,
    seriesId: null,
    instanceDate: null,
    startsOn: null,
    source: null,
    offerUrl: null,
    createdAt: Date.now(),
    betCount: rest.betCount ?? 0,
    openBets: 0,
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

const rules = JSON.stringify({
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [3, 4],
  betStake: 50,
  freeBetAmount: 50,
});

describe("deriveTrackBetAction", () => {
  it("enables footer mark-done for deposit playbook steps", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 90,
        title: "Bet £20 get £10 free bet (Football)",
        bookmaker: "Dynobet",
        sport: "football",
        offerType: "promo_terms",
        rules: JSON.stringify({
          type: "promo_terms",
          promoCode: "UEFA",
          minDeposit: 30,
          depositRequired: true,
          minStake: 20,
          minOdds: 1.5,
          playbook: {
            version: 1,
            steps: [
              {
                id: "deposit",
                kind: "deposit",
                title: "Deposit £30+ with code UEFA",
                detail: "Deposit into Dynobet.",
                sortOrder: 0,
                status: "pending",
                completion: null,
                completedAt: null,
              },
              {
                id: "qualify",
                kind: "qualify",
                title: "Place £20 qualifying bet",
                detail: "Cash bet.",
                sortOrder: 1,
                status: "pending",
                completion: null,
                completedAt: null,
              },
            ],
          },
        }),
      })
    );
    expect(action.enabled).toBe(true);
    expect(action.label).toBe("Mark deposit done");
    expect(action.destination).toEqual({
      kind: "playbook_mark_done",
      stepId: "deposit",
    });
    expect(action.prefill).toBeNull();
  });

  it("prefills qualifying stake and bookie for new campaigns", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 1,
        title: "Bet £50 get £50 free bet (3rd, 4th)",
        rules,
        betCount: 0,
      })
    );
    expect(action.enabled).toBe(true);
    expect(action.label).toBe("Place qualifying bet");
    expect(action.prefill?.betType).toBe("qualifying");
    expect(action.prefill?.backStake).toBe(50);
    expect(action.prefill?.bookmaker).toBe("Betfair Sportsbook");
    expect(action.prefill?.offerId).toBe(1);
    expect(action.prefill?.triggerText).toMatch(/Bet £50/);
  });

  it("prefills Offer trigger from title for General bet&get campaigns", () => {
    const general = offer({
      id: 10,
      title: "Bet £10 get £10 free bet",
      bookmaker: "Ivybet",
      sport: "general",
      offerType: "promo_terms",
      rules: JSON.stringify({
        type: "promo_terms",
        minOdds: 2,
        importantNotes: "SNR (stake not returned) · SNR free bet",
      }),
      betCount: 0,
      scopeCourse: null,
    });
    expect(qualifyingOfferTriggerText(general)).toBe("Bet £10 get £10 free bet");
    const action = deriveTrackBetAction(general);
    expect(action.enabled).toBe(true);
    expect(action.prefill?.betType).toBe("qualifying");
    expect(action.prefill?.offerId).toBe(10);
    expect(action.prefill?.bookmaker).toBe("Ivybet");
    expect(action.prefill?.triggerText).toBe("Bet £10 get £10 free bet");
  });

  it("prefills free bet conversion when awarded", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 2,
        title: "Bet £50 get £50 free bet",
        rules,
        betCount: 1,
        profit: {
          qualifyingSettledCount: 1,
          freeBetStage: "awarded",
          freeBetAwarded: true,
          freeBetAwardAmount: 50,
        },
      })
    );
    expect(action.enabled).toBe(true);
    expect(action.label).toBe("Convert free bet");
    expect(action.prefill?.betType).toBe("free_snr");
    expect(action.prefill?.backStake).toBe(50);
    expect(action.prefill?.triggerText).toBeUndefined();
  });

  it("disables when qualifying bet is still open and free bet not awarded", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 3,
        title: "In play",
        rules,
        betCount: 1,
        profit: { qualifyingOpenCount: 1, freeBetStage: "awaiting_result" },
      })
    );
    expect(action.enabled).toBe(false);
    expect(action.label).toBe("Awaiting result");
    expect(action.prefill).toBeNull();
  });

  it("enables convert when free bet is awarded on placement while qualifying is open", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 31,
        title: "Bet £10 get £10 free bet",
        rules: JSON.stringify({
          type: "promo_terms",
          minOdds: 2,
          importantNotes: "SNR free bet",
        }),
        betCount: 1,
        profit: {
          qualifyingOpenCount: 1,
          freeBetStage: "awarded",
          freeBetAwarded: true,
          freeBetAwardAmount: 10,
        },
      })
    );
    expect(action.enabled).toBe(true);
    expect(action.label).toBe("Convert free bet");
    expect(action.prefill?.betType).toBe("free_snr");
    expect(action.prefill?.backStake).toBe(10);
  });

  it("prefills raceExternalId for a race-scoped campaign", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 4,
        title: "Bet £10 get £10 free bet (2nd & 3rd)",
        rules,
        betCount: 0,
        scopeCourse: "Goodwood",
        scopeRaceId: "rac_32293062958",
        scopeRaceLabel: "1:50 · Highclere Castle Gin Summer Handicap Stakes",
        eventDate: "2026-08-01",
      })
    );
    expect(action.prefill?.raceExternalId).toBe("rac_32293062958");
    expect(action.prefill?.raceEventDate).toBe("2026-08-01");
    expect(action.prefill?.scopeCourse).toBe("Goodwood");
    expect(action.prefill?.labelSuggestion).toContain("Goodwood");
    expect(action.prefill?.labelSuggestion).toContain("1:50");
  });

  it("prefills scopeCourse for a course-scoped campaign (no race)", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 5,
        title: "Bet £50 get £50 free bet (3rd, 4th)",
        rules,
        betCount: 0,
        scopeCourse: "Goodwood",
        eventDate: "2026-08-01",
      })
    );
    expect(action.prefill?.scopeCourse).toBe("Goodwood");
    expect(action.prefill?.raceEventDate).toBe("2026-08-01");
    expect(action.prefill?.raceExternalId).toBeUndefined();
  });

  it("prefills horse racing + Galway course for an unconditional course-scoped bet&get", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 126,
        title: "Bet £5 get £5 free bet",
        bookmaker: "Ladbrokes",
        rules: JSON.stringify({
          type: "bet_get_free_place",
          minRunners: 8,
          regions: ["GB", "IRE"],
          qualifyingPlaces: [],
          betStake: 5,
          freeBetAmount: 5,
        }),
        betCount: 0,
        scopeCourse: "Galway",
        eventDate: "2026-08-02",
      })
    );
    expect(action.prefill?.sport).toBe("horse_racing");
    expect(action.prefill?.market).toBe("win");
    expect(action.prefill?.scopeCourse).toBe("Galway");
    expect(action.prefill?.raceEventDate).toBe("2026-08-02");
    expect(action.prefill?.bookmaker).toBe("Ladbrokes");
  });

  it("does not prefill scopeCourse for regional UK & IRE scope", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 6,
        title: "Bet £50 get £50 free bet",
        rules,
        betCount: 0,
        scopeCourse: "uk_ire",
        eventDate: "2026-08-01",
      })
    );
    expect(action.prefill?.scopeCourse).toBeUndefined();
  });

  it("routes Acca-scoped qualifying offers to Acca Desk when entitled", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 20,
        title: "Bet £20 ACCA get £10 free bet",
        bookmaker: "Ivybet",
        sport: "general",
        offerType: "promo_terms",
        scopeCourse: null,
        rules: JSON.stringify({
          type: "promo_terms",
          minOdds: 2,
          minStake: 20,
          qualifierScope: "acca",
          minSelections: 3,
          importantNotes: "Must be next promo",
        }),
        betCount: 0,
      })
    );
    expect(action.enabled).toBe(true);
    expect(action.label).toBe("Build acca");
    expect(action.destination.kind).toBe("acca_desk");
    if (action.destination.kind !== "acca_desk") return;
    expect(action.destination.prefill.offerId).toBe(20);
    expect(action.destination.prefill.stake).toBe(20);
    expect(action.destination.prefill.bookmaker).toBe("Ivybet");
    expect(action.destination.prefill.minSelections).toBe(3);
    expect(action.destination.prefill.minOdds).toBe(2);
    // Orphan mark-placed still gets an Add-bet style stub prefill.
    expect(action.prefill?.offerId).toBe(20);
    expect(action.prefill?.betType).toBe("qualifying");
    expect(action.prefill?.backStake).toBe(20);
    expect(action.prefill?.bookmaker).toBe("Ivybet");
  });

  it("falls back to Add bet for Acca scope when Acca Desk is not entitled", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 21,
        title: "Bet £20 ACCA get £10 free bet",
        bookmaker: "Ivybet",
        sport: "general",
        offerType: "promo_terms",
        scopeCourse: null,
        rules: JSON.stringify({
          type: "promo_terms",
          qualifierScope: "acca",
          minSelections: 3,
        }),
        betCount: 0,
      }),
      { offerBetPrefs: {}, defaultBackStake: 10, planPreview: "free" }
    );
    expect(action.destination.kind).toBe("add_bet");
    expect(action.label).toBe("Place qualifying bet");
    expect(action.prefill?.betType).toBe("qualifying");
  });

  it("keeps free-bet convert on Add bet when only qualifier is Acca", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 22,
        title: "Bet £20 ACCA get £10 free bet",
        sport: "general",
        offerType: "promo_terms",
        scopeCourse: null,
        rules: JSON.stringify({
          type: "promo_terms",
          qualifierScope: "acca",
          minSelections: 3,
        }),
        betCount: 1,
        profit: {
          qualifyingSettledCount: 1,
          freeBetStage: "awarded",
          freeBetAwarded: true,
          freeBetAwardAmount: 10,
        },
      })
    );
    expect(action.destination.kind).toBe("add_bet");
    expect(action.label).toBe("Convert free bet");
    expect(action.prefill?.betType).toBe("free_snr");
  });

  it("routes reward Acca convert to Acca Desk as free_snr", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 24,
        title: "Bet £20 get £10 Acca free bet",
        bookmaker: "Ivybet",
        sport: "general",
        offerType: "promo_terms",
        scopeCourse: null,
        rules: JSON.stringify({
          type: "promo_terms",
          rewardScope: "acca",
          rewardMinSelections: 4,
        }),
        betCount: 1,
        profit: {
          qualifyingSettledCount: 1,
          freeBetStage: "awarded",
          freeBetAwarded: true,
          freeBetAwardAmount: 10,
        },
      })
    );
    expect(action.enabled).toBe(true);
    expect(action.label).toBe("Convert on Acca Desk");
    expect(action.destination.kind).toBe("acca_desk");
    if (action.destination.kind !== "acca_desk") return;
    expect(action.destination.prefill.purpose).toBe("convert");
    expect(action.destination.prefill.backBetType).toBe("free_snr");
    expect(action.destination.prefill.stake).toBe(10);
    expect(action.destination.prefill.minSelections).toBe(4);
  });

  it("routes bet_builder scope to Bet Builder Desk when entitled", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 23,
        title: "Build a bet get free bet",
        sport: "football",
        offerType: "promo_terms",
        scopeCourse: null,
        rules: JSON.stringify({
          type: "promo_terms",
          qualifierScope: "bet_builder",
          minSelections: 4,
        }),
        betCount: 0,
      })
    );
    expect(action.destination.kind).toBe("bet_builder_desk");
    expect(action.label).toBe("Build bet builder");
    if (action.destination.kind !== "bet_builder_desk") return;
    expect(action.destination.prefill.minSelections).toBe(4);
    expect(action.destination.prefill.suggestedMethod).toBe("combined");
  });

  it("falls back to Add bet for bet_builder when not entitled", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 23,
        title: "Build a bet get free bet",
        sport: "football",
        offerType: "promo_terms",
        scopeCourse: null,
        rules: JSON.stringify({
          type: "promo_terms",
          qualifierScope: "bet_builder",
          minSelections: 4,
        }),
        betCount: 0,
      }),
      { offerBetPrefs: {}, defaultBackStake: 10, planPreview: "free" }
    );
    expect(action.destination.kind).toBe("add_bet");
    if (action.destination.kind === "add_bet") {
      expect(action.destination.scopeHint).toBe("bet_builder");
    }
  });

  it("offers a chooser when Acca and Bet builder are both allowed", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 25,
        title: "FREE £5 BET - JUST BET £10 ON ACCAS OR BET BUILDERS",
        bookmaker: "Betfair",
        sport: "football",
        offerType: "promo_terms",
        scopeCourse: null,
        rules: JSON.stringify({
          type: "promo_terms",
          qualifierScopes: ["acca", "bet_builder"],
          minSelections: 3,
          minStake: 10,
        }),
        betCount: 0,
      })
    );
    expect(action.enabled).toBe(true);
    expect(action.label).toBe("Place qualifying bet");
    expect(action.destination.kind).toBe("choose");
    if (action.destination.kind !== "choose") return;
    expect(action.destination.options.map((o) => o.scope)).toEqual([
      "acca",
      "bet_builder",
    ]);
    expect(action.destination.options[0]?.destination.kind).toBe("acca_desk");
    expect(action.destination.options[1]?.destination.kind).toBe("bet_builder_desk");
    expect(action.prefill?.offerId).toBe(25);
    expect(action.prefill?.betType).toBe("qualifying");
    expect(action.prefill?.backStake).toBe(10);
    expect(action.prefill?.bookmaker).toBe("Betfair");
  });

  it("chooser convert path when reward allows Acca or Bet builder", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 26,
        title: "Weekly Acca/BB free bet",
        sport: "football",
        offerType: "promo_terms",
        scopeCourse: null,
        rules: JSON.stringify({
          type: "promo_terms",
          rewardScopes: ["acca", "bet_builder"],
          rewardMinSelections: 3,
        }),
        betCount: 1,
        profit: {
          qualifyingSettledCount: 1,
          freeBetStage: "awarded",
          freeBetAwarded: true,
          freeBetAwardAmount: 5,
        },
      })
    );
    expect(action.destination.kind).toBe("choose");
    if (action.destination.kind !== "choose") return;
    expect(action.destination.options).toHaveLength(2);
    expect(action.destination.options[0]?.destination.kind).toBe("acca_desk");
  });
});

describe("deriveFreeBetLotConvertAction", () => {
  it("opens Acca Desk when linked offer has reward Acca", () => {
    const action = deriveFreeBetLotConvertAction(
      { remaining: 10, accountName: "Ivybet" },
      offer({
        id: 30,
        title: "Promo",
        bookmaker: "Ivybet",
        sport: "general",
        offerType: "promo_terms",
        scopeCourse: null,
        rules: JSON.stringify({
          type: "promo_terms",
          rewardScope: "acca",
          rewardMinSelections: 3,
        }),
      })
    );
    expect(action.destination.kind).toBe("acca_desk");
    if (action.destination.kind !== "acca_desk") return;
    expect(action.destination.prefill.backBetType).toBe("free_snr");
    expect(action.destination.prefill.stake).toBe(10);
  });

  it("falls back to Add bet when lot is unlinked", () => {
    const action = deriveFreeBetLotConvertAction(
      { remaining: 15, accountName: "Sky Bet" },
      null
    );
    expect(action.destination.kind).toBe("add_bet");
    expect(action.prefill?.backStake).toBe(15);
  });
});
