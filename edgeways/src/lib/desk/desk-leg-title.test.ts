import { describe, expect, it } from "vitest";
import {
  deskLegTitleParts,
  isEventAutoLabel,
  nextDeskLegLabel,
  selectionDisplayLabel,
} from "@/lib/desk/desk-leg-title";

describe("selectionDisplayLabel", () => {
  it("returns runner names as-is", () => {
    expect(selectionDisplayLabel("Highland Flyer")).toBe("Highland Flyer");
  });

  it("resolves home/away/draw against the event", () => {
    const ev = { sport: "football", homeTeam: "Arsenal", awayTeam: "Chelsea" };
    expect(selectionDisplayLabel("home", ev)).toBe("Arsenal");
    expect(selectionDisplayLabel("away", ev)).toBe("Chelsea");
    expect(selectionDisplayLabel("draw", ev)).toBe("Draw");
  });
});

describe("deskLegTitleParts", () => {
  it("prefers the horse over a race-name label", () => {
    const parts = deskLegTitleParts(
      {
        label: "Randox Rated Hurdle",
        selection: "Highland Flyer",
        sport: "horse_racing",
      },
      { sport: "horse_racing", homeTeam: "Randox Rated Hurdle", awayTeam: "14:33" }
    );
    expect(parts.primary).toBe("Highland Flyer");
    expect(parts.secondary).toBe("Randox Rated Hurdle");
  });

  it("falls back to label when selection is empty", () => {
    const parts = deskLegTitleParts({
      label: "Randox Rated Hurdle",
      selection: "",
      sport: "horse_racing",
    });
    expect(parts.primary).toBe("Randox Rated Hurdle");
    expect(parts.secondary).toBeNull();
  });
});

describe("nextDeskLegLabel", () => {
  const race = {
    sport: "horse_racing",
    homeTeam: "Randox Rated Hurdle",
    awayTeam: "14:33",
  };

  it("replaces an empty or race-auto label with the horse", () => {
    expect(
      nextDeskLegLabel({
        currentLabel: "",
        nextSelection: "Highland Flyer",
        event: race,
      })
    ).toBe("Highland Flyer");
    expect(
      nextDeskLegLabel({
        currentLabel: "Randox Rated Hurdle",
        nextSelection: "Highland Flyer",
        event: race,
      })
    ).toBe("Highland Flyer");
  });

  it("keeps a custom typed label", () => {
    expect(
      nextDeskLegLabel({
        currentLabel: "My nap",
        previousSelection: "Highland Flyer",
        nextSelection: "Other Horse",
        event: race,
      })
    ).toBe("My nap");
  });

  it("detects event auto labels", () => {
    expect(isEventAutoLabel("Randox Rated Hurdle", race)).toBe(true);
    expect(isEventAutoLabel("Highland Flyer", race)).toBe(false);
  });
});
