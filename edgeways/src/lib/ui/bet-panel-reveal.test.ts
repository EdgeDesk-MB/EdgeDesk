import { afterEach, describe, expect, it } from "vitest";
import {
  BET_PANEL_PAIR_DELAY_MS,
  layFirstTintDelayMs,
  noteBackFirstTint,
  resetBetPanelRevealForTests,
} from "./bet-panel-reveal";

describe("layFirstTintDelayMs", () => {
  afterEach(() => {
    resetBetPanelRevealForTests();
  });

  it("delays Lay when Back first-tinted in the same window", () => {
    noteBackFirstTint(1_000);
    expect(layFirstTintDelayMs(1_010)).toBe(BET_PANEL_PAIR_DELAY_MS);
  });

  it("does not delay when Back never first-tinted", () => {
    expect(layFirstTintDelayMs(1_000)).toBe(0);
  });

  it("does not delay when the pair window has passed", () => {
    noteBackFirstTint(1_000);
    expect(layFirstTintDelayMs(1_000 + 801)).toBe(0);
  });
});
