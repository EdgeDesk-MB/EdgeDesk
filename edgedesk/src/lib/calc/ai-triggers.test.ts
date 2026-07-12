import { describe, expect, it } from "vitest";
import {
  inferAiEffectsFromText,
  offerTriggerDetectedInLabel,
  offerTriggerFromLabel,
  previewAiTriggersFromInput,
} from "./ai-triggers";

describe("inferAiEffectsFromText", () => {
  it("Bet £50 get £50 → unconditional free bet", () => {
    const effects = inferAiEffectsFromText("Bet £50 get £50");
    expect(effects).toHaveLength(1);
    expect(effects[0].amount).toBe(50);
    expect(effects[0].positions).toEqual([]);
  });

  it("Bet £50 get £50FB → unconditional free bet", () => {
    const effects = inferAiEffectsFromText("Bet £50 get £50FB");
    expect(effects[0].positions).toEqual([]);
    expect(effects[0].amount).toBe(50);
  });

  it("Bet £50 get £50 FB if 2nd, 3rd, 4th → place free bet", () => {
    const effects = inferAiEffectsFromText("Bet £50 get £50 FB if 2nd, 3rd, 4th");
    expect(effects[0].amount).toBe(50);
    expect(effects[0].positions).toEqual([2, 3, 4]);
  });

  it("£50FB 2nd, 3rd, 4th → place free bet", () => {
    const effects = inferAiEffectsFromText("£50FB 2nd, 3rd, 4th");
    expect(effects[0].positions).toEqual([2, 3, 4]);
  });

  it("£50FB alone → unconditional free bet", () => {
    const effects = inferAiEffectsFromText("£50FB");
    expect(effects[0].positions).toEqual([]);
  });
});

describe("offerTriggerFromLabel", () => {
  it("detects bet-get-free patterns in labels", () => {
    expect(offerTriggerDetectedInLabel("Bet £50 get £50 free bet if 2nd")).toBe(true);
    expect(offerTriggerFromLabel("Bet £50 get £50 free bet if 2nd")).toBe(
      "Bet £50 get £50 free bet if 2nd"
    );
  });

  it("ignores plain bet labels", () => {
    expect(offerTriggerDetectedInLabel("Newmarket · 3:00 Handicap")).toBe(false);
    expect(offerTriggerFromLabel("Newmarket · 3:00 Handicap")).toBeNull();
  });
});
describe("previewAiTriggersFromInput", () => {
  it("does not parse from label leakage", () => {
    const preview = previewAiTriggersFromInput({ triggerText: "Bet £50 get £50" });
    expect(preview.recognised).toBe(true);
    expect(preview.lines[0]).toContain("when this bet settles");
  });
});
