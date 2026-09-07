import type { RaceResult, RaceRunnerResult } from "@/lib/racing";

export type RacingCardResult = {
  winner: string;
  runners: RaceRunnerResult[];
};

/** Attach today's result payload to a racecard without a second provider fetch. */
export function withRacingCardResult<T extends { externalId: string }>(
  card: T,
  result: RaceResult | undefined
): T & { winner?: string; status?: "finished"; result?: RacingCardResult } {
  if (!result?.winner) return card;
  return {
    ...card,
    status: "finished",
    winner: result.winner,
    result: {
      winner: result.winner,
      runners: result.runners,
    },
  };
}
