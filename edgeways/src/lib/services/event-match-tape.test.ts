import { describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/db/schema";
import { hydrateMatchTapeOnEvent } from "@/lib/services/event-match-tape";
import type { MatchTapeEvent } from "@/lib/events/match-tape";

const NOW = 1_800_000_000_000;

function event(partial: Partial<EventRow> = {}): EventRow {
  return {
    id: 41,
    sport: "football",
    externalId: "lin-sot",
    competition: "Championship",
    homeTeam: "Lincoln",
    awayTeam: "Southampton",
    startTime: NOW - 24 * 60 * 60 * 1000,
    status: "finished",
    homeScore: 1,
    awayScore: 1,
    minute: 90,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: null,
    ftHomeScore: 1,
    ftAwayScore: 1,
    matchEnding: "ft",
    period: "FT",
    htHomeScore: 0,
    htAwayScore: 1,
    lineups: null,
    tapeFetchedAt: null,
    simScript: null,
    simStartedAt: null,
    createdAt: NOW - 26 * 60 * 60 * 1000,
    ...partial,
  };
}

const tape: MatchTapeEvent[] = [
  { kind: "goal", minute: 12, side: "away", player: "Armstrong" },
  { kind: "goal", minute: 71, side: "home", player: "Hackett" },
];

describe("hydrateMatchTapeOnEvent", () => {
  it("returns the stored row when a tape is already present", async () => {
    const fetchTape = vi.fn();
    const persist = vi.fn();
    const existing = event({
      goals: JSON.stringify(tape),
    });
    const result = await hydrateMatchTapeOnEvent(existing, persist, { fetchTape });
    expect(result.fetched).toBe(false);
    expect(result.event).toBe(existing);
    expect(fetchTape).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("fetches once and writes through when the tape is empty", async () => {
    const fetchTape = vi.fn(async () => tape);
    const persist = vi.fn(async (patch: { goals: string; tapeFetchedAt: number }) =>
      event({ goals: patch.goals, tapeFetchedAt: patch.tapeFetchedAt })
    );
    const result = await hydrateMatchTapeOnEvent(event(), persist, {
      fetchTape,
      now: () => NOW,
    });
    expect(result.fetched).toBe(true);
    expect(fetchTape).toHaveBeenCalledWith("lin-sot", "Lincoln");
    expect(persist).toHaveBeenCalledWith({
      goals: JSON.stringify(tape),
      tapeFetchedAt: NOW,
    });
    expect(JSON.parse(result.event.goals ?? "[]")).toHaveLength(2);
  });

  it("does not fetch for manual rows or other sports", async () => {
    const fetchTape = vi.fn();
    const persist = vi.fn();
    await hydrateMatchTapeOnEvent(event({ source: "manual" }), persist, { fetchTape });
    await hydrateMatchTapeOnEvent(event({ sport: "horse_racing" }), persist, {
      fetchTape,
    });
    expect(fetchTape).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("does not persist when the upstream fetch throws", async () => {
    const persist = vi.fn();
    await expect(
      hydrateMatchTapeOnEvent(event(), persist, {
        fetchTape: async () => {
          throw new Error("budget");
        },
      })
    ).rejects.toThrow("budget");
    expect(persist).not.toHaveBeenCalled();
  });
});
