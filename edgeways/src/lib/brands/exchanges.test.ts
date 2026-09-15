import { describe, expect, it } from "vitest";
import { bookieBrandColor, bookiePanelTint } from "@/lib/brands/bookies";
import {
  exchangeBackColor,
  exchangeBackColorDark,
  exchangeBrandColor,
  exchangeLayColor,
  exchangeLayColorDark,
  exchangeSupportsBack,
  muteForDark,
} from "@/lib/brands/exchanges";
import {
  resolveBackPlateColors,
  resolveLayPlateColors,
} from "@/lib/brands/panel-tints";

describe("exchangeBrandColor", () => {
  it("uses purple for Betdaq, not the sportsbook navy from the bookie map", () => {
    expect(exchangeBrandColor("Betdaq")).toBe("#7b2d8b");
    expect(bookieBrandColor("Betdaq")).toBe("#0d2d5e");
  });

  it("uses Smarkets green, Matchbook red, and BetConnect navy", () => {
    expect(exchangeBrandColor("Smarkets")).toBe("#00753a");
    expect(exchangeBrandColor("Matchbook")).toBe("#8a151c");
    expect(exchangeBrandColor("BetConnect")).toBe("#15213c");
  });

  it("ignores retired marks so old wallets pick up the new dots", () => {
    expect(exchangeBrandColor("Smarkets", "#0f1b2b")).toBe("#00753a");
    expect(exchangeBrandColor("Smarkets", "#00a651")).toBe("#00753a");
    expect(exchangeBrandColor("Matchbook", "#16344f")).toBe("#8a151c");
    expect(exchangeBrandColor("Matchbook", "#e30613")).toBe("#8a151c");
    expect(exchangeBrandColor("BetConnect", "#00A3FF")).toBe("#15213c");
  });

  it("keeps a real Settings override", () => {
    expect(exchangeBrandColor("Betdaq", "#7b2d8b")).toBe("#7b2d8b");
    expect(exchangeBrandColor("Smarkets", "#112233")).toBe("#112233");
  });
});

describe("exchange cell colours", () => {
  it("uses the light hexes as given", () => {
    expect(exchangeBackColor("Betfair")).toBe("#A7D8FF");
    expect(exchangeLayColor("Betfair")).toBe("#FBC9D2");
    expect(exchangeBackColor("Betdaq")).toBe("#FFEFB1");
    expect(exchangeLayColor("Betdaq")).toBe("#BBE7D3");
    expect(exchangeBackColor("Smarkets")).toBe("#D6E2FE");
    expect(exchangeLayColor("Smarkets")).toBe("#D4F9E9");
    expect(exchangeBackColor("Matchbook")).toBe("#8DD2F1");
    expect(exchangeLayColor("Matchbook")).toBe("#FFAEB4");
    expect(exchangeLayColor("BetConnect")).toBe("#81AED3");
  });

  it("does not give BetConnect a back cell", () => {
    expect(exchangeSupportsBack("BetConnect")).toBe(false);
    expect(exchangeBackColor("BetConnect")).toBeNull();
    expect(exchangeBackColor("BetConnect", "#9ad8ff")).toBeNull();
    expect(exchangeBackColorDark("BetConnect")).toBeNull();
    expect(exchangeSupportsBack("Betfair")).toBe(true);
  });

  it("ignores retired stored cells so desks pick up the new light palette", () => {
    expect(exchangeBackColor("Betdaq", "#fce38f")).toBe("#FFEFB1");
    expect(exchangeLayColor("Betdaq", "#b5e5c4")).toBe("#BBE7D3");
    expect(exchangeBackColor("Betdaq", "#A7D8FF")).toBe("#FFEFB1");
    expect(exchangeLayColor("Betdaq", "#FBC9D2")).toBe("#BBE7D3");
    expect(exchangeBackColor("Smarkets", "#bfe8d4")).toBe("#D6E2FE");
    expect(exchangeLayColor("BetConnect", "#9af0b8")).toBe("#81AED3");
  });

  it("preps the same light hex for dark, with no new hue", () => {
    expect(exchangeBackColorDark("Betfair")).toBe(muteForDark("#A7D8FF"));
    expect(exchangeBackColorDark("Betdaq")).toBe(muteForDark("#FFEFB1"));
    expect(exchangeLayColorDark("Betdaq")).toBe(muteForDark("#BBE7D3"));
    expect(exchangeLayColorDark("Matchbook")).toBe(muteForDark("#FFAEB4"));
    expect(muteForDark("#ffb80c")).toBe("oklch(from #ffb80c 0.36 calc(c * 0.3) h)");
    expect(muteForDark("#ffb80c")).not.toContain("250");
  });

  it("mutes a real custom cell for dark", () => {
    expect(exchangeLayColor("Betfair", "#112233")).toBe("#112233");
    expect(exchangeLayColorDark("Betfair", "#112233")).toBe(muteForDark("#112233"));
  });
});

describe("resolveBackPlateColors", () => {
  it("uses the exchange back cell when the venue is an exchange", () => {
    expect(resolveBackPlateColors("Betfair", { name: "Smarkets" }).light).toBe("#A7D8FF");
    expect(resolveBackPlateColors("BetConnect").light).toBeNull();
  });

  it("uses the bookie pastel in light and the Settings brand, muted, in dark", () => {
    const plate = resolveBackPlateColors("Betfair Sportsbook");
    expect(plate.light).toBe(bookiePanelTint("Betfair Sportsbook"));
    expect(plate.dark).toBe(muteForDark(bookieBrandColor("Betfair Sportsbook")));
    expect(plate.dark).toContain("#ffb80c");
  });

  it("uses Betdaq exchange cells, not the sportsbook navy", () => {
    const plate = resolveBackPlateColors("Betdaq");
    expect(plate.light).toBe("#FFEFB1");
    expect(plate.dark).toBe(muteForDark("#FFEFB1"));
  });

  it("falls back to the selected exchange back cell when no venue is set", () => {
    expect(resolveBackPlateColors(undefined, { name: "Matchbook" }).light).toBe("#8DD2F1");
    expect(resolveBackPlateColors(undefined).light).toBeNull();
  });
});

describe("resolveLayPlateColors", () => {
  it("is empty until an exchange is selected", () => {
    expect(resolveLayPlateColors(null).light).toBeNull();
    expect(resolveLayPlateColors({ name: "BetConnect" }).light).toBe("#81AED3");
  });
});
