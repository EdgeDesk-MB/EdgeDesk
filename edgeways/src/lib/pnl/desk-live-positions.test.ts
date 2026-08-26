import { describe, expect, it } from "vitest";
import {
  accaDeskLivePosition,
  betBuilderDeskLivePosition,
  buildDeskLivePositions,
  deskNotesForEvent,
} from "./desk-live-positions";
import type { DeskLiveAcca, DeskLiveBetBuilder, DeskLiveEvent } from "./desk-live-positions";

const now = Date.parse("2026-08-22T15:20:00Z");

function race(id: number, startTime: number, status: DeskLiveEvent["status"] = "upcoming"): DeskLiveEvent {
  return {
    id,
    sport: "horse_racing",
    status,
    startTime,
    homeTeam: "York",
    awayTeam: "",
    goals: JSON.stringify({ runners: Array.from({ length: 20 }, (_, i) => ({ horse: `R${i}` })) }),
  };
}

function yorkDouble(over: Partial<DeskLiveAcca> = {}): DeskLiveAcca {
  return {
    id: 7,
    label: "Bet £10 get £10 free bet",
    status: "active",
    method: "sequential",
    offerId: 42,
    stake: 10,
    commission: 0,
    wholeLayStake: null,
    wholeLayOdds: null,
    backBetId: 88,
    backBetType: "qualifying",
    legs: [
      {
        seq: 1,
        label: "Notable Speech",
        result: "pending",
        layStake: 10,
        layOdds: 3.7,
        backOdds: 3.5,
        eventId: 1,
        scheduledAt: now - 20 * 60_000,
      },
      {
        seq: 2,
        label: "Dance In The Storm",
        result: "pending",
        layStake: null,
        layOdds: null,
        backOdds: 3.25,
        eventId: 2,
        scheduledAt: now + 50 * 60_000,
      },
    ],
    ...over,
  };
}

describe("accaDeskLivePosition", () => {
  it("shows an off first leg as a live acca row, not a lay-now action", () => {
    const events = new Map<number, DeskLiveEvent>([
      [1, race(1, now - 20 * 60_000)],
      [2, race(2, now + 50 * 60_000)],
    ]);
    const row = accaDeskLivePosition(yorkDouble(), events, now);
    expect(row).not.toBeNull();
    expect(row?.kind).toBe("acca");
    expect(row?.href).toBe("/acca");
    expect(row?.betId).toBe(88);
    expect(row?.eventId).toBe(1);
    expect(row?.label).toBe("Acca · Bet £10 get £10 free bet");
    expect(row?.triggerNote).toBeNull();
    expect(row?.provisional).toBeCloseTo(0, 10);
    expect(row?.eventName).toContain("1/2 laid");
  });

  it("after the first wins, a live second leg asks to lay it", () => {
    const events = new Map<number, DeskLiveEvent>([
      [1, { ...race(1, now - 80 * 60_000), status: "finished" }],
      [2, race(2, now - 5 * 60_000)],
    ]);
    const row = accaDeskLivePosition(
      yorkDouble({
        legs: [
          {
            seq: 1,
            label: "Notable Speech",
            result: "won",
            layStake: 10,
            layOdds: 3.7,
            backOdds: 3.5,
            eventId: 1,
            scheduledAt: now - 80 * 60_000,
          },
          {
            seq: 2,
            label: "Dance In The Storm",
            result: "pending",
            layStake: null,
            layOdds: null,
            backOdds: 3.25,
            eventId: 2,
            scheduledAt: now - 5 * 60_000,
          },
        ],
      }),
      events,
      now
    );
    expect(row?.eventId).toBe(2);
    expect(row?.triggerNote).toBe("Lay 2nd leg");
    expect(row?.provisional).toBeNull();
    expect(deskNotesForEvent([row!], 2)).toEqual([
      { text: "Acca · Lay 2nd leg", needsAction: true, href: "/acca" },
    ]);
  });

  it("skips a run whose current pending leg has not started", () => {
    const events = new Map<number, DeskLiveEvent>([[2, race(2, now + 50 * 60_000)]]);
    const row = accaDeskLivePosition(
      yorkDouble({
        legs: [
          {
            seq: 1,
            label: "Notable Speech",
            result: "won",
            layStake: 10,
            layOdds: 3.7,
            backOdds: 3.5,
            eventId: 1,
            scheduledAt: now - 80 * 60_000,
          },
          {
            seq: 2,
            label: "Dance In The Storm",
            result: "pending",
            layStake: null,
            layOdds: null,
            backOdds: 3.25,
            eventId: 2,
            scheduledAt: now + 50 * 60_000,
          },
        ],
      }),
      events,
      now
    );
    expect(row).toBeNull();
  });
});

describe("betBuilderDeskLivePosition", () => {
  it("shows an unlaid live builder as a lay action", () => {
    const events = new Map<number, DeskLiveEvent>([[9, race(9, now - 10 * 60_000)]]);
    const run: DeskLiveBetBuilder = {
      id: 3,
      label: "Arsenal win + BTTS",
      status: "active",
      method: "combined",
      offerId: 11,
      wholeLayStake: null,
      backBetId: 44,
      eventId: 9,
      scheduledAt: now - 10 * 60_000,
      selectionCount: 2,
    };
    const row = betBuilderDeskLivePosition(run, events, now);
    expect(row?.kind).toBe("bet_builder");
    expect(row?.href).toBe("/bet-builder");
    expect(row?.triggerNote).toBe("Lay the bet builder");
    expect(row?.provisional).toBeNull();
  });
});

describe("deskNotesForEvent / buildDeskLivePositions", () => {
  it("indexes acca notes onto the live event for the Events tab", () => {
    const events = new Map<number, DeskLiveEvent>([[1, race(1, now - 20 * 60_000)]]);
    const positions = buildDeskLivePositions({
      now,
      eventsById: events,
      acca: [yorkDouble()],
    });
    expect(deskNotesForEvent(positions, 1)).toEqual([
      { text: "Acca · In play", needsAction: false, href: "/acca" },
    ]);
    expect(deskNotesForEvent(positions, 99)).toEqual([]);
  });
});
