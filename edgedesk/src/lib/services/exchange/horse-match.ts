/** Shared horse-name normalisation for exchange market matching. */

export function normalizeHorseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`´]/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score how well two horse names match (0 = no match).
 * Prefer exact / near-exact; avoid short substring false positives (e.g. "I" in "Irish").
 */
export function horseNameMatchScore(a: string, b: string): number {
  const na = normalizeHorseName(a);
  const nb = normalizeHorseName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;

  // Prefix / contained only when the shorter name is substantial
  if (shorter.length >= 5 && longer.startsWith(shorter)) return 90;
  if (shorter.length >= 6 && longer.includes(shorter)) {
    // Require word-boundary-ish: start, end, or space-bounded
    const idx = longer.indexOf(shorter);
    const beforeOk = idx === 0 || longer[idx - 1] === " ";
    const afterOk =
      idx + shorter.length === longer.length || longer[idx + shorter.length] === " ";
    if (beforeOk && afterOk) return 80;
  }

  const tokensA = na.split(" ").filter((t) => t.length > 1);
  const tokensB = nb.split(" ").filter((t) => t.length > 1);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const overlap = tokensA.filter((t) => setB.has(t)).length;
  const minLen = Math.min(tokensA.length, tokensB.length);
  if (overlap === minLen && minLen >= 2) return 70;
  if (overlap === minLen && minLen === 1 && tokensA[0]!.length >= 6) return 60;

  return 0;
}

export function horseNamesMatch(a: string, b: string): boolean {
  return horseNameMatchScore(a, b) >= 60;
}

/**
 * Greedy 1:1 assignment of exchange runner names → desk runners.
 * Prevents one Betfair selection claiming multiple horses via loose includes().
 */
export function matchHorsesByName<T extends { horseId: string; name: string }>(
  deskRunners: T[],
  exchangeNames: string[]
): Map<string, T> {
  type Pair = { exch: string; runner: T; score: number };
  const pairs: Pair[] = [];
  for (const exch of exchangeNames) {
    for (const runner of deskRunners) {
      const score = horseNameMatchScore(runner.name, exch);
      if (score >= 60) pairs.push({ exch, runner, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const usedExch = new Set<string>();
  const usedHorse = new Set<string>();
  const out = new Map<string, T>();

  for (const p of pairs) {
    if (usedExch.has(p.exch) || usedHorse.has(p.runner.horseId)) continue;
    usedExch.add(p.exch);
    usedHorse.add(p.runner.horseId);
    out.set(p.exch, p.runner);
  }
  return out;
}
