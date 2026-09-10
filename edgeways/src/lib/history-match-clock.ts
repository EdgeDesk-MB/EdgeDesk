/**
 * Match-clock helpers for the History / Live feed.
 * The posted result lives in `events/result-posted.ts`. This file only reads
 * the tape so in-play rows keep their kick minutes.
 */
import { parseMatchTape } from "@/lib/events/match-tape";

export function lastMatchTapeMinute(
  goalsJson: string | null | undefined
): number | null {
  const tape = parseMatchTape(goalsJson);
  if (tape.length === 0) return null;
  return Math.max(...tape.map((row) => row.minute));
}

export function regulationEndMinute(
  matchEnding: string | null | undefined
): number {
  if (matchEnding === "aet" || matchEnding === "pen") return 120;
  return 90;
}
