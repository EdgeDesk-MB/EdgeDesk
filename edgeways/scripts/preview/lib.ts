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
};

export const DEFAULT_OUT_DIR = "artifacts/preview-checks";
export const DEFAULT_TIMEOUT_MS = 30_000;

export function parseArgs(argv: string[], env: Record<string, string | undefined> = {}): Args {
  let baseUrl = env.PREVIEW_URL ?? "";
  let outDir = DEFAULT_OUT_DIR;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  const extraPaths: string[] = [];
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
  return { baseUrl: baseUrl.replace(/\/+$/, ""), outDir, timeoutMs, extraPaths };
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

type CommentContext = {
  imageUrl: (file: string) => string | null;
  sha: string;
  runUrl: string;
  baseUrl: string;
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
