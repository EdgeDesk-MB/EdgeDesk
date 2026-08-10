import { describe, expect, it } from "vitest";
import { openBetCoversRacingEvent } from "./race-open-bet-coverage";

const event = {
  id: 7,
  sport: "horse_racing" as const,
  externalId: "rac_123",
  competition: "Thirsk",
  startTime: Date.parse("2026-08-07T13:40:00.000Z"),
};

const offer = {
  sport: "horse_racing" as const,
  status: "active" as const,
  eventDate: "2026-08-07",
  scopeCourse: "Thirsk",
  scopeRaceId: "rac_123",
  scopeRaceLabel: "Thirsk · 14:40",
  bookmaker: "Bet365",
  offerType: "bet_get_free_place",
  rules: JSON.stringify({
    type: "bet_get_free_place",
    minRunners: 8,
    regions: ["GB"],
    qualifyingPlaces: [2, 3, 4],
    betStake: 10,
    freeBetAmount: 10,
  }),
};

describe("openBetCoversRacingEvent", () => {
  it("matches by event id", () => {
    expect(
      openBetCoversRacingEvent(
        { status: "open", eventId: 7, offerId: 1, bookmaker: "Bet365" },
        event,
        offer
      )
    ).toBe(true);
  });

  it("matches scoped offer bets before eventId is linked", () => {
    expect(
      openBetCoversRacingEvent(
        { status: "open", eventId: null, offerId: 1, bookmaker: "Bet365" },
        event,
        offer
      )
    ).toBe(true);
  });

  it("ignores bets linked to another event", () => {
    expect(
      openBetCoversRacingEvent(
        { status: "open", eventId: 99, offerId: 1, bookmaker: "Bet365" },
        event,
        offer
      )
    ).toBe(false);
  });

  it("ignores settled bets", () => {
    expect(
      openBetCoversRacingEvent(
        { status: "won", eventId: null, offerId: 1, bookmaker: "Bet365" },
        event,
        offer
      )
    ).toBe(false);
  });
});
