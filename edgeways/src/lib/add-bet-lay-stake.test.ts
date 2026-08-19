import { describe, expect, it } from "vitest";
import {
  addBetLayCalcKey,
  addBetMatchedSaveEnabled,
  addBetPlanMode,
  commitLayStakeOverride,
  resolveAddBetLayStake,
} from "./add-bet-lay-stake";
import type { LayPlanInput } from "@/lib/calc";

/** Screenshot case: £10 @ 5.5 vs 6, Betdaq 0% commission. */
const screenshot: LayPlanInput = {
  mode: "qualifying",
  backStake: 10,
  backOdds: 5.5,
  layOdds: 6,
  commission: 0,
};

const screenshotKey = addBetLayCalcKey(screenshot);

describe("resolveAddBetLayStake", () => {
  it("equalises the screenshot case at £9.17 (55 / 6)", () => {
    // Bookie win 10×4.5 = 45, lose −10 → (45 − −10) / 6 = 9.166… → 9.17
    expect(resolveAddBetLayStake(screenshot, null, screenshotKey)).toBe(9.17);
  });

  it("drops a stale £0 override once odds are entered", () => {
    const stale = commitLayStakeOverride(
      0,
      addBetLayCalcKey({ ...screenshot, layOdds: Number.NaN })
    );
    expect(resolveAddBetLayStake(screenshot, stale, screenshotKey)).toBe(9.17);
  });

  it("keeps a deliberate £0 override for the current inputs", () => {
    const deliberate = commitLayStakeOverride(0, screenshotKey);
    expect(resolveAddBetLayStake(screenshot, deliberate, screenshotKey)).toBe(0);
  });

  it("keeps a custom lay only while stake and odds are unchanged", () => {
    const custom = commitLayStakeOverride(8.5, screenshotKey);
    expect(resolveAddBetLayStake(screenshot, custom, screenshotKey)).toBe(8.5);
    const next = { ...screenshot, layOdds: 6.2 };
    expect(resolveAddBetLayStake(next, custom, addBetLayCalcKey(next))).toBe(
      resolveAddBetLayStake(next, null, addBetLayCalcKey(next))
    );
  });

  it("is 0 until the plan is ready", () => {
    expect(resolveAddBetLayStake(null, null, screenshotKey)).toBe(0);
  });
});

describe("commitLayStakeOverride", () => {
  it("treats a cleared field as no override", () => {
    expect(commitLayStakeOverride(Number.NaN, screenshotKey)).toBeNull();
    expect(commitLayStakeOverride(-1, screenshotKey)).toBeNull();
  });
});

describe("addBetMatchedSaveEnabled", () => {
  it("blocks a qualifying bet with a £0 lay", () => {
    expect(
      addBetMatchedSaveEnabled({
        isDutch: false,
        dutchLegsCount: 0,
        noLay: false,
        backStake: 10,
        backOdds: 5.5,
        preview: { totalLayStake: 0 },
      })
    ).toBe(false);
  });

  it("allows a qualifying bet once the lay is calculated", () => {
    expect(
      addBetMatchedSaveEnabled({
        isDutch: false,
        dutchLegsCount: 0,
        noLay: false,
        backStake: 10,
        backOdds: 5.5,
        preview: { totalLayStake: 9.17 },
      })
    ).toBe(true);
  });

  it("allows no-lay when the back side is complete", () => {
    expect(
      addBetMatchedSaveEnabled({
        isDutch: false,
        dutchLegsCount: 0,
        noLay: true,
        backStake: 10,
        backOdds: 5.5,
        preview: null,
      })
    ).toBe(true);
  });
});

describe("addBetPlanMode", () => {
  it("maps UI-only types onto qualifying maths", () => {
    expect(addBetPlanMode("no_lay")).toBe("qualifying");
    expect(addBetPlanMode("dutch")).toBe("qualifying");
    expect(addBetPlanMode("boost")).toBe("qualifying");
    expect(addBetPlanMode("free_snr")).toBe("free_snr");
  });
});
