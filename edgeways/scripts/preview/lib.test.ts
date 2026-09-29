import { describe, expect, it } from "vitest";
import {
  COMMENT_MARKER,
  LINEAR_HEADING,
  buildBaselineManifest,
  buildLinearComment,
  buildPrComment,
  formatRatio,
  isOwnLinearComment,
  keyedShots,
  parseArgs,
  pickPullRequest,
  planComparisons,
  shotFileName,
  summarise,
  summariseVisual,
  ticketFromBranch,
  type JourneyResult,
  type RunResult,
  type VisualReport,
} from "./lib";

function journey(over: Partial<JourneyResult> = {}): JourneyResult {
  return {
    id: "home",
    title: "Home",
    account: null,
    viewport: "desktop",
    ok: true,
    ms: 1000,
    errors: [],
    notes: [],
    warnings: [],
    shots: [{ file: "home-desktop-01-home.png", label: "home" }],
    ...over,
  };
}

function run(journeys: JourneyResult[]): RunResult {
  return {
    ok: journeys.every((j) => j.ok),
    baseUrl: "https://edgeways-abc.vercel.app",
    startedAt: "2026-09-29T08:00:00.000Z",
    finishedAt: "2026-09-29T08:01:00.000Z",
    journeys,
  };
}

const CTX = {
  imageUrl: (f: string) => `https://raw.example/runs/1-1/${f}`,
  sha: "5495546dc80037cc9562d477a8464183832dd56c",
  runUrl: "https://github.com/o/r/actions/runs/1",
  baseUrl: "https://edgeways-abc.vercel.app",
};

describe("parseArgs", () => {
  it("takes the URL from PREVIEW_URL and trims trailing slashes", () => {
    const args = parseArgs([], { PREVIEW_URL: "https://x.vercel.app//" });
    expect(args.baseUrl).toBe("https://x.vercel.app");
    expect(args.outDir).toBe("artifacts/preview-checks");
  });

  it("collects extra paths and rejects bad input", () => {
    const args = parseArgs(["--base-url", "https://x.dev", "--extra-path", "/nope"]);
    expect(args.extraPaths).toEqual(["/nope"]);
    expect(() => parseArgs([])).toThrow(/base-url/);
    expect(() => parseArgs(["--base-url", "https://x.dev", "--extra-path", "nope"])).toThrow();
    expect(() => parseArgs(["--base-url", "https://x.dev", "--timeout", "0"])).toThrow();
    expect(() => parseArgs(["--base-url", "not a url"])).toThrow();
  });
});

describe("ticketFromBranch", () => {
  it("finds the EDGE ticket in Cyrus and plain branch names", () => {
    expect(ticketFromBranch("cyrus/edge-226-preview-checks-journeys")).toBe("EDGE-226");
    expect(ticketFromBranch("EDGE-12")).toBe("EDGE-12");
    expect(ticketFromBranch("sam/fix-edge-7")).toBe("EDGE-7");
  });

  it("returns null when there is no ticket", () => {
    expect(ticketFromBranch("main")).toBeNull();
    expect(ticketFromBranch("hedge-12")).toBeNull();
    expect(ticketFromBranch(undefined)).toBeNull();
  });
});

describe("shotFileName", () => {
  it("is stable and file-safe", () => {
    expect(shotFileName("first-time", "mobile", 1, "18+ gate")).toBe(
      "first-time-mobile-01-18-gate.png",
    );
  });
});

describe("PR comment", () => {
  it("carries the marker, verdicts and every screenshot", () => {
    const body = buildPrComment(
      run([
        journey(),
        journey({
          id: "first-time",
          title: "First-time desk",
          account: "agent-new",
          viewport: "mobile",
          notes: ["Hosted desk not set up yet"],
          shots: [{ file: "first-time-mobile-01-setup-wizard.png", label: "setup wizard" }],
        }),
      ]),
      CTX,
    );
    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(body).toContain("Preview checks passed");
    expect(body).toContain("2 of 2 journeys passed");
    expect(body).toContain("`5495546`");
    expect(body).toContain("**Pass**, First-time desk (agent-new), mobile: Hosted desk not set up yet");
    expect(body).toContain(
      "![First-time desk, agent-new, setup wizard, mobile 390 × 844 at 2×](https://raw.example/runs/1-1/first-time-mobile-01-setup-wizard.png)",
    );
    expect(body).not.toContain("—");
  });

  it("shows failures with their first error and lists warnings", () => {
    const body = buildPrComment(
      run([
        journey({
          ok: false,
          errors: ["HTTP 404 for /definitely-missing"],
          warnings: ["console: boom"],
        }),
      ]),
      CTX,
    );
    expect(body).toContain("Preview checks failed");
    expect(body).toContain("**Fail**, Home, desktop: HTTP 404 for /definitely-missing");
    expect(body).toContain("warning: console: boom");
  });

  it("points at the artefact when images could not be published", () => {
    const body = buildPrComment(run([journey()]), { ...CTX, imageUrl: () => null });
    expect(body).not.toContain("![");
    expect(body).toContain("artefact");
  });

  it("reports a run that never started", () => {
    const result = { ...run([]), ok: false, error: "Could not launch Chromium" };
    expect(summarise(result)).toBe("Could not run: Could not launch Chromium");
    expect(buildPrComment(result, CTX)).toContain("Run error: Could not launch Chromium");
  });
});

describe("Linear comment", () => {
  it("starts with **Screenshots** and embeds images as markdown", () => {
    const body = buildLinearComment(run([journey()]), {
      ...CTX,
      imageUrl: (f) => `https://uploads.linear.app/${f}`,
      prUrl: "https://github.com/o/r/pull/9",
    });
    expect(body.startsWith(LINEAR_HEADING)).toBe(true);
    expect(body).toMatch(/!\[[^\]]+\]\(https:\/\/uploads\.linear\.app\/home-desktop-01-home\.png\)/);
    expect(body).toContain("[PR](https://github.com/o/r/pull/9)");
    expect(isOwnLinearComment(body)).toBe(true);
  });

  it("does not claim someone else's Screenshots comment", () => {
    expect(isOwnLinearComment("**Screenshots**\n\n![Journey 1](x)")).toBe(false);
  });
});

describe("visual baseline", () => {
  const home = journey({ shots: [{ file: "home-desktop-01-signed-out.png", label: "signed out" }] });
  const signIn = journey({
    id: "sign-in",
    title: "Sign-in page",
    ok: false,
    errors: ["boom"],
    shots: [{ file: "sign-in-desktop-01-signed-out.png", label: "signed out" }],
  });
  const manifest = buildBaselineManifest(run([home, signIn]), {
    sha: "b3a3f98849edf3ae9f3c56dab5b9a5225539f2a0",
    runUrl: "https://github.com/o/r/actions/runs/2",
    takenAt: "2026-09-29T09:00:00.000Z",
  });

  it("keys shots by journey, viewport and label, not index", () => {
    const keys = keyedShots([
      journey({
        id: "first-time",
        shots: [
          { file: "first-time-desktop-01-18-gate.png", label: "18+ gate" },
          { file: "first-time-desktop-02-desk.png", label: "desk" },
          { file: "first-time-desktop-03-desk.png", label: "desk" },
        ],
      }),
    ]).map((k) => k.key);
    expect(keys).toEqual(["first-time-desktop-18-gate", "first-time-desktop-desk", "first-time-desktop-desk-2"]);
  });

  it("only baselines journeys that passed", () => {
    expect(manifest.journeys).toEqual(["home-desktop"]);
    expect(manifest.shots.map((s) => s.key)).toEqual(["home-desktop-signed-out"]);
    expect(parseArgs(["--base-url", "https://x.dev", "--baseline"]).baseline).toBe(true);
    expect(parseArgs(["--base-url", "https://x.dev"]).baseline).toBe(false);
  });

  it("plans same, new, missing and unbaselined", () => {
    const plan = planComparisons(
      run([
        journey({
          shots: [
            { file: "home-desktop-01-signed-out.png", label: "signed out" },
            { file: "home-desktop-02-menu.png", label: "menu" },
          ],
        }),
        journey({ id: "customer", title: "Signed-in desk", account: "agent-customer", shots: [{ file: "c.png", label: "setup wizard" }] }),
      ]),
      { ...manifest, journeys: ["home-desktop"], shots: [...manifest.shots, { ...manifest.shots[0], key: "home-desktop-gone", label: "gone" }] },
    );
    expect(plan.map((p) => [p.key, p.status])).toEqual([
      ["home-desktop-signed-out", "same"],
      ["home-desktop-menu", "new"],
      ["customer-desktop-setup-wizard", "unbaselined"],
      ["home-desktop-gone", "missing"],
    ]);
    expect(plan[0].baselineFile).toBe("home-desktop-01-signed-out.png");
  });

  it("does not call a baseline shot missing when its journey did not run", () => {
    expect(planComparisons(run([]), manifest)).toEqual([]);
  });
});

describe("visual section in the comments", () => {
  const baseline = { sha: "b3a3f98849edf3ae9f3c56dab5b9a5225539f2a0", baseUrl: "https://edgeways.app", takenAt: "t" };
  const item = {
    key: "home-desktop-signed-out",
    journeyId: "home",
    title: "Home",
    account: null,
    viewport: "desktop" as const,
    label: "signed out",
    file: "home-desktop-01-signed-out.png",
    baselineFile: "home-desktop-01-signed-out.png",
  };
  const report = (items: VisualReport["items"], over: Partial<VisualReport> = {}): VisualReport => ({
    baseline,
    pixelThreshold: 0.1,
    changedRatio: 0.001,
    items,
    ...over,
  });

  it("says so when nothing changed", () => {
    const body = buildPrComment(run([journey()]), {
      ...CTX,
      visual: report([
        { ...item, status: "same", ratio: 0 },
        { ...item, key: "c", title: "Signed-in desk", status: "unbaselined" },
      ]),
    });
    expect(body).toContain("#### Visual changes");
    expect(body).toContain("No visual changes against main (`b3a3f98`, production), 1 screenshots compared.");
    expect(body).toContain("Not compared: 1 signed-in screenshots");
  });

  it("lists changes with their side by side, on GitHub and Linear", () => {
    const visual = report([
      { ...item, status: "changed", ratio: 0.0423, diffFile: "diff-home-desktop-signed-out.png" },
      { ...item, key: "x", label: "menu", status: "new" },
    ]);
    const pr = buildPrComment(run([journey()]), { ...CTX, visual });
    expect(pr).toContain("Check these: 2 screenshots differ from main (`b3a3f98`, production), 1 compared.");
    expect(pr).toContain("- Home, signed out, desktop: 4.2% of pixels differ");
    expect(pr).toContain("- Home, menu, desktop: new screenshot, main has none");
    expect(pr).toContain(
      "![Home, signed out, desktop: main, this branch, difference](https://raw.example/runs/1-1/diff-home-desktop-signed-out.png)",
    );
    expect(pr).toContain("does not fail the check");
    expect(pr).not.toContain("—");

    const linear = buildLinearComment(run([journey()]), {
      ...CTX,
      imageUrl: (f) => `https://uploads.linear.app/${f}`,
      prUrl: null,
      visual,
    });
    expect(linear.startsWith(LINEAR_HEADING)).toBe(true);
    expect(linear).toContain("**Visual changes**");
    expect(linear).toContain("Check these: 2 screenshots differ");
    expect(linear).toContain("(https://uploads.linear.app/diff-home-desktop-signed-out.png)");
    expect(isOwnLinearComment(linear)).toBe(true);
  });

  it("explains a missing baseline or a failed comparison, and is quiet without a report", () => {
    expect(buildPrComment(run([journey()]), { ...CTX, visual: report([], { baseline: null }) })).toContain(
      "No baseline from main yet",
    );
    expect(buildPrComment(run([journey()]), { ...CTX, visual: report([], { error: "Bad PNG" }) })).toContain(
      "Visual comparison did not run: Bad PNG",
    );
    expect(buildPrComment(run([journey()]), CTX)).not.toContain("Visual changes");
    expect(summariseVisual(report([{ ...item, status: "missing" }]))).toBe("1 visual change to check");
  });

  it("formats small ratios readably", () => {
    expect(formatRatio(0.00005)).toBe("under 0.01%");
    expect(formatRatio(0.0012)).toBe("0.12%");
    expect(formatRatio(0.2)).toBe("20.0%");
  });
});

describe("pickPullRequest", () => {
  const pr = (number: number, state: string, sha: string) => ({ number, state, head: { sha } });

  it("prefers the open PR whose head is the commit", () => {
    expect(pickPullRequest([pr(1, "open", "old"), pr(2, "open", "abc")], "abc")?.number).toBe(2);
    expect(pickPullRequest([pr(1, "closed", "abc"), pr(3, "open", "x")], "abc")?.number).toBe(3);
    expect(pickPullRequest([pr(1, "closed", "abc")], "abc")).toBeNull();
  });
});
