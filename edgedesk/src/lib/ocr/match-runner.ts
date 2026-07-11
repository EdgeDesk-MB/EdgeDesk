/**
 * Match OCR-parsed horse names to racecard runners.
 */
import { horseNamesMatch } from "@/lib/racing";

export interface RunnerMatchResult {
  runner: string;
  confidence: "high" | "medium";
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function runnerScore(ocr: string, runner: string): number {
  const no = norm(ocr);
  const nr = norm(runner);
  if (!no || !nr) return 0;
  if (no === nr) return 100;
  // OCR often glues words: "dickothelegend" vs "dicko the legend"
  const noCompact = no.replace(/\s+/g, "");
  const nrCompact = nr.replace(/\s+/g, "");
  if (noCompact === nrCompact) return 95;
  if (nrCompact.includes(noCompact) || noCompact.includes(nrCompact)) {
    const ratio =
      Math.min(noCompact.length, nrCompact.length) /
      Math.max(noCompact.length, nrCompact.length);
    if (ratio >= 0.7) return 85;
  }
  if (horseNamesMatch(ocr, runner)) {
    if (nr.includes(no) || no.includes(nr)) return 80;
    return 60;
  }
  const oWords = no.split(" ").filter(Boolean);
  const rWords = nr.split(" ").filter(Boolean);
  const overlap = oWords.filter((w) => w.length >= 3 && rWords.some((rw) => rw.includes(w) || w.includes(rw)));
  return overlap.length >= 2 ? 45 : overlap.length === 1 ? 25 : 0;
}

export function matchOcrToRunner(
  selection: string | undefined,
  runners: string[]
): RunnerMatchResult | null {
  const raw = selection?.trim();
  if (!raw || runners.length === 0) return null;

  let best: string | null = null;
  let bestScore = 0;
  for (const runner of runners) {
    const score = runnerScore(raw, runner);
    if (score > bestScore) {
      bestScore = score;
      best = runner;
    }
  }

  if (!best || bestScore < 25) return null;
  return {
    runner: best,
    confidence: bestScore >= 60 ? "high" : "medium",
  };
}
