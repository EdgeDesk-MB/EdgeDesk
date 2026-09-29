/**
 * Preview checks (EDGE-226). Playwright journeys against a Vercel preview.
 * Usage: npm run -s preview:journeys -- --base-url https://<preview>.vercel.app
 *          [--out artifacts/preview-checks] [--timeout 30000] [--extra-path /x]
 *
 * Writes results.json and PNG screenshots to --out, prints the same JSON to
 * stdout, and exits 1 if any journey fails. See scripts/preview/README.md.
 *
 * Signed-in journeys use the dev Clerk test accounts (code 424242). On a
 * preview the desk is the hosted one and may be brand new, so a setup wizard
 * or 18+ gate is screenshotted and accepted, never treated as a failure.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { isAppPageError, isAppResponseFailure, isAppConsoleError } from "../smoke/noise";
import {
  VIEWPORTS,
  parseArgs,
  shotFileName,
  slug,
  type Args,
  type JourneyResult,
  type RunResult,
  type Viewport,
} from "./lib";

const MAIN_SELECTOR = "main, [role='main']";
const SETTLE_MS = 1_500;
const NETWORK_IDLE_CAP_MS = 6_000;
const MAX_WARNINGS = 10;

type PublicJourney = {
  kind: "public";
  id: string;
  title: string;
  path: string;
  ready: string;
};

type SignedInJourney = {
  kind: "signed-in";
  id: string;
  title: string;
  account: string;
  email: string;
  pages: { path: string; label: string }[];
};

type Journey = PublicJourney | SignedInJourney;

function journeys(args: Args, env: NodeJS.ProcessEnv): Journey[] {
  return [
    { kind: "public", id: "home", title: "Home", path: "/", ready: MAIN_SELECTOR },
    {
      kind: "public",
      id: "sign-in",
      title: "Sign-in page",
      path: "/login",
      ready: 'input[name="identifier"]',
    },
    ...args.extraPaths.map(
      (p): PublicJourney => ({
        kind: "public",
        id: `page-${slug(p) || "root"}`,
        title: `Page ${p}`,
        path: p,
        ready: MAIN_SELECTOR,
      }),
    ),
    {
      kind: "signed-in",
      id: "customer",
      title: "Signed-in desk",
      account: "agent-customer",
      email: env.AGENT_CUSTOMER_EMAIL || "agent-customer+clerk_test@example.com",
      pages: [
        { path: "/desk?live=1", label: "desk" },
        { path: "/offers", label: "offers" },
        { path: "/history", label: "history" },
        { path: "/settings", label: "settings" },
      ],
    },
    {
      kind: "signed-in",
      id: "first-time",
      title: "First-time desk",
      account: "agent-new",
      email: env.AGENT_NEW_EMAIL || "agent-new+clerk_test@example.com",
      pages: [{ path: "/desk?live=1", label: "desk" }],
    },
  ];
}

class Recorder {
  readonly result: JourneyResult;
  private readonly started = Date.now();

  constructor(
    journey: Journey,
    private readonly viewport: Viewport,
    private readonly outDir: string,
  ) {
    this.result = {
      id: journey.id,
      title: journey.title,
      account: journey.kind === "signed-in" ? journey.account : null,
      viewport: viewport.name,
      ok: false,
      ms: 0,
      errors: [],
      notes: [],
      warnings: [],
      shots: [],
    };
  }

  watch(page: Page, appOrigin: string) {
    page.on("pageerror", (err) => {
      if (isAppPageError(err.message, err.stack ?? "", appOrigin)) {
        this.result.errors.push(`uncaught: ${err.message}`);
      }
    });
    page.on("response", (res) => {
      const req = res.request();
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) return;
      if (isAppResponseFailure(res.url(), res.status(), appOrigin)) {
        this.result.errors.push(`response: HTTP ${res.status()} ${stripQuery(res.url())}`);
      }
    });
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      if (this.result.warnings.length >= MAX_WARNINGS) return;
      if (isAppConsoleError(msg.text(), msg.location().url, appOrigin)) {
        this.result.warnings.push(`console: ${msg.text().slice(0, 300)}`);
      }
    });
  }

  async shot(page: Page, label: string) {
    const file = shotFileName(
      this.result.id,
      this.viewport.name,
      this.result.shots.length + 1,
      label,
    );
    await page.screenshot({ path: path.join(this.outDir, file), fullPage: false });
    this.result.shots.push({ file, label });
  }

  finish(): JourneyResult {
    this.result.ms = Date.now() - this.started;
    this.result.ok = this.result.errors.length === 0;
    return this.result;
  }
}

/** Drops query strings, which can carry Clerk handshake tokens. */
function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

function firstLine(err: unknown): string {
  return err instanceof Error ? err.message.split("\n")[0] : String(err);
}

async function newContext(browser: Browser, vp: Viewport): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.scale,
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
  });
}

async function settle(page: Page, timeoutMs: number) {
  await page.waitForLoadState("load", { timeout: timeoutMs }).catch(() => {});
  // The onboarding provider can bounce to /setup after the first state load.
  // Desk polling can keep the network busy, hence the cap.
  await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_CAP_MS }).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  await page.waitForLoadState("load", { timeout: timeoutMs }).catch(() => {});
}

/**
 * Signed-in navigation. The app's own redirects (Clerk after sign-in,
 * onboarding to /setup) can abort a goto mid-flight, which is not a failure:
 * the redirect's navigation carries on and the page lands wherever the app
 * sent it.
 */
async function gotoSignedIn(
  page: Page,
  url: string,
  args: Args,
): Promise<{ status: number | null; redirected: boolean }> {
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: args.timeoutMs });
    return { status: res?.status() ?? null, redirected: false };
  } catch (err) {
    if (!/ERR_ABORTED|interrupted by another navigation/i.test(firstLine(err))) throw err;
    await page.waitForLoadState("domcontentloaded", { timeout: args.timeoutMs }).catch(() => {});
    return { status: null, redirected: true };
  } finally {
    await settle(page, args.timeoutMs);
  }
}

async function runPublic(
  page: Page,
  journey: PublicJourney,
  rec: Recorder,
  args: Args,
) {
  const res = await page.goto(`${args.baseUrl}${journey.path}`, {
    waitUntil: "domcontentloaded",
    timeout: args.timeoutMs,
  });
  const status = res?.status() ?? null;
  if (status !== 200) rec.result.errors.push(`HTTP ${status ?? "no response"} for ${journey.path}`);
  await page
    .locator(journey.ready)
    .first()
    .waitFor({ state: "visible", timeout: args.timeoutMs })
    .catch(() => rec.result.errors.push(`${journey.ready} not visible on ${journey.path}`));
  await settle(page, args.timeoutMs);
  await rec.shot(page, "signed out");
}

async function signIn(page: Page, email: string, code: string, rec: Recorder, args: Args) {
  await page.goto(`${args.baseUrl}/login`, {
    waitUntil: "domcontentloaded",
    timeout: args.timeoutMs,
  });
  const identifier = page.locator('input[name="identifier"]');
  await identifier.waitFor({ state: "visible", timeout: args.timeoutMs });
  await identifier.fill(email);
  // Typing the code before Clerk has sent one fails with "You need to send a
  // verification code before attempting to verify".
  const prepared = page.waitForResponse(
    (r) => /\/sign_ins\/[^/]+\/prepare_first_factor/.test(r.url()),
    { timeout: args.timeoutMs },
  );
  await page.getByRole("button", { name: /^continue$/i }).click();
  const prep = await prepared.catch(() => null);
  if (prep && !prep.ok()) throw new Error(`Clerk could not send a code (HTTP ${prep.status()})`);
  const otp = page.locator('input[autocomplete="one-time-code"]').first();
  await otp.waitFor({ state: "visible", timeout: args.timeoutMs });
  await otp.click();
  await page.keyboard.type(code);
  await page
    .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: args.timeoutMs })
    .catch(async () => {
      const alert = await page
        .locator(".cl-formFieldErrorText, [role='alert']")
        .first()
        .innerText({ timeout: 1_000 })
        .catch(() => "");
      throw new Error(`Sign-in did not leave /login${alert ? `: ${alert.trim()}` : ""}`);
    });
  rec.result.notes.push(`Signed in, landed on ${new URL(page.url()).pathname}`);
}

/** Closes first-run dialogs. Returns true when the page is the setup wizard. */
async function handleInterstitials(page: Page, rec: Recorder, args: Args): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    const ageGate = page.getByRole("dialog").filter({ hasText: "Over-18s only" });
    if (await ageGate.isVisible().catch(() => false)) {
      await rec.shot(page, "18+ gate");
      rec.result.notes.push("18+ gate shown and confirmed");
      await ageGate.getByRole("button", { name: /18 or over/i }).click();
      await settle(page, args.timeoutMs);
      continue;
    }
    const notNow = page.getByRole("dialog").getByRole("button", { name: /^not now$/i });
    if (await notNow.isVisible().catch(() => false)) {
      await notNow.click();
      rec.result.notes.push("Closed a dialog with Not now");
      await page.waitForTimeout(500);
      continue;
    }
    break;
  }
  return new URL(page.url()).pathname.startsWith("/setup");
}

async function runSignedIn(
  page: Page,
  journey: SignedInJourney,
  rec: Recorder,
  args: Args,
  code: string,
) {
  await signIn(page, journey.email, code, rec, args);
  await settle(page, args.timeoutMs);
  for (const target of journey.pages) {
    const { status, redirected } = await gotoSignedIn(page, `${args.baseUrl}${target.path}`, args);
    if (status !== null && status >= 400) {
      rec.result.errors.push(`HTTP ${status} for ${target.path}`);
    }
    const pathname = new URL(page.url()).pathname;
    if (redirected) {
      rec.result.notes.push(`${target.path} redirected while loading, landed on ${pathname}`);
    }
    if (pathname.startsWith("/login")) {
      throw new Error(`Signed out on ${target.path}, redirected to /login`);
    }
    if (await handleInterstitials(page, rec, args)) {
      await rec.shot(page, "setup wizard");
      rec.result.notes.push(
        `Hosted desk not set up yet, ${target.path} opened the setup wizard, stopped there`,
      );
      return;
    }
    await page
      .locator(MAIN_SELECTOR)
      .first()
      .waitFor({ state: "visible", timeout: args.timeoutMs })
      .catch(() => rec.result.errors.push(`Main landmark not visible on ${target.path}`));
    await rec.shot(page, target.label);
  }
  rec.result.notes.push(`Opened ${journey.pages.map((p) => p.label).join(", ")}`);
}

async function runJourney(
  browser: Browser,
  journey: Journey,
  vp: Viewport,
  args: Args,
  code: string,
): Promise<JourneyResult> {
  const rec = new Recorder(journey, vp, args.outDir);
  const context = await newContext(browser, vp);
  const page = await context.newPage();
  rec.watch(page, new URL(args.baseUrl).origin);
  try {
    if (journey.kind === "public") await runPublic(page, journey, rec, args);
    else await runSignedIn(page, journey, rec, args, code);
  } catch (err) {
    rec.result.errors.push(firstLine(err));
    await rec.shot(page, "failed here").catch(() => {});
  } finally {
    await context.close().catch(() => {});
  }
  return rec.finish();
}

function write(args: Args | null, result: RunResult) {
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (args) {
    mkdirSync(args.outDir, { recursive: true });
    writeFileSync(path.join(args.outDir, "results.json"), json);
  }
  process.stdout.write(json);
}

async function main(): Promise<number> {
  const startedAt = new Date().toISOString();
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2), process.env);
  } catch (err) {
    write(null, {
      ok: false,
      baseUrl: "",
      startedAt,
      finishedAt: new Date().toISOString(),
      journeys: [],
      error: firstLine(err),
    });
    return 1;
  }
  mkdirSync(args.outDir, { recursive: true });
  const code = process.env.CLERK_TEST_CODE || "424242";

  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    write(args, {
      ok: false,
      baseUrl: args.baseUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      journeys: [],
      error: `Could not launch Chromium (${firstLine(err)}). Run npx playwright install chromium`,
    });
    return 1;
  }

  const results: JourneyResult[] = [];
  try {
    for (const journey of journeys(args, process.env)) {
      for (const vp of VIEWPORTS) {
        results.push(await runJourney(browser, journey, vp, args, code));
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const ok = results.every((j) => j.ok);
  write(args, {
    ok,
    baseUrl: args.baseUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    journeys: results,
  });
  return ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`${firstLine(err)}\n`);
    process.exit(1);
  },
);
