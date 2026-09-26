import { describe, expect, it } from "vitest";
import {
  canOpenFootballEpModel,
  earlyPayoutOfferLabel,
  isTwoUpBet,
  parseTwoUpDeskView,
  TWOUP_DESK_VIEW_PARAM,
  twoUpDeskSearch,
} from "./desk-view";
import type { EpBookieSetup } from "./bookie-offers";
import { parsePublicDemoView } from "@/lib/demo/public-demo";

describe("parseTwoUpDeskView", () => {
  it("defaults to fixtures and accepts the desk tiles", () => {
    expect(parseTwoUpDeskView(null)).toBe("fixtures");
    expect(parseTwoUpDeskView("picks")).toBe("picks");
    expect(parseTwoUpDeskView("mystery")).toBe("fixtures");
  });

  // EDGE-159: the desk tab and the public demo's plan preview used to share
  // `view`, so clicking a tile turned a Free or Core preview into Edge on
  // reload. `tab` is the fixture workbench's, hence `deskView`.
  it("keeps the desk tab off the params the demo and workbench own", () => {
    expect(TWOUP_DESK_VIEW_PARAM).toBe("deskView");
    expect(TWOUP_DESK_VIEW_PARAM).not.toBe("view");
    expect(TWOUP_DESK_VIEW_PARAM).not.toBe("tab");
    for (const plan of ["free", "core", "edge"] as const) {
      expect(parsePublicDemoView(plan)).toBe(plan);
      expect(parseTwoUpDeskView(plan)).toBe("fixtures");
    }
  });
});

describe("twoUpDeskSearch", () => {
  it("writes the tab on its own param and drops it on the default tab", () => {
    expect(twoUpDeskSearch("", { view: "tracked" })).toBe("deskView=tracked");
    expect(twoUpDeskSearch("deskView=tracked", { view: "fixtures" })).toBe("");
  });

  // EDGE-159 acceptance: pick Free in the demo, click through the desk tiles,
  // reload, and the plan preview is still Free.
  it("leaves a public demo's plan preview alone through a tab tour", () => {
    let search = "demo=1&view=free";
    for (const view of ["tracked", "active", "fixtures", "picks"] as const) {
      search = twoUpDeskSearch(search, { view });
      const params = new URLSearchParams(search);
      expect(parsePublicDemoView(params.get("view"))).toBe("free");
      expect(parseTwoUpDeskView(params.get(TWOUP_DESK_VIEW_PARAM))).toBe(view);
    }
  });

  it("keeps the preview when a fixture opens the model, and when it clears", () => {
    const opened = twoUpDeskSearch("demo=1&view=core", {
      view: "model",
      fixture: { home: "Everton", away: "Crystal Palace", startTime: 1724328000000, tab: "dutch" },
    });
    const params = new URLSearchParams(opened);
    expect(parsePublicDemoView(params.get("view"))).toBe("core");
    expect(params.get("deskView")).toBe("model");
    expect(params.get("home")).toBe("Everton");
    expect(params.get("tab")).toBe("dutch");

    const cleared = new URLSearchParams(
      twoUpDeskSearch(opened, { view: "fixtures", clearFixture: true })
    );
    expect(parsePublicDemoView(cleared.get("view"))).toBe("core");
    expect(cleared.get("home")).toBeNull();
    expect(cleared.get("deskView")).toBeNull();
  });
});

describe("isTwoUpBet", () => {
  it("treats the early-payout flag, market, and common labels as desk bets", () => {
    expect(isTwoUpBet({ earlyPayout: 1 })).toBe(true);
    expect(isTwoUpBet({ market: "two_up" })).toBe(true);
    expect(isTwoUpBet({ label: "2UP dutch: Arsenal / Chelsea" })).toBe(true);
    expect(isTwoUpBet({ label: "Qualifier", market: "match_odds" })).toBe(false);
  });
});

describe("earlyPayoutOfferLabel", () => {
  it("keeps 2UP/1UP for football and explicit labels, not other sports", () => {
    expect(earlyPayoutOfferLabel({ market: "two_up" }, "baseball")).toBe("2UP");
    expect(earlyPayoutOfferLabel({ label: "1UP home" }, "football")).toBe("1UP");
    expect(earlyPayoutOfferLabel({ label: "away" }, "football")).toBe("2UP");
    expect(earlyPayoutOfferLabel({ label: "away" }, "baseball")).toBe("Early payout");
    expect(earlyPayoutOfferLabel({ label: "away" })).toBe("Early payout");
  });

  it("uses the bookie scope when the sport is not football 2UP or 1UP", () => {
    const setup: EpBookieSetup = {
      scopes: [{ bookie: "bet365", sport: "baseball", leadBy: 5 }],
    };
    expect(
      earlyPayoutOfferLabel({ bookmaker: "bet365", label: "Yankees" }, "baseball", setup)
    ).toBe("5 runs ahead");
    expect(
      earlyPayoutOfferLabel({ bookmaker: "Coral", label: "Yankees" }, "baseball", setup)
    ).toBe("Early payout");
  });
});

describe("canOpenFootballEpModel", () => {
  it("opens the model for football or an unknown sport, not baseball", () => {
    expect(canOpenFootballEpModel("football")).toBe(true);
    expect(canOpenFootballEpModel(null)).toBe(true);
    expect(canOpenFootballEpModel("baseball")).toBe(false);
  });
});
