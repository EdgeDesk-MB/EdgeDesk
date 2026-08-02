import { describe, expect, it } from "vitest";
import { formatEventStatus, formatRacingEventStatus } from "./events";

const NOW = Date.parse("2026-08-01T14:00:00+01:00");

describe("formatRacingEventStatus", () => {
  it("shows Live once the off-time has passed, even if DB status is still upcoming", () => {
    expect(
      formatRacingEventStatus(
        {
          status: "upcoming",
          sport: "horse_racing",
          startTime: NOW - 10 * 60_000,
        },
        null,
        NOW
      )
    ).toBe("Live");
  });

  it("keeps Upcoming before the off", () => {
    expect(
      formatRacingEventStatus(
        {
          status: "upcoming",
          sport: "horse_racing",
          startTime: NOW + 30 * 60_000,
        },
        null,
        NOW
      )
    ).toBe("Upcoming");
  });

  it("shows result wording when finished", () => {
    expect(
      formatRacingEventStatus(
        { status: "finished", sport: "horse_racing", startTime: NOW - 60_000 },
        { winner: "Valedictory" },
        NOW
      )
    ).toBe("Won by Valedictory");
  });
});

describe("formatEventStatus", () => {
  it("uses the same Live label for racing in the tracker", () => {
    expect(
      formatEventStatus(
        {
          sport: "horse_racing",
          status: "upcoming",
          homeScore: 0,
          awayScore: 0,
          minute: 0,
          startTime: NOW - 5 * 60_000,
        },
        null,
        NOW
      )
    ).toBe("Live");
  });
});
