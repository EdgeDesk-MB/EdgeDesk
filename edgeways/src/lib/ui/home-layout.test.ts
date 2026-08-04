import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_LAYOUT,
  applyDeckLayout,
  moveWidget,
  normalizeHomeLayout,
} from "./home-layout";

describe("normalizeHomeLayout", () => {
  it("returns the shipped defaults for missing or garbage input", () => {
    expect(normalizeHomeLayout(undefined)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout("junk")).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout({ deckOrder: [1, "nope"] })).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it("drops unknown ids, dedupes, and appends missing widgets to the order", () => {
    const layout = normalizeHomeLayout({
      deckOrder: ["chart", "chart", "bogus", "hero"],
      deckHidden: ["feed", "bogus"],
    });
    expect(layout.deckOrder).toEqual(["chart", "hero", "plan", "feed", "do-next"]);
    expect(layout.deckHidden).toEqual(["feed"]);
  });

  it("never allows every widget to be hidden", () => {
    const deck = normalizeHomeLayout({
      deckOrder: ["plan", "hero", "chart", "feed", "do-next"],
      deckHidden: ["hero", "do-next", "plan", "chart", "feed"],
    });
    // First of the user's order survives
    expect(deck.deckHidden).not.toContain("plan");
    expect(deck.deckHidden).toHaveLength(4);

    const desktop = normalizeHomeLayout({
      desktopHidden: ["hero", "do-next", "plan", "chart", "feed"],
    });
    expect(desktop.desktopHidden).not.toContain("hero");
  });
});

describe("applyDeckLayout", () => {
  const cards = [
    { id: "hero" },
    { id: "plan" },
    { id: "chart" },
    { id: "feed" },
    { id: "do-next" },
  ];

  it("defaults reproduce the shipped deck exactly", () => {
    expect(applyDeckLayout(cards, DEFAULT_HOME_LAYOUT).map((c) => c.id)).toEqual([
      "hero",
      "plan",
      "chart",
      "feed",
      "do-next",
    ]);
  });

  it("orders and hides; absent cards (data-driven) stay absent", () => {
    const layout = normalizeHomeLayout({
      deckOrder: ["chart", "do-next", "hero", "plan", "feed"],
      deckHidden: ["feed"],
    });
    // Plan card absent (no plan signals today)
    const present = cards.filter((c) => c.id !== "plan");
    expect(applyDeckLayout(present, layout).map((c) => c.id)).toEqual([
      "chart",
      "do-next",
      "hero",
    ]);
  });
});

describe("moveWidget", () => {
  it("swaps neighbours and clamps at the edges", () => {
    const order = DEFAULT_HOME_LAYOUT.deckOrder;
    expect(moveWidget(order, "chart", -1)).toEqual(["hero", "chart", "plan", "feed", "do-next"]);
    expect(moveWidget(order, "hero", -1)).toEqual(order);
    expect(moveWidget(order, "do-next", 1)).toEqual(order);
  });
});
