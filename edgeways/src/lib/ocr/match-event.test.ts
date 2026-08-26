import { describe, expect, it } from "vitest";
import { matchOcrRacingSlip } from "./match-event";

describe("matchOcrRacingSlip", () => {
  const york1525 = {
    sport: "horse_racing" as const,
    competition: "York",
    course: "York",
    startTime: new Date(2026, 7, 22, 15, 0).getTime(),
    offTime: "15:00",
    awayTeam: "15:00",
    status: "upcoming" as const,
  };
  const york1610 = {
    ...york1525,
    startTime: new Date(2026, 7, 22, 16, 10).getTime(),
    offTime: "16:10",
    awayTeam: "16:10",
  };
  const chester = {
    ...york1525,
    competition: "Chester",
    course: "Chester",
    startTime: new Date(2026, 7, 22, 15, 0).getTime(),
  };

  it("matches York 15:00, not the later York race", () => {
    const hit = matchOcrRacingSlip(
      { course: "York", eventTime: "15:00" },
      [chester, york1610, york1525]
    );
    expect(hit).toBe(york1525);
  });

  it("returns undefined when the time is missing", () => {
    expect(
      matchOcrRacingSlip({ course: "York" }, [york1525, york1610])
    ).toBeUndefined();
  });
});
