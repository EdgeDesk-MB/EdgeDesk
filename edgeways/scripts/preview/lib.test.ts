import { describe, expect, it } from "vitest";
import {
  COMMENT_MARKER,
  LINEAR_HEADING,
  buildLinearComment,
  buildPrComment,
  isOwnLinearComment,
  parseArgs,
  pickPullRequest,
  shotFileName,
  summarise,
  ticketFromBranch,
  type JourneyResult,
  type RunResult,
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

describe("pickPullRequest", () => {
  const pr = (number: number, state: string, sha: string) => ({ number, state, head: { sha } });

  it("prefers the open PR whose head is the commit", () => {
    expect(pickPullRequest([pr(1, "open", "old"), pr(2, "open", "abc")], "abc")?.number).toBe(2);
    expect(pickPullRequest([pr(1, "closed", "abc"), pr(3, "open", "x")], "abc")?.number).toBe(3);
    expect(pickPullRequest([pr(1, "closed", "abc")], "abc")).toBeNull();
  });
});
