/**
 * Visual regression for the preview checks (EDGE-228). Runs after
 * journeys.ts, on its results.json.
 *
 *   npm run -s preview:visual -- manifest
 *     Baseline run: writes <out>/baseline/ (baseline.json and the PNGs of
 *     journeys that passed) for publish-assets.sh to store.
 *   npm run -s preview:visual -- compare --baseline-dir artifacts/baseline
 *     Preview run: compares every screenshot with the baseline, writes
 *     visual.json and a side by side diff-<key>.png per changed screenshot.
 *
 * Always exits 0 once results.json is readable: a difference, or a missing
 * baseline, is for Sam to judge and never fails the check.
 * Env: RESULTS_DIR, SHA, RUN_URL.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CHANGED_RATIO,
  DEFAULT_OUT_DIR,
  PIXEL_THRESHOLD,
  buildBaselineManifest,
  planComparisons,
  summariseVisual,
  type BaselineManifest,
  type RunResult,
  type VisualItem,
  type VisualReport,
} from "./lib";
import { decodePng, diffImages, encodePng, sideBySide } from "./png";

const GAP_PX = 16;

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function manifest(resultsDir: string) {
  const result = readJson<RunResult>(path.join(resultsDir, "results.json"));
  const out = path.join(resultsDir, "baseline");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const m = buildBaselineManifest(result, {
    sha: process.env.SHA ?? "",
    runUrl: process.env.RUN_URL ?? "",
    takenAt: new Date().toISOString(),
  });
  for (const s of m.shots) copyFileSync(path.join(resultsDir, s.file), path.join(out, s.file));
  writeFileSync(path.join(out, "baseline.json"), `${JSON.stringify(m, null, 2)}\n`);
  const skipped = result.journeys.filter((j) => !j.ok).map((j) => `${j.id}-${j.viewport}`);
  console.log(`Baseline: ${m.shots.length} screenshots from ${m.journeys.length} journeys`);
  if (skipped.length > 0) console.log(`::warning::Not baselined, journey failed: ${skipped.join(", ")}`);
}

function compareOne(
  item: ReturnType<typeof planComparisons>[number],
  resultsDir: string,
  baselineDir: string,
): VisualItem {
  if (item.status !== "same" || !item.file || !item.baselineFile) return item;
  const base = decodePng(readFileSync(path.join(baselineDir, item.baselineFile)));
  const next = decodePng(readFileSync(path.join(resultsDir, item.file)));
  const { ratio, diff } = diffImages(base, next, PIXEL_THRESHOLD);
  if (ratio <= CHANGED_RATIO) return { ...item, ratio };
  const diffFile = `diff-${item.key}.png`;
  writeFileSync(path.join(resultsDir, diffFile), encodePng(sideBySide([base, next, diff], GAP_PX)));
  return { ...item, status: "changed", ratio, diffFile };
}

function compare(resultsDir: string, baselineDir: string): VisualReport {
  const report: VisualReport = {
    baseline: null,
    pixelThreshold: PIXEL_THRESHOLD,
    changedRatio: CHANGED_RATIO,
    items: [],
  };
  const manifestFile = path.join(baselineDir, "baseline.json");
  if (!existsSync(manifestFile)) return report;
  const result = readJson<RunResult>(path.join(resultsDir, "results.json"));
  const m = readJson<BaselineManifest>(manifestFile);
  report.baseline = { sha: m.sha, baseUrl: m.baseUrl, takenAt: m.takenAt };
  for (const item of planComparisons(result, m)) {
    try {
      report.items.push(compareOne(item, resultsDir, baselineDir));
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      console.log(`::warning::Could not compare ${item.key}: ${why}`);
      report.items.push({ ...item, status: "new" });
    }
  }
  return report;
}

function main() {
  const [mode, ...rest] = process.argv.slice(2);
  const resultsDir = process.env.RESULTS_DIR || DEFAULT_OUT_DIR;
  if (mode === "manifest") return manifest(resultsDir);
  if (mode !== "compare") throw new Error("Usage: visual.ts manifest | compare --baseline-dir <dir>");
  const at = rest.indexOf("--baseline-dir");
  const baselineDir = at >= 0 ? rest[at + 1] : process.env.BASELINE_DIR;
  if (!baselineDir) throw new Error("--baseline-dir (or BASELINE_DIR) is required");

  let report: VisualReport;
  try {
    report = compare(resultsDir, baselineDir);
  } catch (err) {
    report = {
      baseline: null,
      error: err instanceof Error ? err.message.split("\n")[0] : String(err),
      pixelThreshold: PIXEL_THRESHOLD,
      changedRatio: CHANGED_RATIO,
      items: [],
    };
  }
  writeFileSync(path.join(resultsDir, "visual.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Visual: ${summariseVisual(report)}`);
  for (const i of report.items) {
    if (i.ratio !== undefined || i.status !== "same") {
      console.log(`  ${i.status.padEnd(11)} ${i.key}${i.ratio !== undefined ? ` ${(i.ratio * 100).toFixed(3)}%` : ""}`);
    }
  }
}

main();
