import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_LAYOUT,
  applyDeckLayout,
  ensureVisibleDeckCards,
  isChartOnMobileSummary,
  moveWidget,
  normalizeHomeLayout,
  resolveMobileDeckCardId,
  toggleDeckHidden,
} from "./home-layout";

describe("normalizeHomeLayout", () => {
  it("returns the shipped defaults for missing or garbage input", () => {
    expect(normalizeHomeLayout(undefined)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout("junk")).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout({ deckOrder: [1, "nope"] })).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it("drops unknown ids (including retired plan), dedupes, and appends missing widgets", () => {
    const layout = normalizeHomeLayout({
      deckOrder: ["chart", "chart", "bogus", "hero", "plan"],
      deckHidden: ["feed", "bogus", "plan"],
    });
    expect(layout.deckOrder).toEqual(["chart", "hero", "feed", "do-next"]);
    expect(layout.deckHidden).toEqual(["feed"]);
  });

  it("unhides Summary when a stored layout leaves Chart on without it", () => {
    const layout = normalizeHomeLayout({ deckHidden: ["hero"] });
    expect(layout.deckHidden).not.toContain("hero");
    expect(layout.deckHidden).not.toContain("chart");
  });

  it("keeps Summary hidden when Chart is hidden too", () => {
    const layout = normalizeHomeLayout({ deckHidden: ["hero", "chart"] });
    expect(layout.deckHidden).toEqual(["hero", "chart"]);
  });

  it("never allows every widget to be hidden", () => {
    const deck = normalizeHomeLayout({
      deckOrder: ["hero", "chart", "feed", "do-next"],
      deckHidden: ["hero", "do-next", "chart", "feed"],
    });
    expect(deck.deckHidden).not.toContain("hero");
    expect(deck.deckHidden).toHaveLength(3);

    const desktop = normalizeHomeLayout({
      desktopHidden: ["hero", "do-next", "chart", "feed"],
    });
    expect(desktop.desktopHidden).not.toContain("hero");
  });
});

describe("applyDeckLayout", () => {
  const cards = [
    { id: "hero" },
    { id: "chart" },
    { id: "feed" },
    { id: "do-next" },
  ];

  it("defaults reproduce the shipped deck exactly", () => {
    expect(applyDeckLayout(cards, DEFAULT_HOME_LAYOUT).map((c) => c.id)).toEqual([
      "hero",
      "chart",
      "feed",
      "do-next",
    ]);
  });

  it("orders and hides; absent cards (data-driven) stay absent", () => {
    const layout = normalizeHomeLayout({
      deckOrder: ["chart", "do-next", "hero", "feed"],
      deckHidden: ["feed"],
    });
    const present = cards.filter((c) => c.id !== "do-next");
    expect(applyDeckLayout(present, layout).map((c) => c.id)).toEqual(["chart", "hero"]);
  });
});

describe("ensureVisibleDeckCards", () => {
  it("keeps Summary when the laid-out deck is empty", () => {
    const fallback = { id: "hero" };
    expect(ensureVisibleDeckCards([], fallback)).toEqual([fallback]);
    expect(ensureVisibleDeckCards([{ id: "feed" }], fallback)).toEqual([{ id: "feed" }]);
  });
});

describe("resolveMobileDeckCardId", () => {
  it("maps leftover chart and plan pins to Summary", () => {
    expect(resolveMobileDeckCardId("chart")).toBe("hero");
    expect(resolveMobileDeckCardId("plan")).toBe("hero");
    expect(resolveMobileDeckCardId("auto")).toBe("hero");
    expect(resolveMobileDeckCardId("hero")).toBe("hero");
    expect(resolveMobileDeckCardId("do-next")).toBe("do-next");
    expect(resolveMobileDeckCardId(null)).toBe("hero");
  });
});

describe("isChartOnMobileSummary", () => {
  it("follows the Chart deck switch", () => {
    expect(isChartOnMobileSummary(DEFAULT_HOME_LAYOUT)).toBe(true);
    expect(
      isChartOnMobileSummary({ ...DEFAULT_HOME_LAYOUT, deckHidden: ["chart"] })
    ).toBe(false);
  });
});

describe("moveWidget", () => {
  it("swaps neighbours, skips Chart, and clamps at the edges", () => {
    const order = DEFAULT_HOME_LAYOUT.deckOrder;
    expect(moveWidget(order, "chart", -1)).toEqual(order);
    expect(moveWidget(order, "hero", 1)).toEqual(["feed", "chart", "hero", "do-next"]);
    expect(moveWidget(order, "hero", -1)).toEqual(order);
    expect(moveWidget(order, "do-next", 1)).toEqual(order);
  });
});

describe("toggleDeckHidden", () => {
  it("turns Summary back on when Chart is shown", () => {
    expect(toggleDeckHidden(["hero", "chart"], "chart", true)).toEqual([]);
  });

  it("hides Chart when Summary is hidden", () => {
    expect(toggleDeckHidden([], "hero", false)).toEqual(["hero", "chart"]);
  });

  it("leaves other widgets untouched", () => {
    expect(toggleDeckHidden(["feed"], "do-next", false)).toEqual(["feed", "do-next"]);
    expect(toggleDeckHidden(["feed", "do-next"], "do-next", true)).toEqual(["feed"]);
  });
});
