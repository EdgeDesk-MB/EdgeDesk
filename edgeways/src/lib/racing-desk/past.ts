/** Shared past-race helpers (safe for client + server). */

export function isDeskRacePast(
  race: { status: string; startTime: number },
  now = Date.now()
): boolean {
  return race.status === "finished" || race.startTime < now;
}
