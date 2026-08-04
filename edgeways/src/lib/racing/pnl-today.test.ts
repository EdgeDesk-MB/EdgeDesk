import { describe, expect, it } from "vitest";
import { racingPnlToday } from "./pnl-today";

const noon = new Date("2026-07-31T12:00:00").getTime();
const dayStart = new Date("2026-07-31T00:00:00").getTime();
const todayRace = dayStart + 14 * 60 * 60 * 1000; // 14:25-ish
const earlierRaceToday = dayStart + 13 * 60 * 60 * 1000;
const yesterdayRace = new Date("2026-07-29T20:00:00").getTime(); // Lady Milton

const events = [
  { id: 80, sport: "horse_racing", startTime: yesterdayRace },
  { id: 81, sport: "football", startTime: todayRace },
  { id: 82, sport: "horse_racing", startTime: todayRace },
  { id: 83, sport: "horse_racing", startTime: earlierRaceToday },
];

describe("racingPnlToday", () => {
  it("attributes by race day, not settle time: open free bet today, not yesterday's qualifier", () => {
    // Lady Milton (29 Jul) settled today at −£10 must not count.
    // Open free-bet conversion on today's Goodwood → worst-case +£36 (homepage prov).
    const total = racingPnlToday(
      [
        {
          actualProfit: -10,
          expectedProfit: -10,
          status: "lost",
          eventId: 80,
        },
        {
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
          actualProfit: 4.5,
          expectedProfit: 4.5,
          status: "won",
          eventId: 83,
        },
        {
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
          actualProfit: -25,
          expectedProfit: -25,
          status: "lost",
          eventId: 81,
        },
        {
          actualProfit: -10,
          expectedProfit: -10,
          status: "void",
          eventId: 82,
        },
        {
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
});

