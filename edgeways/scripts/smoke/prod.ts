/**
 * Post-deploy smoke check (EDGE-217). Signed-out, read-only.
 * Usage: npm run smoke:prod -- [--base-url https://edgeways.app]
 *          [--extra-path /some/path] [--timeout 30000]
 *
 * Prints one JSON object to stdout and exits 1 if any page fails.
 * See scripts/smoke/README.md.
 */
import { chromium, type Browser } from "playwright";
import { isAppConsoleError, isAppPageError, isAppResponseFailure } from "./noise";

const DEFAULT_BASE_URL = "https://edgeways.app";
const MAIN_SELECTOR = "main, [role='main']";
/** `selector` must be visible as well as the main landmark. */
const PAGES: { path: string; selector?: string }[] = [
  { path: "/" },
  { path: "/demo" },
  { path: "/desk?demo=1&view=edge" },
  { path: "/calculators/matched" },
  // Pricing is a section of the home page, there is no /pricing route.
  { path: "/#pricing", selector: "#pricing" },
];
const DEFAULT_TIMEOUT_MS = 30_000;
const SETTLE_MS = 2_000;

type PageResult = {
  path: string;
  status: number | null;
  ok: boolean;
  ms: number | null;
  errors: string[];
};

type SmokeResult = {
  ok: boolean;
  baseUrl: string;
  startedAt: string;
  pages: PageResult[];
  error?: string;
};

function parseArgs(argv: string[]) {
  let baseUrl = DEFAULT_BASE_URL;
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
    else if (arg === "--extra-path") extraPaths.push(next());
    else if (arg === "--timeout") timeoutMs = Number(next());
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("--timeout must be a positive number of milliseconds");
  }
  new URL(baseUrl);
  return { baseUrl: baseUrl.replace(/\/+$/, ""), timeoutMs, extraPaths };
}

async function smokePage(
  browser: Browser,
  userAgent: string,
  baseUrl: string,
  { path, selector }: { path: string; selector?: string },
  timeoutMs: number,
): Promise<PageResult> {
  const appOrigin = new URL(baseUrl).origin;
  const context = await browser.newContext({ userAgent });
  const page = await context.newPage();
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    const source = msg.location().url;
    if (isAppConsoleError(text, source, appOrigin)) {
      errors.push(source ? `console: ${text} (${source})` : `console: ${text}`);
    }
  });
  page.on("response", (res) => {
    const req = res.request();
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) return;
    if (isAppResponseFailure(res.url(), res.status(), appOrigin)) {
      errors.push(`response: HTTP ${res.status()} ${res.url()}`);
    }
  });
  page.on("pageerror", (err) => {
    if (isAppPageError(err.message, err.stack ?? "", appOrigin)) {
      errors.push(`uncaught: ${err.message}`);
    }
  });

  let status: number | null = null;
  let ms: number | null = null;
  const started = Date.now();
  try {
    const response = await page.goto(`${baseUrl}${path}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    status = response?.status() ?? null;
    if (status !== 200) errors.push(`HTTP ${status ?? "no response"}`);

    const remaining = () => Math.max(1, timeoutMs - (Date.now() - started));
    try {
      await page
        .locator(MAIN_SELECTOR)
        .first()
        .waitFor({ state: "visible", timeout: remaining() });
      ms = Date.now() - started;
    } catch {
      errors.push("Main landmark not visible");
    }
    if (selector) {
      await page
        .locator(selector)
        .first()
        .waitFor({ state: "visible", timeout: remaining() })
        .catch(() => errors.push(`${selector} not visible`));
    }

    await page.waitForLoadState("load", { timeout: remaining() }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
    errors.push(`Smoke unavailable: ${message}`);
  } finally {
    await context.close().catch(() => {});
  }

  return { path, status, ok: errors.length === 0, ms, errors };
}

async function main(): Promise<number> {
  const startedAt = new Date().toISOString();
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    print({ ok: false, baseUrl: "", startedAt, pages: [], error });
    return 1;
  }
  const { baseUrl, timeoutMs, extraPaths } = args;

  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
    const error = `Smoke unavailable: could not launch Chromium (${message}). Run npx playwright install chromium`;
    print({ ok: false, baseUrl, startedAt, pages: [], error });
    return 1;
  }

  // posthog-js drops "HeadlessChrome" as a bot, and the analytics check
  // downstream relies on these pageviews arriving.
  const userAgent = `${await defaultUserAgent(browser)} EdgewaysSmoke/1`;

  const pages: PageResult[] = [];
  try {
    for (const target of [...PAGES, ...extraPaths.map((path) => ({ path }))]) {
      pages.push(await smokePage(browser, userAgent, baseUrl, target, timeoutMs));
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const ok = pages.every((p) => p.ok);
  print({ ok, baseUrl, startedAt, pages });
  return ok ? 0 : 1;
}

async function defaultUserAgent(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const ua = await page.evaluate(() => navigator.userAgent);
    return ua.replace("HeadlessChrome", "Chrome");
  } finally {
    await context.close();
  }
}

function print(result: SmokeResult) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().then(
  (code) => process.exit(code),
  (err) => {
    const error = err instanceof Error ? err.message : String(err);
    print({ ok: false, baseUrl: "", startedAt: new Date().toISOString(), pages: [], error });
    process.exit(1);
  },
);
