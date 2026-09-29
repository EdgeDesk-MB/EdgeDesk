/**
 * Pure helpers for the preview checks (EDGE-226): arguments, journey result
 * shapes, and the PR and Linear comment bodies. No network, no browser, so
 * everything here is unit-tested in lib.test.ts.
 */

export const COMMENT_MARKER = "<!-- preview-checks -->";
export const STATUS_CONTEXT = "Preview checks";
/** Linear comments must open with this, the Loop hub counts on it. */
export const LINEAR_HEADING = "**Screenshots**";
export const LINEAR_SIGNATURE = "Preview checks, automated";

export type ViewportName = "desktop" | "mobile";

export type Viewport = {
  name: ViewportName;
  width: number;
  height: number;
  scale: number;
  isMobile: boolean;
};

export const VIEWPORTS: Viewport[] = [
  { name: "desktop", width: 1280, height: 800, scale: 1, isMobile: false },
  { name: "mobile", width: 390, height: 844, scale: 2, isMobile: true },
];

export type Shot = { file: string; label: string };

export type JourneyResult = {
  id: string;
  title: string;
  account: string | null;
  viewport: ViewportName;
  ok: boolean;
  ms: number;
  errors: string[];
  notes: string[];
  warnings: string[];
  shots: Shot[];
};

export type RunResult = {
  ok: boolean;
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  journeys: JourneyResult[];
  error?: string;
};

export type Args = {
  baseUrl: string;
  outDir: string;
  timeoutMs: number;
  extraPaths: string[];
  /** Baseline run against main's production deploy: signed-out journeys only. */
  baseline: boolean;
};

export const DEFAULT_OUT_DIR = "artifacts/preview-checks";
export const DEFAULT_TIMEOUT_MS = 30_000;

export function parseArgs(argv: string[], env: Record<string, string | undefined> = {}): Args {
  let baseUrl = env.PREVIEW_URL ?? "";
  let outDir = DEFAULT_OUT_DIR;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  const extraPaths: string[] = [];
  let baseline = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (!v) throw new Error(`${arg} needs a value`);
      return v;
    };
    if (arg === "--base-url") baseUrl = next();
    else if (arg === "--out") outDir = next();
    else if (arg === "--timeout") timeoutMs = Number(next());
    else if (arg === "--extra-path") extraPaths.push(next());
    else if (arg === "--baseline") baseline = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!baseUrl) throw new Error("--base-url (or PREVIEW_URL) is required");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("--timeout must be a positive number of milliseconds");
  }
  for (const p of extraPaths) {
    if (!p.startsWith("/")) throw new Error(`--extra-path must start with /: ${p}`);
  }
  new URL(baseUrl);
  return { baseUrl: baseUrl.replace(/\/+$/, ""), outDir, timeoutMs, extraPaths, baseline };
}

/** `cyrus/edge-226-preview-checks` → `EDGE-226`. */
export function ticketFromBranch(branch: string | null | undefined): string | null {
  const m = branch?.match(/(?:^|[^a-z0-9])edge-(\d+)(?![0-9])/i);
  return m ? `EDGE-${m[1]}` : null;
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function shotFileName(
  journeyId: string,
  viewport: ViewportName,
  index: number,
  label: string,
): string {
  return `${journeyId}-${viewport}-${String(index).padStart(2, "0")}-${slug(label)}.png`;
}

export function viewportLabel(name: ViewportName): string {
  const vp = VIEWPORTS.find((v) => v.name === name);
  if (!vp) return name;
  return `${name} ${vp.width} × ${vp.height} at ${vp.scale}×`;
}

export function shotCaption(journey: JourneyResult, shot: Shot): string {
  const who = journey.account ? `, ${journey.account}` : "";
  return `${journey.title}${who}, ${shot.label}, ${viewportLabel(journey.viewport)}`;
}

export function summarise(result: Pick<RunResult, "journeys" | "error">): string {
  if (result.error && result.journeys.length === 0) return `Could not run: ${result.error}`;
  const passed = result.journeys.filter((j) => j.ok).length;
  return `${passed} of ${result.journeys.length} journeys passed`;
}

// ---------------------------------------------------------------------------
// Visual regression (EDGE-228). Screenshots are compared with a baseline
// taken from main's production deploy. A difference never fails the check.

/** YIQ colour distance per pixel, 0 to 1 (pixelmatch's scale and default). */
export const PIXEL_THRESHOLD = 0.1;
/** A screenshot is flagged when more than this share of its pixels differ. */
export const CHANGED_RATIO = 0.001;

/** Playwright paints these over before every screenshot. Opt a time-based
 * element in with `data-visual-mask`. */
export const MASK_SELECTORS = [
  "[data-visual-mask]",
  "time",
  "canvas",
  "number-flow-react",
  "[data-sonner-toaster]",
];
export const MASK_COLOUR = "#FF00FF";

/** Applied only while a screenshot is taken. Previews use the development
 * Clerk instance, whose card footer adds a striped "Development mode" strip
 * that production (live Clerk) never shows; it makes the card taller, so it
 * cannot be masked. Structural selectors, Clerk's other class names are hashed. */
export const SCREENSHOT_STYLE =
  ".cl-footerItem > div > p, .cl-footerItem > div:has(+ div) { display: none !important; }";

export type BaselineShot = {
  key: string;
  file: string;
  journeyId: string;
  viewport: ViewportName;
  label: string;
};

/** baseline/baseline.json on the preview-checks-assets branch. */
export type BaselineManifest = {
  sha: string;
  baseUrl: string;
  takenAt: string;
  runUrl: string;
  /** Journey and viewport pairs (`home-desktop`) that passed, so were baselined. */
  journeys: string[];
  shots: BaselineShot[];
};

export type VisualStatus = "same" | "changed" | "new" | "missing" | "unbaselined";

export type VisualItem = {
  key: string;
  journeyId: string;
  title: string;
  account: string | null;
  viewport: ViewportName;
  label: string;
  status: VisualStatus;
  /** Share of pixels that differ, 0 to 1. Set for same and changed. */
  ratio?: number;
  /** This run's screenshot. */
  file?: string;
  baselineFile?: string;
  /** Side by side: main, this branch, difference. Set for changed. */
  diffFile?: string;
};

/** visual.json next to results.json. */
export type VisualReport = {
  baseline: Pick<BaselineManifest, "sha" | "baseUrl" | "takenAt"> | null;
  error?: string;
  pixelThreshold: number;
  changedRatio: number;
  items: VisualItem[];
};

function journeyKey(journeyId: string, viewport: ViewportName): string {
  return `${journeyId}-${viewport}`;
}

type KeyedShot = { key: string; journey: JourneyResult; shot: Shot };

/** Stable identity for a screenshot across runs: journey, viewport and label,
 * not the index, so an extra 18+ gate shot does not shift every later one. */
export function keyedShots(journeys: JourneyResult[]): KeyedShot[] {
  const out: KeyedShot[] = [];
  for (const journey of journeys) {
    const seen = new Map<string, number>();
    for (const shot of journey.shots) {
      const base = `${journeyKey(journey.id, journey.viewport)}-${slug(shot.label) || "shot"}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      out.push({ key: n === 1 ? base : `${base}-${n}`, journey, shot });
    }
  }
  return out;
}

/** Baseline from a run: only journeys that passed, so a "failed here" shot
 * never becomes the thing previews are held to. */
export function buildBaselineManifest(
  result: RunResult,
  meta: { sha: string; runUrl: string; takenAt: string },
): BaselineManifest {
  const passed = result.journeys.filter((j) => j.ok);
  return {
    sha: meta.sha,
    baseUrl: result.baseUrl,
    takenAt: meta.takenAt,
    runUrl: meta.runUrl,
    journeys: passed.map((j) => journeyKey(j.id, j.viewport)),
    shots: keyedShots(passed).map(({ key, journey, shot }) => ({
      key,
      file: shot.file,
      journeyId: journey.id,
      viewport: journey.viewport,
      label: shot.label,
    })),
  };
}

export type PlannedComparison = Omit<VisualItem, "ratio" | "diffFile">;

/** Pairs this run's screenshots with the baseline's. Pixels are compared
 * later, for the `same` items; the rest are already decided. */
export function planComparisons(result: RunResult, baseline: BaselineManifest): PlannedComparison[] {
  const byKey = new Map(baseline.shots.map((s) => [s.key, s]));
  const baselined = new Set(baseline.journeys);
  const plan: PlannedComparison[] = [];
  const matched = new Set<string>();
  for (const { key, journey, shot } of keyedShots(result.journeys)) {
    const base = byKey.get(key);
    const item = {
      key,
      journeyId: journey.id,
      title: journey.title,
      account: journey.account,
      viewport: journey.viewport,
      label: shot.label,
      file: shot.file,
    };
    if (base) {
      matched.add(key);
      plan.push({ ...item, status: "same", baselineFile: base.file });
    } else {
      const known = baselined.has(journeyKey(journey.id, journey.viewport));
      plan.push({ ...item, status: known ? "new" : "unbaselined" });
    }
  }
  const ran = new Set(result.journeys.map((j) => journeyKey(j.id, j.viewport)));
  for (const s of baseline.shots) {
    if (matched.has(s.key) || !ran.has(journeyKey(s.journeyId, s.viewport))) continue;
    const journey = result.journeys.find((j) => j.id === s.journeyId && j.viewport === s.viewport);
    plan.push({
      key: s.key,
      journeyId: s.journeyId,
      title: journey?.title ?? s.journeyId,
      account: journey?.account ?? null,
      viewport: s.viewport,
      label: s.label,
      status: "missing",
      baselineFile: s.file,
    });
  }
  return plan;
}

export function isFlagged(item: VisualItem): boolean {
  return item.status === "changed" || item.status === "new" || item.status === "missing";
}

export function formatRatio(ratio: number): string {
  const pct = ratio * 100;
  if (pct > 0 && pct < 0.01) return "under 0.01%";
  return `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
}

export function summariseVisual(report: VisualReport | null | undefined): string | null {
  if (!report) return null;
  if (report.error) return "visual comparison did not run";
  if (!report.baseline) return "no visual baseline yet";
  const flagged = report.items.filter(isFlagged).length;
  if (flagged === 0) return "no visual changes";
  return `${flagged} visual ${flagged === 1 ? "change" : "changes"} to check`;
}

function visualLine(item: VisualItem): string {
  const who = item.account ? ` (${item.account})` : "";
  const what =
    item.status === "changed"
      ? `${formatRatio(item.ratio ?? 0)} of pixels differ`
      : item.status === "new"
        ? "new screenshot, main has none"
        : "on main, not reached on this branch";
  return `- ${item.title}${who}, ${item.label}, ${item.viewport}: ${what}`;
}

function visualSection(
  report: VisualReport | null | undefined,
  imageUrl: CommentContext["imageUrl"],
  opts: { heading: string; details: boolean },
): string[] {
  if (!report) return [];
  const lines = ["", opts.heading, ""];
  if (report.error) {
    lines.push(`Visual comparison did not run: ${oneLine(report.error)}`);
    return lines;
  }
  if (!report.baseline) {
    lines.push("No baseline from main yet. One is taken on main's next production deploy.");
    return lines;
  }
  const base = `main (\`${report.baseline.sha.slice(0, 7)}\`, production)`;
  const flagged = report.items.filter(isFlagged);
  const compared = report.items.filter((i) => i.status === "same" || i.status === "changed").length;
  if (flagged.length === 0) {
    lines.push(`No visual changes against ${base}, ${compared} screenshots compared.`);
  } else {
    const noun = flagged.length === 1 ? "screenshot differs" : "screenshots differ";
    lines.push(
      `Check these: ${flagged.length} ${noun} from ${base}, ${compared} compared. A difference does not fail the check.`,
      "",
      ...flagged.map(visualLine),
    );
    const images = flagged.flatMap((item) => {
      const url = item.diffFile ? imageUrl(item.diffFile) : null;
      if (!url) return [];
      const caption = `${item.title}, ${item.label}, ${item.viewport}: main, this branch, difference`;
      return [`![${caption.replace(/[[\]]/g, "")}](${url})`];
    });
    if (images.length > 0) {
      const body = images.flatMap((l) => [l, ""]);
      if (opts.details) {
        lines.push(
          "",
          "<details open><summary>Side by side: main, this branch, difference in red</summary>",
          "",
          ...body,
          "</details>",
        );
      } else {
        lines.push("", "Side by side: main, this branch, difference in red.", "", ...body);
      }
    }
  }
  const unbaselined = report.items.filter((i) => i.status === "unbaselined").length;
  if (unbaselined > 0) {
    lines.push(
      "",
      `Not compared: ${unbaselined} signed-in screenshots. Production uses the live sign-in, where the agent test accounts do not exist, so main has no baseline for them.`,
    );
  }
  return lines;
}

type CommentContext = {
  imageUrl: (file: string) => string | null;
  sha: string;
  runUrl: string;
  baseUrl: string;
  visual?: VisualReport | null;
};

function journeyLine(j: JourneyResult): string {
  const who = j.account ? ` (${j.account})` : "";
  const verdict = j.ok ? "Pass" : "Fail";
  const detail = j.ok ? j.notes.at(-1) : j.errors[0];
  const tail = detail ? `: ${oneLine(detail)}` : "";
  return `- **${verdict}**, ${j.title}${who}, ${j.viewport}${tail}`;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

function imageLines(result: RunResult, imageUrl: CommentContext["imageUrl"]): string[] {
  const lines: string[] = [];
  for (const j of result.journeys) {
    for (const shot of j.shots) {
      const url = imageUrl(shot.file);
      if (!url) continue;
      const caption = shotCaption(j, shot).replace(/[[\]]/g, "");
      lines.push(`![${caption}](${url})`);
    }
  }
  return lines;
}

function problemLines(result: RunResult): string[] {
  const lines: string[] = [];
  for (const j of result.journeys) {
    const all = [...j.errors.map((e) => `error: ${e}`), ...j.warnings.map((w) => `warning: ${w}`)];
    if (all.length === 0) continue;
    lines.push(`- ${j.title}, ${j.viewport}`);
    for (const e of all.slice(0, 6)) lines.push(`  - ${oneLine(e)}`);
  }
  return lines;
}

export function buildPrComment(result: RunResult, ctx: CommentContext): string {
  const verdict = result.ok ? "passed" : "failed";
  const lines = [
    COMMENT_MARKER,
    `### Preview checks ${verdict}`,
    "",
    `${summarise(result)} on ${ctx.baseUrl} for \`${ctx.sha.slice(0, 7)}\`. [Workflow run](${ctx.runUrl}).`,
  ];
  if (result.error) lines.push("", `Run error: ${oneLine(result.error)}`);
  if (result.journeys.length > 0) lines.push("", ...result.journeys.map(journeyLine));
  const problems = problemLines(result);
  if (problems.length > 0) {
    lines.push("", "<details><summary>Errors and warnings</summary>", "", ...problems, "", "</details>");
  }
  lines.push(...visualSection(ctx.visual, ctx.imageUrl, { heading: "#### Visual changes", details: true }));
  const images = imageLines(result, ctx.imageUrl);
  if (images.length > 0) {
    lines.push("", "<details open><summary>Screenshots</summary>", "", ...images.flatMap((l) => [l, ""]), "</details>");
  } else if (result.journeys.some((j) => j.shots.length > 0)) {
    lines.push("", "Screenshots are in the workflow run's artefact.");
  }
  lines.push("", "_Updated in place on every preview deployment._");
  return lines.join("\n");
}

export function buildLinearComment(
  result: RunResult,
  ctx: CommentContext & { prUrl: string | null },
): string {
  const where = ctx.prUrl ? `[PR](${ctx.prUrl}), ` : "";
  const lines = [
    LINEAR_HEADING,
    "",
    `${LINEAR_SIGNATURE}: ${summarise(result)} on ${ctx.baseUrl} for \`${ctx.sha.slice(0, 7)}\` (${where}[run](${ctx.runUrl})).`,
    "",
    ...result.journeys.map(journeyLine),
    ...visualSection(ctx.visual, ctx.imageUrl, { heading: "**Visual changes**", details: false }),
    "",
    ...imageLines(result, ctx.imageUrl).flatMap((l) => [l, ""]),
  ];
  return lines.join("\n").trimEnd();
}

/** The Linear comment this workflow owns on a ticket, if any. */
export function isOwnLinearComment(body: string): boolean {
  return body.startsWith(LINEAR_HEADING) && body.includes(LINEAR_SIGNATURE);
}

type PullLike = { number: number; state: string; head: { sha: string } };

/** Prefer the open PR whose head is this commit, then any open PR. */
export function pickPullRequest<T extends PullLike>(prs: T[], sha: string): T | null {
  const open = prs.filter((p) => p.state === "open");
  return open.find((p) => p.head.sha === sha) ?? open[0] ?? null;
}
