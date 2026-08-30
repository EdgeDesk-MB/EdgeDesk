import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(__dirname, "../../app/api");
const stateSource = readFileSync(resolve(__dirname, "neon-desk-state.ts"), "utf8");
const appStateSource = readFileSync(
  resolve(__dirname, "../services/state.ts"),
  "utf8"
);

function routeSource(rel: string): string {
  return readFileSync(resolve(apiRoot, rel), "utf8");
}

function listRouteFiles(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listRouteFiles(resolve(dir, entry.name), next));
    else if (entry.name === "route.ts") out.push(next);
  }
  return out;
}

/** Localhost-only or operator routes. Everything else that mutates via SQLite must gate on Neon. */
const SQLITE_MUTATION_ALLOWLIST = [
  /^admin\//,
  /^cron\//,
  /^data\/demo\//,
];

function isSqliteMutationUngated(rel: string, src: string): boolean {
  if (SQLITE_MUTATION_ALLOWLIST.some((re) => re.test(rel))) return false;
  const importsSqlite = /from ["']@\/lib\/db["']/.test(src);
  const mutates = /export const (POST|PATCH|PUT|DELETE)\b/.test(src);
  const gates = /\bisNeonDesk\b/.test(src);
  return importsSqlite && mutates && !gates;
}

describe("hosted desk cutover", () => {
  it("no longer blocks Boosts, mug plans, effort, reminders, desks, or promo awards", () => {
    const sources = [
      routeSource("boosts/route.ts"),
      routeSource("boosts/[id]/route.ts"),
      routeSource("mug-plans/route.ts"),
      routeSource("mug-plans/[id]/route.ts"),
      routeSource("effort/route.ts"),
      routeSource("reminders/route.ts"),
      routeSource("bets/[id]/award-free-bet/route.ts"),
      routeSource("acca/route.ts"),
      routeSource("acca/[id]/route.ts"),
      routeSource("acca/legs/[id]/route.ts"),
      routeSource("systems/route.ts"),
      routeSource("systems/[id]/route.ts"),
      routeSource("bet-builder/route.ts"),
      routeSource("bet-builder/[id]/route.ts"),
      routeSource("bet-builder/selections/[id]/route.ts"),
      routeSource("racing/overrides/route.ts"),
      routeSource("report/route.ts"),
      routeSource("offers/route.ts"),
      routeSource("offers/[id]/route.ts"),
    ];
    for (const src of sources) {
      expect(src).not.toMatch(/blockHostedDeskMutation/);
    }
  });

  it("writes hosted playbook steps, mistake tags, and clerk-scoped recurrence", () => {
    const patch = routeSource("offers/[id]/route.ts");
    const create = routeSource("offers/route.ts");
    expect(patch).toMatch(/setNeonMistakeTag/);
    expect(patch).toMatch(/rulesAfterPlaybookStep/);
    expect(patch).toMatch(/stopNeonRecurrenceForOffer/);
    expect(create).toMatch(/createNeonOfferSeriesWithInstance/);
    expect(create).not.toMatch(/Recurring offers are not available yet/);
    expect(routeSource("casino/route.ts")).toMatch(
      /createNeonCasinoOfferSeriesWithInstance/
    );
    expect(routeSource("casino/route.ts")).not.toMatch(
      /Recurring casino offers are not available yet/
    );
  });

  it("reads Edge report baselines from Neon on the hosted desk", () => {
    expect(routeSource("report/route.ts")).toMatch(/listNeonAllSnapshots/);
    expect(routeSource("offers/route.ts")).toMatch(/writeNeonEvLock/);
    expect(routeSource("offers/route.ts")).toMatch(/promoAwardsFromTransactions/);
  });

  it("fires hosted weekly and daily digests from the Home poll", () => {
    expect(stateSource).toMatch(/maybeSendNeonWeeklyDigest/);
    expect(stateSource).toMatch(/maybeSendNeonDailyTasksDigest/);
  });

  it("retires match simulation instead of hosting it", () => {
    expect(routeSource("events/route.ts")).toMatch(/status: 410/);
    expect(routeSource("events/route.ts")).not.toMatch(/blockHostedDeskMutation/);
    expect(routeSource("events/simulations/route.ts")).toMatch(/status: 410/);
    expect(routeSource("events/simulations/route.ts")).not.toMatch(/blockHostedDeskMutation/);
  });

  it("never lets a customer mutation write SQLite on the hosted desk", () => {
    const ungated = listRouteFiles(apiRoot).filter((rel) =>
      isSqliteMutationUngated(rel, routeSource(rel))
    );
    expect(ungated).toEqual([]);
  });

  it("builds Home from Neon when the hosted desk flag is on", () => {
    expect(appStateSource).toMatch(/isNeonDesk\(\)/);
    expect(appStateSource).toMatch(/buildNeonDeskAppState/);
  });
});
