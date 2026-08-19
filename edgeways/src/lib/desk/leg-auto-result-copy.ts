/**
 * Acca / desk copy for a linked-event auto-result. The engine lives in
 * `leg-auto-result.ts`; this only decides what to tell the user.
 */

export type DeskAutoResultTone = "armed" | "waiting" | "live" | "due";

export type DeskAutoResultNote = {
  tone: DeskAutoResultTone;
  title: string;
  detail: string;
};

export type DeskAutoResultInput = {
  linked: boolean;
  result: "pending" | "won" | "lost" | "void" | "placed";
  /** Sequential lock already busted: later pending legs are not awaited. */
  moot: boolean;
  /** Lay, no-lay, or whole-combo cover already logged. */
  actionDone: boolean;
  /** Earliest unfinished leg, or every pending leg on a whole-combo run. */
  isCurrent: boolean;
  eventStatus?: string | null;
  sport?: string | null;
};

function isRacingSport(sport: string | null | undefined): boolean {
  return sport === "horse_racing" || sport === "greyhounds";
}

function settleSource(sport: string | null | undefined): string {
  if (isRacingSport(sport)) return "Settles from the race result.";
  if (sport === "football") return "Settles from the football score.";
  return "Settles from the tracked event.";
}

function awaitingSource(sport: string | null | undefined): string {
  if (isRacingSport(sport)) return "Awaiting the race result.";
  if (sport === "football") return "Awaiting the football score.";
  return "Awaiting the event result.";
}

/** Status row for a linked pending leg, or null when there is nothing to say. */
export function deskLegAutoResultNote(
  input: DeskAutoResultInput
): DeskAutoResultNote | null {
  if (!input.linked || input.result !== "pending" || input.moot) return null;

  const source = settleSource(input.sport);
  const awaiting = awaitingSource(input.sport);

  if (input.actionDone && input.isCurrent) {
    if (input.eventStatus === "finished") {
      return {
        tone: "due",
        title: "Result due",
        detail: "The desk will settle this shortly.",
      };
    }
    if (input.eventStatus === "live") {
      return {
        tone: "live",
        title: isRacingSport(input.sport) ? "Off" : "In play",
        detail: awaiting,
      };
    }
    return { tone: "waiting", title: "Awaiting result", detail: source };
  }

  return { tone: "armed", title: "Will auto-result", detail: source };
}
