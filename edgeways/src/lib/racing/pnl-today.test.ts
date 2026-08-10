import { describe, expect, it } from "vitest";
import { racingPnlByRace, racingPnlToday } from "./pnl-today";

const noon = new Date("2026-07-31T12:00:00").getTime();
const dayStart = new Date("2026-07-31T00:00:00").getTime();
const todayRace = dayStart + 14 * 60 * 60 * 1000; // 14:25-ish
const earlierRaceToday = dayStart + 13 * 60 * 60 * 1000;
const yesterdayRace = new Date("2026-07-29T20:00:00").getTime(); // Lady Milton

const events = [
  { id: 80, sport: "horse_racing", startTime: yesterdayRace, competition: "Goodwood" },
  { id: 81, sport: "football", startTime: todayRace },
  {
    id: 82,
    sport: "horse_racing",
    startTime: todayRace,
    externalId: "race-82",
    competition: "Goodwood",
    homeTeam: "Class 2 Handicap",
    awayTeam: "14:25",
  },
  {
    id: 83,
    sport: "horse_racing",
    startTime: earlierRaceToday,
    externalId: "race-83",
    competition: "Goodwood",
    homeTeam: "Maiden",
    awayTeam: "13:00",
  },
];

describe("racingPnlToday", () => {
  it("attributes by race day, not settle time: open free bet today, not yesterday's qualifier", () => {
    // Lady Milton (29 Jul) settled today at −£10 must not count.
    // Open free-bet conversion on today's Goodwood → worst-case +£36 (homepage prov).
    const total = racingPnlToday(
      [
        {
          id: 1,
          actualProfit: -10,
          expectedProfit: -10,
          status: "lost",
          eventId: 80,
        },
        {
          id: 2,
          actualProfit: null,
          expectedProfit: 36,
          status: "open",
          eventId: 82,
        },
      ],
      events,
      noon
    );
    expect(total).toBe(36);
  });

  it("sums settled actualProfit for races that ran today", () => {
    const total = racingPnlToday(
      [
        {
          id: 1,
          actualProfit: 4.5,
          expectedProfit: 4.5,
          status: "won",
          eventId: 83,
        },
        {
          id: 2,
          actualProfit: null,
          expectedProfit: 36,
          status: "open",
          eventId: 82,
        },
      ],
      events,
      noon
    );
    expect(total).toBe(40.5);
  });

  it("ignores football and void, and bets without an event", () => {
    const total = racingPnlToday(
      [
        {
          id: 1,
          actualProfit: -25,
          expectedProfit: -25,
          status: "lost",
          eventId: 81,
        },
        {
          id: 2,
          actualProfit: -10,
          expectedProfit: -10,
          status: "void",
          eventId: 82,
        },
        {
          id: 3,
          actualProfit: 8,
          expectedProfit: 8,
          status: "won",
          eventId: null,
        },
      ],
      events,
      noon
    );
    expect(total).toBe(0);
  });

  it("does not count a race from another day even if settled today", () => {
    // Lady Milton: result entered 31 Jul, race was 29 Jul → not today's P&L.
    const total = racingPnlToday(
      [
        {
          id: 1,
          actualProfit: -10,
          expectedProfit: -10,
          status: "lost",
          eventId: 80,
        },
      ],
      events,
      noon
    );
    expect(total).toBe(0);
  });

  it("accepts a desk YYYY-MM-DD date key", () => {
    const total = racingPnlToday(
      [
        {
          id: 1,
          actualProfit: 4.5,
          expectedProfit: 4.5,
          status: "won",
          eventId: 83,
        },
      ],
      events,
      "2026-07-31"
    );
    expect(total).toBe(4.5);
  });
});

describe("racingPnlByRace", () => {
  it("builds per-race rows, per-bet cumulative tips, and prior-plateau markers", () => {
    const report = racingPnlByRace(
      [
        {
          id: 10,
          label: "Maiden win",
          actualProfit: 4.5,
          expectedProfit: 4.5,
          status: "won",
          eventId: 83,
        },
        {
          id: 11,
          label: "Open free bet",
          actualProfit: null,
          expectedProfit: -1.84,
          status: "open",
          eventId: 82,
        },
        {
          id: 12,
          label: "Class 2 win",
          actualProfit: 2,
          expectedProfit: 2,
          status: "won",
          eventId: 82,
        },
      ],
      events,
      noon
    );

    expect(report.total).toBe(4.66);
    expect(report.openCount).toBe(1);
    expect(report.settledCount).toBe(2);
    expect(report.rows).toHaveLength(2);

    expect(report.rows[0]).toMatchObject({
      eventId: 83,
      raceExternalId: "race-83",
      course: "Goodwood",
      raceName: "Maiden",
      offTime: "13:00",
      profit: 4.5,
      betCount: 1,
      openCount: 0,
      settledCount: 1,
    });
    expect(report.rows[1]).toMatchObject({
      eventId: 82,
      profit: 0.16,
      betCount: 2,
      openCount: 1,
      settledCount: 1,
    });

    // Origin + one tip per bet (same-race tips staggered by 1s).
    expect(report.cumulative[0]).toEqual({
      t: earlierRaceToday - 60 * 60 * 1000,
      value: 0,
    });
    expect(report.cumulative[1]).toEqual({ t: earlierRaceToday, value: 4.5 });
    expect(report.cumulative[2]).toEqual({ t: todayRace, value: 2.66 });
    expect(report.cumulative[3]).toEqual({ t: todayRace + 1000, value: 4.66 });

    // Home convention: marker on prior plateau, then chart tip moves.
    expect(report.markers).toHaveLength(3);
    expect(report.markers[0]).toMatchObject({
      id: 10,
      settledAtSec: earlierRaceToday / 1000 - 1,
      cumulativeValue: 0,
      betProfit: 4.5,
      tone: "win",
    });
    expect(report.markers[1]).toMatchObject({
      id: 11,
      settledAtSec: earlierRaceToday / 1000,
      cumulativeValue: 4.5,
      betProfit: -1.84,
      tone: "loss",
    });
    expect(report.markers[2]).toMatchObject({
      id: 12,
      settledAtSec: todayRace / 1000,
      cumulativeValue: 2.66,
      betProfit: 2,
      tone: "win",
    });
  });

  it("returns an empty report when there are no racing bets that day", () => {
    const report = racingPnlByRace([], events, noon);
    expect(report).toEqual({
      total: 0,
      openCount: 0,
      settledCount: 0,
      rows: [],
      cumulative: [],
      markers: [],
    });
  });
});
