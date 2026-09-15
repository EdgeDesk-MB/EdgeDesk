import { describe, expect, it } from "vitest";
import {
  hasPublicDemoCookie,
  isPublicDemoDeskPath,
  stripPublicDemoAppearancePatch,
  parsePublicDemoView,
  publicDemoBarLine,
  publicDemoPlansHref,
  demoNoticeKind,
  demoNoticeStorageKey,
  liveDeskHref,
  signedInDemoCta,
  signedInDemoCtaForStatus,
} from "./public-demo";
import { publicDemoApiGet } from "./public-desk-api";
import { publicDemoRacingDesk } from "./public-racing-desk";
import { buildDemoPnlSeries, buildPublicDemoState } from "./public-fixture";
import { goalHistoryCopyFromEntry } from "@/lib/history-goal-copy";
import {
  buildHistoryContext,
  historyOccurredAt,
  sortHistoryEntries,
} from "@/lib/history-display";
import type { HistoryRow } from "@/lib/db/schema";
import { buildHomeChartMarkers } from "@/lib/pnl/chart-bet-markers";

describe("public demo helpers", () => {
  it("reads the public-demo cookie by presence (server verifies the signature)", () => {
    expect(hasPublicDemoCookie("ew_public_demo=1")).toBe(true);
    expect(hasPublicDemoCookie("ew_public_demo=v1.abc123")).toBe(true);
    expect(hasPublicDemoCookie("other=1; ew_public_demo=v1.abc123")).toBe(true);
    expect(hasPublicDemoCookie("ew_public_demo=")).toBe(false);
    expect(hasPublicDemoCookie("other=1")).toBe(false);
    expect(hasPublicDemoCookie(null)).toBe(false);
  });

  it("advises demo to guests and prompts a live desk when signed in", () => {
    expect(demoNoticeKind({ publicDemo: false, signedIn: true })).toBe("none");
    expect(demoNoticeKind({ publicDemo: true, signedIn: false })).toBe("guest");
    expect(demoNoticeKind({ publicDemo: true, signedIn: true })).toBe("account");
    expect(demoNoticeStorageKey("account")).toBe("edgeways:demo-notice:account");
    expect(liveDeskHref("/setup")).toBe("/setup?live=1");
    expect(signedInDemoCta(false)).toEqual({
      label: "Set up your desk",
      path: "/setup",
    });
    expect(signedInDemoCta(true)).toEqual({
      label: "Back to your desk",
      path: "/desk",
    });
    expect(signedInDemoCtaForStatus("loading", true)).toBeNull();
    expect(signedInDemoCtaForStatus("error", false)).toEqual({
      label: "Back to your desk",
      path: "/desk",
    });
    expect(signedInDemoCtaForStatus("ready", false)).toEqual({
      label: "Set up your desk",
      path: "/setup",
    });
  });

  it("defaults the viewing bar to Edge", () => {
    expect(parsePublicDemoView(null)).toBe("edge");
    expect(parsePublicDemoView("core")).toBe("core");
    expect(parsePublicDemoView("free")).toBe("free");
    expect(parsePublicDemoView("nope")).toBe("edge");
  });

  it("allows desk paths for the waitlist cookie gate", () => {
    expect(isPublicDemoDeskPath("/desk")).toBe(true);
    expect(isPublicDemoDeskPath("/accounts")).toBe(true);
    expect(isPublicDemoDeskPath("/racing")).toBe(true);
    expect(isPublicDemoDeskPath("/early-payout")).toBe(true);
    expect(isPublicDemoDeskPath("/2up")).toBe(true);
    expect(isPublicDemoDeskPath("/login")).toBe(false);
  });

  it("strips appearance fields from a public-demo settings patch", () => {
    const patch = {
      defaultBackStake: 10,
      brandAccentPreset: "coral",
      brandAccentHex: "#FF6B4A",
      uiFont: "figtree",
      headerPattern: "hexagons",
    };
    expect(stripPublicDemoAppearancePatch(patch, false)).toEqual(patch);
    expect(stripPublicDemoAppearancePatch(patch, true)).toEqual({
      defaultBackStake: 10,
    });
  });
});

describe("public demo fixture", () => {
  it("paints a filled Edge desk with Demo Bank and over £1,000 kept", () => {
    const state = buildPublicDemoState("edge");
    expect(state.demoMode).toBe(true);
    expect(state.settings.planPreview).toBe("edge");
    expect(state.balances.accounts.some((row) => row.name === "Demo Bank")).toBe(
      true
    );
    expect(state.offers.length).toBeGreaterThan(8);
    expect(state.bets.length).toBeGreaterThan(4);
    expect(state.history.length).toBeGreaterThan(6);
    expect(state.settledProfit).toBeGreaterThan(1000);
    expect(state.offers.some((row) => row.title.includes("2UP"))).toBe(true);
    expect(
      state.offers.some((row) => row.title.includes("2nd, 3rd or 4th"))
    ).toBe(true);
    expect(publicDemoBarLine("edge")).toContain("Edge");
  });

  it("locks the preview to Core or Free when viewing those plans", () => {
    expect(buildPublicDemoState("core").settings.planPreview).toBe("core");
    expect(buildPublicDemoState("core").racingApiConfigured).toBe(false);
    expect(buildPublicDemoState("free").settings.planPreview).toBe("free");
    expect(publicDemoBarLine("core")).toContain("Core");
    expect(publicDemoBarLine("free")).toContain("Free");
    expect(publicDemoPlansHref()).toBe("https://edgeways.app/#pricing");
  });

  it("pairs qualifying and free bets on completed promo offers", () => {
    const state = buildPublicDemoState("edge", Date.UTC(2026, 7, 15, 12));
    const awarded = state.offers.filter(
      (row) => row.status === "completed" && row.profit.freeBetAwarded
    );
    expect(awarded.length).toBeGreaterThan(5);
    for (const offer of awarded) {
      const rows = state.bets.filter((b) => b.offerId === offer.id);
      expect(rows.some((b) => b.betType === "qualifying")).toBe(true);
      expect(rows.some((b) => b.betType === "free_snr")).toBe(true);
    }
    expect(state.balances.accounts.some((row) => row.name === "Ladbrokes")).toBe(
      true
    );
    expect(state.balances.accounts.reduce((s, a) => s + a.freeBets, 0)).toBeGreaterThan(
      50
    );
  });

  it("builds the chart series from the same settlements as the markers", () => {
    const now = Date.UTC(2026, 7, 15, 12);
    const state = buildPublicDemoState("edge", now);
    expect(state.series).toEqual(
      buildDemoPnlSeries(state.bets, state.casinoSettlements)
    );
    expect(state.settledProfit).toBe(state.series.at(-1)?.value);
    expect(state.settledProfit).toBeCloseTo(
      state.bettingProfit + state.casinoProfit,
      2
    );
    const settledTimes = [
      ...state.bets
        .filter((b) => b.status !== "open" && b.status !== "void" && b.actualProfit != null)
        .map((b) => b.settledAt ?? b.createdAt),
      ...state.casinoSettlements.map((row) => row.time),
    ];
    for (const time of settledTimes) {
      expect(state.series.some((point) => point.time === time)).toBe(true);
    }
    expect(
      buildHomeChartMarkers({
        bets: state.bets,
        casinoSettlements: state.casinoSettlements,
      }).length
    ).toBeGreaterThan(10);
  });

  it("orders history newest first", () => {
    const now = Date.UTC(2026, 7, 15, 12);
    const state = buildPublicDemoState("edge", now);
    const ctx = buildHistoryContext(
      state.events,
      state.bets,
      state.promoAwards,
      state.offers.map((o) => ({ id: o.id, title: o.title })),
      state.history
    );
    expect(state.history.map((row) => row.id)).toEqual(
      sortHistoryEntries(state.history, ctx).map((row) => row.id)
    );
    const first = historyOccurredAt(state.history[0]!, ctx);
    const last = historyOccurredAt(state.history.at(-1)!, ctx);
    expect(first).toBeGreaterThan(last);
    const feed = publicDemoApiGet("/api/history?filter=all&limit=200", now) as {
      entries: HistoryRow[];
    };
    expect(feed.entries[0]?.id).toBe(state.history[0]?.id);
  });

  it("renders live goals as Goal! not Goal: Goal", () => {
    const state = buildPublicDemoState("edge", Date.UTC(2026, 7, 15, 12));
    const event = state.events.find((row) => row.id === 1)!;
    const goal = state.history.find((row) => row.kind === "goal" && row.minute === 41)!;
    expect(goal.title).toBe("Goal!");
    expect(goalHistoryCopyFromEntry(goal, event).title).toBe("Goal!");
  });

  it("hides the standalone 2UP row once the 2-0 goal can carry the mark", () => {
    const now = Date.UTC(2026, 7, 15, 12);
    const state = buildPublicDemoState("edge", now);
    expect(state.history.some((row) => row.kind === "two_up")).toBe(true);
    const feed = publicDemoApiGet("/api/history?filter=all&limit=200", now) as {
      entries: HistoryRow[];
    };
    expect(feed.entries.some((row) => row.kind === "two_up")).toBe(false);
    const goal = feed.entries.find((row) => row.kind === "goal" && row.minute === 41);
    expect(goal?.detail).toContain("2-0");
  });

  it("serves Acca, Systems, and Bet Builder lists for demo GETs", () => {
    const acca = publicDemoApiGet("/api/acca") as { runs: unknown[] };
    const systems = publicDemoApiGet("/api/systems") as { runs: unknown[] };
    const builders = publicDemoApiGet("/api/bet-builder") as { runs: unknown[] };
    expect(acca.runs.length).toBeGreaterThan(0);
    expect(systems.runs.length).toBeGreaterThan(0);
    expect(builders.runs.length).toBeGreaterThan(0);
    const alerts = publicDemoApiGet("/api/alerts") as { alerts: { body: string }[] };
    expect(alerts.alerts).toHaveLength(3);
    expect(alerts.alerts.some((row) => row.body.includes("Acca insurance, 3-fold"))).toBe(
      true
    );
    expect(publicDemoApiGet("/api/demo/live-status")).toBeUndefined();
    const footballOdds = publicDemoApiGet(
      "/api/exchange/football-odds?home=Everton&away=Crystal%20Palace"
    ) as { status: string };
    expect(footballOdds.status).toBe("unmatched");
    const twoupScout = publicDemoApiGet("/api/fixtures/twoup-scout?date=2026-09-08") as {
      items: unknown[];
    };
    expect(twoupScout.items).toEqual([]);
    const lots = publicDemoApiGet("/api/accounts/free-bets") as { lots: unknown[] };
    expect(lots.lots.length).toBeGreaterThan(3);
    // EDGE-106: the accounts list and pending queue are canned too, so a demo
    // session never reads live balances.
    const accounts = publicDemoApiGet("/api/accounts") as {
      accounts: unknown[];
      bankroll: number;
    };
    expect(accounts.accounts.length).toBeGreaterThan(0);
    expect(accounts.bankroll).toBeGreaterThan(0);
    expect(publicDemoApiGet("/api/accounts/pending")).toEqual({ pending: [] });
    const bet365 = publicDemoApiGet("/api/accounts/2") as {
      freeBetLots: unknown[];
      transactions: unknown[];
    };
    expect(bet365.freeBetLots.length).toBeGreaterThan(0);
    expect(bet365.transactions.length).toBeGreaterThan(0);
  });

  it("serves modelled demo Race picks for the Edge racing desk", () => {
    const desk = publicDemoRacingDesk("2026-08-15");
    expect(desk.summary.source).toBe("demo");
    expect(desk.edgePlays.length).toBeGreaterThan(0);
    expect(desk.suggestedRaces.length).toBe(desk.edgePlays.length);
    expect(desk.races.every((race) => race.fieldSize >= 8)).toBe(true);
    const edge = publicDemoApiGet("/api/offers/edge?date=2026-08-15") as {
      plays: unknown[];
      source: string;
    };
    expect(edge.source).toBe("demo");
    expect(edge.plays.length).toBe(desk.edgePlays.length);
  });
});
